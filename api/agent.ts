import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { MCPClient } from "@mastra/mcp";
import {
  DEFAULT_MODEL,
  MAX_ROUNDS,
  META_AUTHOR,
  META_BATCH_ID,
  META_EDIT_INDEX,
  META_SESSION_ID,
  META_TRACK_CHANGES,
  WORD_AGENT_REASONING_EFFORT,
  WORD_AGENT_REASONING_SUMMARY,
} from "./config";
import { createEditInputParser } from "./edit-input";
import { closeDocumentSession, openDocumentSession } from "./http";
import {
  CommittedDocumentSchema,
  McpToolResultSchema,
  type ActiveEditInput,
  type CommittedDocument,
  type EditPair,
  type RunAgentTurnOptions,
} from "./types";

const SYSTEM_PROMPT = `You are a DOCX editing assistant. You will receive an existing Word document and a natural-language instruction describing changes to make.

Your job is to apply the requested changes to the document using the tools available to you.

Hard requirements:
- Edit the existing document. Do NOT regenerate it from scratch. Preserve all formatting, styles, headings, tables, numbering, headers/footers, images, and any content not explicitly targeted by the instruction.
- Apply visible content modifications through edit_document. The add-in configures whether they appear as tracked changes or directly in place.
- Make the smallest, most surgical edits that satisfy the instruction.

Use the tools available to you to read, navigate, and edit the document.`;

export async function* runAgentTurn(opts: RunAgentTurnOptions) {
  const session = await openDocumentSession({
    mcpUrl: opts.mcpUrl,
    apiKey: opts.apiKey,
    document: opts.docBytes,
    signal: opts.signal,
  });
  const mcp = new MCPClient({
    id: randomUUID(),
    servers: {
      vespperDocx: {
        url: new URL(opts.mcpUrl),
        requestInit: {
          headers: { Authorization: `Bearer ${opts.apiKey}` },
        },
      },
    },
  });
  try {
    const tools: any = await mcp.listTools();
    const mcpRead = tools.vespperDocx_read_document;
    const mcpSearch = tools.vespperDocx_search_document;
    const mcpEdit = tools.vespperDocx_edit_document;
    if (!mcpRead || !mcpSearch || !mcpEdit) {
      throw new Error(
        "MCP server did not advertise read_document, search_document, and edit_document"
      );
    }

    let docx_b64 = opts.docBytes.toString("base64");
    let editCount = 0;
    let latestRevision = session.revision;
    const output = new PassThrough({ objectMode: true });
    const childCalls: Promise<void>[] = [];
    let activeInput: ActiveEditInput | undefined;

    function publishDocument(out: unknown): CommittedDocument | undefined {
      const parsed = CommittedDocumentSchema.safeParse(out);
      if (!parsed.success) return;
      const { base64, revision, count } = parsed.data;
      if (revision <= latestRevision) return parsed.data;
      latestRevision = revision;
      docx_b64 = base64;
      output.write({
        type: "edit_applied",
        docx_b64: base64,
        edit_count: count,
        revision,
      });
      return parsed.data;
    }

    function clearInput(toolCallId: string): void {
      if (activeInput?.batchId === toolCallId) activeInput = undefined;
    }

    function sendEdit(
      toolCallId: string,
      abortSignal: AbortSignal | undefined,
      index: number,
      edit: EditPair
    ): void {
      childCalls.push(
        mcpEdit
          .execute(
            { edits: [edit] },
            {
              _meta: {
                [META_SESSION_ID]: session.id,
                [META_BATCH_ID]: toolCallId,
                [META_EDIT_INDEX]: index,
                [META_AUTHOR]: opts.author,
                [META_TRACK_CHANGES]: opts.trackChanges,
              },
              abortSignal,
            }
          )
          .then((out: unknown) => void publishDocument(out))
          .catch(() => {
            // The final call starts a missing candidate or reports its failure.
          })
      );
    }

    const sessionMeta = { [META_SESSION_ID]: session.id };

    const read_document = createTool({
      id: "read_document",
      description: mcpRead.description,
      inputSchema: mcpRead.inputSchema,
      execute: async (input, context) =>
        mcpRead.execute(input, {
          _meta: sessionMeta,
          abortSignal: context.abortSignal,
        }),
    });
    const search_document = createTool({
      id: "search_document",
      description: mcpSearch.description,
      inputSchema: mcpSearch.inputSchema,
      execute: async (input, context) =>
        mcpSearch.execute(input, {
          _meta: sessionMeta,
          abortSignal: context.abortSignal,
        }),
    });
    const edit_document = createTool({
      id: "edit_document",
      description: mcpEdit.description,
      inputSchema: mcpEdit.inputSchema,
      onInputStart: ({ toolCallId, abortSignal }) => {
        if (activeInput && !activeInput.parser.ended) {
          throw new Error("parallel edit_document calls are unsupported");
        }
        const parser = createEditInputParser({
          onEdit: sendEdit.bind(null, toolCallId, abortSignal),
          onError: clearInput.bind(null, toolCallId),
        });
        activeInput = { batchId: toolCallId, parser };
      },
      onInputDelta: ({ toolCallId, inputTextDelta }) => {
        if (activeInput?.batchId !== toolCallId) {
          throw new Error("unexpected edit input stream");
        }
        activeInput.parser.write(inputTextDelta);
      },
      onInputAvailable: ({ toolCallId }) => {
        const input = activeInput;
        if (input?.batchId !== toolCallId) return;
        input.parser.finish();
        activeInput = undefined;
      },
      execute: async (input, context) => {
        const batchId = context.agent?.toolCallId;
        if (!batchId) throw new Error("edit_document has no tool call ID");
        await Promise.allSettled([...childCalls]);
        const out = McpToolResultSchema.parse(
          await mcpEdit.execute(input, {
            _meta: {
              [META_SESSION_ID]: session.id,
              [META_BATCH_ID]: batchId,
              [META_AUTHOR]: opts.author,
              [META_TRACK_CHANGES]: opts.trackChanges,
            },
            abortSignal: context.abortSignal,
          })
        );
        const committed = publishDocument(out);
        const { base64: _base64, ...modelResult } = out;
        if (committed) editCount += committed.count;
        return modelResult;
      },
    });

    const agent = new Agent({
      id: "word-add-in-editor",
      name: "Word Add-in Editor",
      instructions: SYSTEM_PROMPT,
      model: opts.model || DEFAULT_MODEL,
      tools: { read_document, search_document, edit_document },
    });

    const stream = await agent.stream(opts.messages, {
      maxSteps: MAX_ROUNDS,
      abortSignal: opts.signal,
      providerOptions: {
        openai: {
          reasoningSummary: WORD_AGENT_REASONING_SUMMARY,
          reasoningEffort: WORD_AGENT_REASONING_EFFORT,
        },
      },
    });

    const mastraOutput = Readable.from(stream.fullStream, {
      objectMode: true,
    });
    mastraOutput.pipe(output, { end: false });

    const completion = (async () => {
      try {
        await finished(mastraOutput);
        await Promise.allSettled(childCalls);
        output.end({
          type: "done",
          docx_b64,
          edit_count: editCount,
        });
      } catch (error) {
        output.destroy(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    })();

    for await (const event of output) {
      yield event;
    }

    await completion;
  } finally {
    try {
      await closeDocumentSession({
        mcpUrl: opts.mcpUrl,
        apiKey: opts.apiKey,
        sessionId: session.id,
      });
    } catch (error) {
      console.error(error);
    } finally {
      await mcp.disconnect();
    }
  }
}
