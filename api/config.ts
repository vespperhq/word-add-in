import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const API_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(API_DIR, "..");

dotenv.config({ path: path.join(ROOT_DIR, ".env") });

export const ADDIN_DIR = path.join(ROOT_DIR, "add-in");
export const PORT = Number(process.env.PORT ?? 3100);
export const VESPPER_API_KEY = process.env.VESPPER_API_KEY ?? "";
export const DOCX_AUTHOR = process.env.DOCX_AUTHOR ?? "";
export const DEFAULT_MCP_URL = "https://mcp.vespper.com/mcp";
export const VESPPER_MCP_URL = (
  process.env.VESPPER_MCP_URL ?? DEFAULT_MCP_URL
).replace(/\/+$/, "");
export const WORD_AGENT_MODEL = process.env.WORD_AGENT_MODEL ?? "";
export const WORD_AGENT_REASONING_EFFORT =
  process.env.WORD_AGENT_REASONING_EFFORT || "medium";
export const WORD_AGENT_REASONING_SUMMARY =
  process.env.WORD_AGENT_REASONING_SUMMARY || "detailed";

export const META_BATCH_ID = "com.vespper/batch-id";
export const META_EDIT_INDEX = "com.vespper/edit-index";
export const AVAILABLE_MODELS = [
  "openai/gpt-5.6-sol",
  "openai/gpt-5.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-5",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
] as const;
export const DEFAULT_MODEL = WORD_AGENT_MODEL || AVAILABLE_MODELS[0];
export const MAX_ROUNDS = 24;

export function getModelApiKeyNames(model: string): string[] {
  const provider = model.includes("/")
    ? model.split("/", 1)[0]
    : model.startsWith("gpt-")
      ? "openai"
      : "";
  switch (provider) {
    case "openai":
      return ["OPENAI_API_KEY"];
    case "anthropic":
      return ["ANTHROPIC_API_KEY"];
    case "google":
      return ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"];
    default:
      return [];
  }
}

export function hasModelApiKey(model: string): boolean {
  return getModelApiKeyNames(model).some((name) => Boolean(process.env[name]));
}
