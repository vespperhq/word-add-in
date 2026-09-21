import {
  TraceEventType,
  type ChatMessage,
  type MessageImage,
  type TraceEvent,
  type TracePart,
  type Turn,
  type UserMessagePart,
} from "./types";

function upsertPart(parts: TracePart[], next: TracePart): TracePart[] {
  const i = parts.findIndex((p) => p.id === next.id);
  if (i < 0) return [...parts, next];
  const copy = parts.slice();
  copy[i] = next;
  return copy;
}

function getToolPart(turn: Turn, id: string, name?: string): TracePart {
  return (
    turn.parts.find((p) => p.id === id) ?? {
      id,
      kind: "tool",
      name,
    }
  );
}

function getReasoningPartId(id: string): string {
  return `reasoning-${id}`;
}

function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error.trim() || fallback;
  if (error == null) return fallback;

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "detail", "description"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    for (const key of ["error", "cause"]) {
      const value = record[key];
      if (value != null && value !== error) {
        const nested = formatErrorMessage(value, "");
        if (nested) return nested;
      }
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized.slice(0, 1_000);
    } catch {
      return fallback;
    }
    return fallback;
  }

  return String(error);
}

function closeReasoning(turn: Turn, endedAt: number): Turn {
  let active: TracePart | undefined;
  for (let index = turn.parts.length - 1; index >= 0; index -= 1) {
    const part = turn.parts[index];
    if (part.kind === "reasoning" && part.thinkMs == null) {
      active = part;
      break;
    }
  }
  if (!active) return turn;
  if (!active.text) {
    return {
      ...turn,
      parts: turn.parts.filter((part) => part.id !== active.id),
    };
  }
  return {
    ...turn,
    parts: upsertPart(turn.parts, {
      ...active,
      thinkMs: Math.round(endedAt - (active.reasoningStartedAt ?? endedAt)),
      reasoningStartedAt: undefined,
      open: active.userToggled ? active.open : false,
    }),
  };
}

function closeEmptyText(turn: Turn): Turn {
  const last = turn.parts[turn.parts.length - 1];
  if (last?.kind !== "text" || last.text) return turn;
  return { ...turn, parts: turn.parts.slice(0, -1) };
}

function beginBlock(turn: Turn, endedAt: number): Turn {
  return closeEmptyText(closeReasoning(turn, endedAt));
}

function withTextSummary(turn: Turn): Turn {
  return {
    ...turn,
    summary: turn.parts
      .filter((part) => part.kind === "text")
      .map((part) => part.text ?? "")
      .join(""),
  };
}

