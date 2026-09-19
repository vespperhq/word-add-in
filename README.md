# Vespper Word add-in

A complete Microsoft Word add-in example that connects a Mastra agent to
[Vespper](https://vespper.com). It reads the open document, streams tracked
changes back into Word, and keeps API keys in a local Node.js server rather
than the browser task pane.

```text
Word → React task pane → local Node.js server → Mastra agent → Vespper MCP
```

The example includes streamed edits, document sessions, selected-text context,
pasted image context, model selection, cancellation, and tracked-change author
settings.

## Prerequisites

- Microsoft Word desktop for macOS or Windows
- Node.js 22.13 or newer
- A [Vespper account](https://app.vespper.com)
- A model-provider API key for OpenAI, Anthropic, or Google

## 1. Get a Vespper API key

1. [Sign up for Vespper](https://app.vespper.com).
2. Open the [API keys page](https://app.vespper.com/keys).
3. Create a key and copy the `sk_live_...` secret immediately. It is shown only
   once.

## 2. Install the example

From the repository root:

```bash
cd word-add-in
npm install
```

```bash
# macOS or Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

```bash
npm run setup:certs
```

Edit `.env` and add your Vespper key plus the key for the model provider you
want to use:

```bash
VESPPER_API_KEY=sk_live_your_key_here
VESPPER_MCP_URL=https://mcp.vespper.com/mcp

OPENAI_API_KEY=sk-your_openai_key_here
```

Only one model-provider key is required:

| Model family     | Environment variable                               |
| ---------------- | -------------------------------------------------- |
| OpenAI GPT       | `OPENAI_API_KEY`                                   |
| Anthropic Claude | `ANTHROPIC_API_KEY`                                |
| Google Gemini    | `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` |

OpenAI GPT 5.5 is the default. To start with another model, set
`WORD_AGENT_MODEL` in `.env`, for example:

```bash
WORD_AGENT_MODEL=anthropic/claude-sonnet-4.5
```

## 3. Run it

```bash
npm start
```

This builds the task pane, starts the local HTTPS server at
`https://localhost:3100`, launches Word, and sideloads the manifest. If the
task pane does not open automatically, use **Home → Add-ins → Vespper**.

To verify configuration, open [https://localhost:3100/health](https://localhost:3100/health).
Both `vespperConfigured` and `agentConfigured` should be `true`.

Stop and unregister the development add-in with:

```bash
npm stop
```

## Try an edit

1. Open and save a Word document.
2. Open the Vespper task pane.
3. Ask for an edit, such as `Replace every occurrence of DFAT with Hello`.
4. Optionally select document text or paste images into the prompt.
5. Review the streamed edits under **Review → Track Changes**.

The settings button lets you change the tracked-change author from the default
`Vespper Agent`.

## Development commands

| Command                     | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `npm start`                 | Build, serve, launch Word, and sideload the add-in |
| `npm stop`                  | Stop and unregister the sideloaded add-in          |
| `npm run dev`               | Build and serve without launching Word             |
| `npm run typecheck`         | Type-check the server and task pane                |
| `npm run build:addin`       | Build the task-pane assets once                    |
| `npm run setup:certs:check` | Verify the local HTTPS certificate                 |

## Project layout

```text
word-add-in/
├── api/                 Local HTTPS server and Mastra agent
├── add-in/
│   ├── manifest.xml     Office add-in manifest
│   └── src/             React task pane and Office.js integration
├── shared/              Message contracts shared by client and server
├── .env.example
└── package.json
```

## Security

`.env` is ignored by Git. Vespper and model-provider keys are read only by the
local Node.js server and are never bundled into the Word task pane.

## License

[MIT](./LICENSE)
