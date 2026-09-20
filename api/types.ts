import { z } from "zod";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  SUPPORTED_IMAGE_MIME_TYPES,
  type ChatMessage,
} from "../shared/messages";

export type { ChatMessage } from "../shared/messages";

const Base64ImageSchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, context) => {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
      context.addIssue({ code: "custom", message: "invalid image base64" });
      return;
    }
    const payload = Buffer.from(value, "base64");
    if (!payload.length || payload.toString("base64") !== value) {
      context.addIssue({ code: "custom", message: "invalid image base64" });
    } else if (payload.length > MAX_IMAGE_BYTES) {
      context.addIssue({
        code: "custom",
        message: `image exceeds ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`,
      });
    }
  });

const UserMessagePartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1) }),
  z.object({
    type: z.literal("image"),
    image: Base64ImageSchema,
    mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
  }),
]);

const UserMessagePartsSchema = z
  .array(UserMessagePartSchema)
  .min(1)
  .superRefine((parts, context) => {
    const imageCount = parts.filter((part) => part.type === "image").length;
    if (imageCount > MAX_IMAGES_PER_MESSAGE) {
      context.addIssue({
        code: "custom",
        message: `at most ${MAX_IMAGES_PER_MESSAGE} images per message`,
      });
    }
  });

const ChatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.union([z.string().trim().min(1), UserMessagePartsSchema]),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1),
  }),
]);

export const ChatMessagesSchema = z.array(ChatMessageSchema);

export function parseChatMessages(raw: unknown): ChatMessage[] {
  if (typeof raw !== "string" || !raw.trim()) return [];

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("messages must be valid JSON");
  }
  const parsed = ChatMessagesSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "unknown validation error"
    );
  }
  return parsed.data;
}

export const EditPairSchema = z.object({
  old: z.string(),
  new: z.string().default(""),
});

export type EditPair = z.infer<typeof EditPairSchema>;

export const DocumentSessionSchema = z
  .object({
    session_id: z.string().min(1),
    current_revision: z.number().int().nonnegative(),
  })
  .transform(({ session_id, current_revision }) => ({
    id: session_id,
    revision: current_revision,
  }));

export type DocumentSession = z.infer<typeof DocumentSessionSchema>;

export const McpToolResultSchema = z.record(z.string(), z.unknown());

export type McpToolResult = z.infer<typeof McpToolResultSchema>;

export const CommittedDocumentSchema = z
  .object({
    ok: z.literal(true),
    base64: z.string().min(1),
    current_revision: z.number().int().nonnegative(),
    count: z.number().nonnegative().default(0),
  })
  .transform(({ base64, current_revision, count }) => ({
    base64,
    revision: current_revision,
    count,
  }));

export type CommittedDocument = z.infer<typeof CommittedDocumentSchema>;

export interface EditInputParser {
  readonly ended: boolean;
  write(delta: string): void;
  finish(): void;
}

export interface ActiveEditInput {
  batchId: string;
  parser: EditInputParser;
}

export interface RunAgentTurnOptions {
  docBytes: Buffer;
  messages: ChatMessage[];
  author: string;
  mcpUrl: string;
  apiKey: string;
  trackChanges: boolean;
  model?: string;
  signal?: AbortSignal;
}
