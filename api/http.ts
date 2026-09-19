import { DocumentSessionSchema, type DocumentSession } from "./types";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface SessionRequestOptions {
  mcpUrl: string;
  apiKey: string;
}

interface OpenDocumentSessionOptions extends SessionRequestOptions {
  document: Buffer;
  signal?: AbortSignal;
}

interface CloseDocumentSessionOptions extends SessionRequestOptions {
  sessionId: string;
}

async function getResponseError(
  response: Response,
  action: string
): Promise<Error> {
  const detail = await response.text();
  return new Error(
    `${action} failed (${response.status})${detail ? `: ${detail}` : ""}`
  );
}

export async function openDocumentSession({
  mcpUrl,
  apiKey,
  document,
  signal,
}: OpenDocumentSessionOptions): Promise<DocumentSession> {
  const response = await fetch(new URL("/v1/docx/sessions", mcpUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": DOCX_CONTENT_TYPE,
    },
    body: document,
    signal,
  });
  if (!response.ok) {
    throw await getResponseError(response, "Opening document session");
  }
  return DocumentSessionSchema.parse(await response.json());
}

export async function closeDocumentSession({
  mcpUrl,
  apiKey,
  sessionId,
}: CloseDocumentSessionOptions): Promise<void> {
  const response = await fetch(
    new URL(`/v1/docx/sessions/${encodeURIComponent(sessionId)}`, mcpUrl),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );
  if (!response.ok && response.status !== 404) {
    throw await getResponseError(response, "Closing document session");
  }
}