function nextTextPartId(parts: TracePart[], sourceId?: string): string {
  const base = sourceId ? `text-${sourceId}` : "text";
  if (!parts.some((part) => part.id === base)) return base;
  let n = 2;
  while (parts.some((part) => part.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function appendTextDelta(
  turn: Turn,
  sourceId: string | undefined,
  delta: string
): Turn {
  const last = turn.parts[turn.parts.length - 1];
  if (last?.kind === "text") {
    return withTextSummary({
      ...turn,
      parts: upsertPart(turn.parts, {
        ...last,
        text: (last.text ?? "") + delta,
      }),
    });
  }
  return withTextSummary({
    ...turn,
    parts: [
      ...turn.parts,
      { id: nextTextPartId(turn.parts, sourceId), kind: "text", text: delta },
    ],
  });
}

function buildUserText(instruction: string, selectedContent?: string): string {
  const request = instruction.trim();
  const selection = selectedContent?.trim();
  if (!selection) return request;
  const context = `The user has selected the following content:\n\n${selection}`;
  return request ? `${context}\n\nUser message: ${request}` : context;
}

export function buildUserMessage(
  instruction: string,
  selectedContent: string | undefined,
  images: MessageImage[] = []
): ChatMessage | undefined {
  const text = buildUserText(instruction, selectedContent);
  if (!images.length) {
    return text ? { role: "user", content: text } : undefined;
  }

  const content: UserMessagePart[] = [];
  if (text) content.push({ type: "text", text });
  content.push(
    ...images.map(({ base64, mimeType }) => ({
      type: "image" as const,
      image: base64,
      mimeType,
    }))
  );
  return { role: "user", content };
}

export function emptyTurn(
  instruction: string,
  selectedContent?: string,
  images: MessageImage[] = []
): Turn {
  return {
    instruction,
    selectedContent,
    images,
    parts: [],
    summary: "",
    working: true,
  };
}

export function applyTraceEvent(turn: Turn, msg: TraceEvent): Turn {
  const receivedAt = msg.receivedAt ?? performance.now();
  switch (msg.type) {
    case TraceEventType.REASONING_START: {
      const id = getReasoningPartId(msg.payload.id);
      if (turn.parts.some((part) => part.id === id)) return turn;
      const next = beginBlock(turn, receivedAt);
      return {
        ...next,
        parts: [
          ...next.parts,
          {
            id,
            kind: "reasoning",
            text: "",
            open: true,
            reasoningStartedAt: receivedAt,
          },
        ],
      };
    }
    case TraceEventType.REASONING_DELTA: {
      const id = getReasoningPartId(msg.payload.id);
      const existing = turn.parts.find((part) => part.id === id);
      const delta = msg.payload.text ?? "";
      if (!delta) return turn;
      if (existing) {
        return {
          ...turn,
          parts: upsertPart(turn.parts, {
            ...existing,
            text: (existing.text ?? "") + delta,
          }),
        };
      }
      return {
        ...turn,
        parts: [
          ...turn.parts,
          {
            id,
            kind: "reasoning",
            text: delta,
            open: true,
            reasoningStartedAt: receivedAt,
          },
        ],
      };
    }
    case TraceEventType.REASONING_END: {
      const id = getReasoningPartId(msg.payload.id);
      const part = turn.parts.find((candidate) => candidate.id === id);
      if (!part) return turn;
      if (!part.text) {
        return {
          ...turn,
          parts: turn.parts.filter((candidate) => candidate.id !== id),
        };
      }
      return {
        ...turn,
        parts: upsertPart(turn.parts, {
          ...part,
          thinkMs: Math.round(
            receivedAt - (part.reasoningStartedAt ?? receivedAt)
          ),
          reasoningStartedAt: undefined,
          open: part.userToggled ? part.open : false,
        }),
      };
    }
    case TraceEventType.TEXT_START: {
      const next = beginBlock(turn, receivedAt);
      return {
        ...next,
        parts: [
          ...next.parts,
          {
            id: nextTextPartId(next.parts, msg.payload.id),
            kind: "text",
            text: "",
          },
        ],
      };
    }
    case TraceEventType.TEXT_DELTA: {
      const delta = msg.payload.text ?? "";
      if (!delta) return turn;
      return appendTextDelta(
        closeReasoning(turn, receivedAt),
        msg.payload.id,
        delta
      );
    }
    case TraceEventType.TEXT_END:
      return closeEmptyText(turn);
    case TraceEventType.TOOL_CALL_INPUT_STREAMING_START: {
      const next = beginBlock(turn, receivedAt);
      const { toolCallId: id, toolName } = msg.payload;
      const p = {
        ...getToolPart(next, id, toolName),
      };
      p.state = "input-streaming";
      if (toolName) p.name = toolName;
      p.argumentsStartedAt ??= receivedAt;
      if (!p.userToggled) p.open = true;
      return { ...next, parts: upsertPart(next.parts, p) };
    }
    case TraceEventType.TOOL_CALL_DELTA: {
      const next = beginBlock(turn, receivedAt);
      const { argsTextDelta = "", toolCallId: id, toolName } = msg.payload;
      const p = {
        ...getToolPart(next, id, toolName),
      };
      p.state = "input-streaming";
      if (toolName) p.name = toolName;
      p.argumentsStartedAt ??= receivedAt;
      p.argsText = (p.argsText ?? "") + argsTextDelta;
      if (!p.userToggled) p.open = true;
      return { ...next, parts: upsertPart(next.parts, p) };
    }
    case TraceEventType.TOOL_CALL: {
      const next = beginBlock(turn, receivedAt);
      const { args, toolCallId: id, toolName } = msg.payload;
      const p = {
        ...getToolPart(next, id, toolName),
      };
      p.state = "input-available";
      if (toolName) p.name = toolName;
      if (args && typeof args === "object" && !Array.isArray(args)) {
        p.input = args as Record<string, unknown>;
      }
      p.argsMs =
        p.argumentsStartedAt == null
          ? undefined
          : Math.round(receivedAt - p.argumentsStartedAt);
      p.argumentsStartedAt = undefined;
      p.toolStartedAt = receivedAt;
      if (args !== undefined) {
        try {
          p.argsText = JSON.stringify(args, null, 2);
        } catch {
          /* ignore */
        }
      }
      if (!p.userToggled) p.open = false;
      return { ...next, parts: upsertPart(next.parts, p) };
    }
    case TraceEventType.TOOL_RESULT: {
      const next = beginBlock(turn, receivedAt);
      const { result, toolCallId: id, toolName } = msg.payload;
      const p = {
        ...getToolPart(next, id, toolName),
      };
      p.state = "output-available";
      if (toolName) p.name = toolName;
      p.output =
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as Record<string, unknown>)
          : { result };
      p.runMs =
        p.toolStartedAt == null
          ? undefined
          : Math.round(receivedAt - p.toolStartedAt);
      p.toolStartedAt = undefined;
      if (!p.userToggled) p.open = false;
      return { ...next, parts: upsertPart(next.parts, p) };
    }
    case TraceEventType.TOOL_ERROR: {
      const next = beginBlock(turn, receivedAt);
      const { error, toolCallId: id, toolName } = msg.payload;
      const p = {
        ...getToolPart(next, id, toolName),
      };
      p.state = "output-available";
      if (toolName) p.name = toolName;
      p.output = {
        error: formatErrorMessage(error, "Tool error"),
      };
      p.runMs =
        p.toolStartedAt == null
          ? undefined
          : Math.round(receivedAt - p.toolStartedAt);
      p.toolStartedAt = undefined;
      if (!p.userToggled) p.open = false;
      return { ...next, parts: upsertPart(next.parts, p) };
    }
    case TraceEventType.ERROR: {
      const next = beginBlock(turn, receivedAt);
      const err = msg.payload?.error ?? msg.payload?.detail ?? msg.detail;
      return {
        ...next,
        error: formatErrorMessage(err, "Agent error"),
      };
    }
    case TraceEventType.FINISH:
      return beginBlock(turn, receivedAt);
    default:
      return turn;
  }
}

export function applyTraceEvents(turn: Turn, events: TraceEvent[]): Turn {
  return events.reduce(applyTraceEvent, turn);
}

export function togglePartOpen(turn: Turn, id: string): Turn {
  const p = turn.parts.find((part) => part.id === id);
  if (!p) return turn;
  return {
    ...turn,
    parts: upsertPart(turn.parts, {
      ...p,
      userToggled: true,
      open: !p.open,
    }),
  };
}

export function turnsToMessages(turns: Turn[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const turn of turns) {
    if (turn.working) continue;
    const message = buildUserMessage(
      turn.instruction,
      turn.selectedContent,
      turn.images
    );
    if (message) out.push(message);
    const summary = turn.summary.trim();
    if (summary) out.push({ role: "assistant", content: summary });
  }
  return out;
}
