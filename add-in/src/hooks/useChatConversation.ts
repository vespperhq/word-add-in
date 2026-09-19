import { useEffect, useRef, useState } from "react";
import { useProcess } from "../api/useProcess";
import {
  applyDocxToWord,
  base64ToArrayBuffer,
  getDocumentBytes,
} from "../office/document";
import {
  applyTraceEvents,
  buildUserMessage,
  emptyTurn,
  togglePartOpen,
  turnsToMessages,
} from "../trace";
import {
  TraceEventType,
  type MessageImage,
  type TraceEvent,
  type Turn,
} from "../types";

type UseChatConversationOptions = {
  instruction: string;
  selectedContent: string;
  images: MessageImage[];
  imagesLoading: boolean;
  author: string;
  model: string;
  clearComposer: () => void;
};

export function useChatConversation({
  instruction,
  selectedContent,
  images,
  imagesLoading,
  author,
  model,
  clearComposer,
}: UseChatConversationOptions) {
  const { trigger: processDocument, reset: resetProcess } = useProcess();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<{
    controller: AbortController;
    stopped: boolean;
  } | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.controller.abort();
    },
    []
  );

  function patchLastTurn(updater: (turn: Turn) => Turn) {
    setTurns((previous) => {
      if (!previous.length) return previous;
      const copy = previous.slice();
      copy[copy.length - 1] = updater(copy[copy.length - 1]);
      return copy;
    });
  }

  function stop() {
    const active = abortRef.current;
    if (!active || active.stopped) return;
    active.stopped = true;
    active.controller.abort();
  }

  function togglePart(turnIndex: number, id: string) {
    setTurns((previous) =>
      previous.map((turn, index) =>
        index === turnIndex ? togglePartOpen(turn, id) : turn
      )
    );
  }

  async function send() {
    if (busy || imagesLoading) return;
    const text = instruction.trim();
    const trackedAuthor = author.trim() || "Vespper Agent";
    const imagesForTurn = images;
    if (!text && !imagesForTurn.length) return;
    const selectedContentForTurn = selectedContent;
    const currentMessage = buildUserMessage(
      text,
      selectedContentForTurn,
      imagesForTurn
    );
    if (!currentMessage) return;

    const history = [...turnsToMessages(turns), currentMessage];
    clearComposer();
    resetProcess();
    setTurns((previous) => [
      ...previous,
      emptyTurn(text, selectedContentForTurn, imagesForTurn),
    ]);

    const thisRun = {
      controller: new AbortController(),
      stopped: false,
    };
    abortRef.current = thisRun;
    setBusy(true);
    let lastAppliedDocxB64: string | null = null;
    let appliedDuringRun = false;
    let queuedTraceEvents: TraceEvent[] = [];
    let traceFrame: number | null = null;

    const flushTraceEvents = () => {
      if (!queuedTraceEvents.length) return;
      const events = queuedTraceEvents;
      queuedTraceEvents = [];
      setTurns((previous) => {
        const lastTurn = previous[previous.length - 1];
        if (!lastTurn?.working) {
          return [
            ...previous,
            applyTraceEvents(
              emptyTurn(text, selectedContentForTurn, imagesForTurn),
              events
            ),
          ];
        }
        const copy = previous.slice();
        copy[copy.length - 1] = applyTraceEvents(lastTurn, events);
        return copy;
      });
    };

    const flushTraceEventsNow = () => {
      if (traceFrame != null) {
        cancelAnimationFrame(traceFrame);
        traceFrame = null;
      }
      flushTraceEvents();
    };

    const queueTraceEvent = (event: TraceEvent) => {
      queuedTraceEvents.push(event);
      const isDelta =
        event.type === TraceEventType.REASONING_DELTA ||
        event.type === TraceEventType.TEXT_DELTA ||
        event.type === TraceEventType.TOOL_CALL_DELTA;
      if (!isDelta) {
        flushTraceEventsNow();
      } else if (traceFrame == null) {
        traceFrame = requestAnimationFrame(() => {
          traceFrame = null;
          flushTraceEvents();
        });
      }
    };

    try {
      const bytes = await getDocumentBytes();
      if (thisRun.controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const result = await processDocument({
        bytes,
        messages: history,
        author: trackedAuthor,
        model,
        signal: thisRun.controller.signal,
        onEvent: queueTraceEvent,
        onDocument: async ({ docx_b64 }) => {
          if (thisRun.controller.signal.aborted) return;

          const edited = base64ToArrayBuffer(docx_b64);
          if (edited.byteLength < 512 && bytes.byteLength > 2048) return;

          try {
            await applyDocxToWord(edited);
            lastAppliedDocxB64 = docx_b64;
            appliedDuringRun = true;
          } catch {
            // The final document remains the fallback when an early apply fails.
          }
        },
      });
      flushTraceEventsNow();

      if (thisRun.controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const editCount = result.edit_count;
      if (editCount === 0) {
        patchLastTurn((turn) => ({ ...turn, working: false }));
        return;
      }

      if (!result.docx_b64) {
        throw new Error("Agent finished without returning an edited document.");
      }

      const edited = base64ToArrayBuffer(result.docx_b64);
      if (edited.byteLength < 512 && bytes.byteLength > 2048) {
        throw new Error(
          `Edited file is too small (${edited.byteLength} bytes vs ${bytes.byteLength} uploaded). ` +
            "Refusing to replace your document — check the debug log."
        );
      }

      if (result.docx_b64 !== lastAppliedDocxB64) {
        await applyDocxToWord(edited);
      }
      patchLastTurn((turn) => ({ ...turn, working: false }));
    } catch (error) {
      flushTraceEventsNow();
      if (thisRun.stopped) {
        const note = appliedDuringRun
          ? "Stopped — edits applied before cancellation remain in the document."
          : "Stopped — no changes were applied to your document.";
        setTurns((previous) => {
          const lastTurn = previous[previous.length - 1];
          if (!lastTurn?.working) return previous;
          const copy = previous.slice();
          copy[copy.length - 1] = {
            ...lastTurn,
            working: false,
            note,
            summarySuperseded: Boolean(lastTurn.summary.trim()),
          };
          return copy;
        });
        return;
      }

      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Server request timed out (agent edit can take several minutes)."
          : error instanceof Error
          ? error.message
          : String(error);
      setTurns((previous) => {
        const lastTurn = previous[previous.length - 1];
        const failed = {
          working: false as const,
          error: appliedDuringRun
            ? `The agent failed after applying an intermediate document — ${message}`
            : `Changes were NOT applied to your Word document — ${message}`,
          summarySuperseded: Boolean(lastTurn?.summary.trim()),
        };
        if (lastTurn?.working) {
          const copy = previous.slice();
          copy[copy.length - 1] = { ...lastTurn, ...failed };
          return copy;
        }
        return [
          ...previous,
          {
            ...emptyTurn(text, selectedContentForTurn, imagesForTurn),
            ...failed,
          },
        ];
      });
    } finally {
      flushTraceEventsNow();
      setTurns((previous) => {
        const lastTurn = previous[previous.length - 1];
        if (!lastTurn?.working) return previous;
        const copy = previous.slice();
        copy[copy.length - 1] = { ...lastTurn, working: false };
        return copy;
      });
      abortRef.current = null;
      setBusy(false);
    }
  }

  return {
    conversationRef,
    turns,
    busy,
    send,
    stop,
    togglePart,
  };
}
