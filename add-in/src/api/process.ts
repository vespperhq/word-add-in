import {
  DocumentUpdateSchema,
  TraceEventType,
  type ChatMessage,
  type DocumentUpdate,
  type DoneEvent,
  type TraceEvent,
} from "../types";

const FETCH_TIMEOUT_MS = 300_000;

export type ProcessArg = {
  bytes: Uint8Array;
  messages: ChatMessage[];
  author: string;
  model: string;
  trackChanges: boolean;
  signal: AbortSignal;
  onEvent: (event: TraceEvent) => void;
  onDocument: (update: DocumentUpdate) => Promise<void>;
};

export type ProcessResult = {
  docx_b64: string;
  edit_count: number;
  summary: string;
};

type StreamMessage = {
  type: string;
  payload?: Record<string, unknown>;
  detail?: unknown;
  docx_b64?: string;
  edit_count?: number;
  revision?: number;
  summary?: string;
};

const TRACE_EVENT_TYPES = new Set<string>(Object.values(TraceEventType));

function getDocumentUpdate(event: StreamMessage): DocumentUpdate | null {
  const parsed = DocumentUpdateSchema.safeParse(event);
  return parsed.success ? parsed.data : null;
}

function removeDocumentFromEvent(event: TraceEvent): TraceEvent {
  if (event.type !== TraceEventType.TOOL_RESULT) return event;
  const result = event.payload.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return event;
  }
  const { base64: _base64, ...output } = result as Record<string, unknown>;
  return {
    ...event,
    payload: {
      ...event.payload,
      result: output,
    },
  };
}

async function parseJsonError(resp: Response): Promise<string> {
  const text = await resp.text();
  try {
    const body = JSON.parse(text) as { error?: string };
    return body.error ?? text;
  } catch {
    return text || `Server error ${resp.status}`;
  }
}

export async function sendProcess(
  url: string,
  { arg }: { arg: ProcessArg }
): Promise<ProcessResult> {
  const form = new FormData();
  const copy = new Uint8Array(arg.bytes.byteLength);
  copy.set(arg.bytes);
  form.append(
    "file",
    new Blob([copy], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "document.docx"
  );
  form.append("messages", JSON.stringify(arg.messages));
  form.append("author", arg.author);
  form.append("model", arg.model);
  form.append("trackChanges", String(arg.trackChanges));

  const local = new AbortController();
  const onAbort = () => local.abort();
  arg.signal.addEventListener("abort", onAbort);
  const timer = window.setTimeout(() => local.abort(), FETCH_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      body: form,
      signal: local.signal,
    });
  } finally {
    window.clearTimeout(timer);
    arg.signal.removeEventListener("abort", onAbort);
  }

  if (!resp.ok) throw new Error(await parseJsonError(resp));
  if (!resp.body) throw new Error("No response body to stream.");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let doneEvent: DoneEvent | null = null;
  let errorDetail: string | null = null;
  let documentApplyError: unknown;
  let documentApplyChain = Promise.resolve();
  let latestDocumentRevision = -1;

  const cancelReader = () => {
    void reader.cancel().catch(() => {
      /* already closed */
    });
  };
  arg.signal.addEventListener("abort", cancelReader, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: StreamMessage;
        try {
          msg = JSON.parse(line) as StreamMessage;
        } catch {
          continue;
        }
        if (msg.type === "done") doneEvent = msg as unknown as DoneEvent;
        else if (msg.type === TraceEventType.ERROR && msg.detail != null) {
          errorDetail = String(msg.detail);
        } else {
          const documentUpdate = getDocumentUpdate(msg);
          if (TRACE_EVENT_TYPES.has(msg.type)) {
            arg.onEvent({
              ...removeDocumentFromEvent(msg as TraceEvent),
              receivedAt: performance.now(),
            });
          }
          if (
            documentUpdate &&
            documentUpdate.revision > latestDocumentRevision
          ) {
            latestDocumentRevision = documentUpdate.revision;
            documentApplyChain = documentApplyChain.then(async () => {
              try {
                await arg.onDocument(documentUpdate);
              } catch (error) {
                documentApplyError ??= error;
              }
            });
          }
        }
      }
    }
  } finally {
    arg.signal.removeEventListener("abort", cancelReader);
  }

  await documentApplyChain;
  if (arg.signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (documentApplyError) throw documentApplyError;
  if (errorDetail) throw new Error(errorDetail);
  if (!doneEvent) throw new Error("Agent finished without a response.");

  return {
    docx_b64: doneEvent.docx_b64 ?? "",
    edit_count: doneEvent.edit_count ?? 0,
    summary: doneEvent.summary ?? "",
  };
}
