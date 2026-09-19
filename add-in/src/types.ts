import * as z from "zod/mini";
import type { MessageImage } from "../../shared/messages";

export type {
  ChatMessage,
  ImageMimeType,
  MessageImage,
  UserMessagePart,
} from "../../shared/messages";

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available";

export enum TraceEventType {
  REASONING_START = "reasoning-start",
  REASONING_DELTA = "reasoning-delta",
  REASONING_END = "reasoning-end",
  TEXT_DELTA = "text-delta",
  TOOL_CALL_INPUT_STREAMING_START = "tool-call-input-streaming-start",
  TOOL_CALL_DELTA = "tool-call-delta",
  TOOL_CALL = "tool-call",
  TOOL_RESULT = "tool-result",
  TOOL_ERROR = "tool-error",
  FINISH = "finish",
  ERROR = "error",
}

export type TracePart = {
  id: string;
  kind: "tool" | "reasoning";
  name?: string;
  state?: ToolState;
  text?: string;
  thinkMs?: number;
  reasoningStartedAt?: number;
  argumentsStartedAt?: number;
  toolStartedAt?: number;
  argsMs?: number;
  runMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  argsText?: string;
  open?: boolean;
  userToggled?: boolean;
};

export type Turn = {
  instruction: string;
  selectedContent?: string;
  images: MessageImage[];
  parts: TracePart[];
  summary: string;
  working: boolean;
  error?: string;
  note?: string;
  summarySuperseded?: boolean;
};

type ReasoningPayload = {
  id: string;
  text?: string;
};

type ToolPayload = {
  toolCallId: string;
  toolName?: string;
  argsTextDelta?: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
  isError?: boolean;
};

type TraceEventData =
  | { type: TraceEventType.REASONING_START; payload: ReasoningPayload }
  | { type: TraceEventType.REASONING_DELTA; payload: ReasoningPayload }
  | { type: TraceEventType.REASONING_END; payload: ReasoningPayload }
  | { type: TraceEventType.TEXT_DELTA; payload: { id?: string; text: string } }
  | {
      type: TraceEventType.TOOL_CALL_INPUT_STREAMING_START;
      payload: ToolPayload;
    }
  | { type: TraceEventType.TOOL_CALL_DELTA; payload: ToolPayload }
  | { type: TraceEventType.TOOL_CALL; payload: ToolPayload }
  | { type: TraceEventType.TOOL_RESULT; payload: ToolPayload }
  | { type: TraceEventType.TOOL_ERROR; payload: ToolPayload }
  | { type: TraceEventType.FINISH; payload?: Record<string, unknown> }
  | {
      type: TraceEventType.ERROR;
      payload?: { error?: unknown; detail?: unknown };
      detail?: unknown;
    };

export type TraceEvent = TraceEventData & {
  receivedAt?: number;
};

export type DoneEvent = {
  type: "done";
  docx_b64?: string;
  edit_count?: number;
  summary?: string;
};

export const DocumentUpdateSchema = z.object({
  type: z.literal("edit_applied"),
  docx_b64: z.string().check(z.minLength(1)),
  edit_count: z.number().check(z.nonnegative()),
  revision: z.int().check(z.nonnegative()),
});

export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;

export type HealthResponse = {
  availableModels?: string[];
  defaultModel?: string;
};
