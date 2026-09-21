import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import {
  useChatComposer,
  useChatModels,
  useConversation,
} from "../context/ChatContext";
import { getPastedImageFiles } from "../images";
import { Icon } from "./Icon";
import { ImageAttachments } from "./ImageAttachments";

const MODEL_LABELS: Record<string, string> = {
  "gpt-5.5": "GPT 5.5",
  "gpt-5.6-sol": "GPT 5.6 Sol",
  "claude-sonnet-4.5": "Claude Sonnet 4.5",
  "claude-opus-5": "Claude Opus 5",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
};

function getModelLabel(id: string): string {
  const slash = id.lastIndexOf("/");
  const name = slash >= 0 ? id.slice(slash + 1) : id;
  return MODEL_LABELS[name] ?? name;
}

export function ChatInputBar() {
  const {
    instruction,
    setInstruction,
    selectedContent,
    clearSelectedContent,
    images,
    imageError,
    imagesLoading,
    addPastedImages,
    removeImage,
  } = useChatComposer();
  const { model, models, modelsLoading, setModel } = useChatModels();
  const { busy, send, stop } = useConversation();

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void send();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSend) void send();
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = getPastedImageFiles(e.clipboardData);
    if (!files.length) return;

    e.preventDefault();
    const pastedText = e.clipboardData.getData("text/plain");
    if (pastedText) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart ?? instruction.length;
      const end = textarea.selectionEnd ?? start;
      setInstruction(
        `${instruction.slice(0, start)}${pastedText}${instruction.slice(end)}`
      );
      requestAnimationFrame(() => {
        const cursor = start + pastedText.length;
        textarea.selectionStart = cursor;
        textarea.selectionEnd = cursor;
      });
    }
    void addPastedImages(files);
  }

  const selectedLabel = modelsLoading
    ? "Loading…"
    : model
    ? getModelLabel(model)
    : "Default";
  const canSend =
    !busy && !imagesLoading && Boolean(instruction.trim() || images.length);

  return (
    <form
      className="shrink-0 bg-transparent px-3 pt-2.5 pb-3"
      onSubmit={onSubmit}
    >
      <div className="overflow-hidden rounded-xl border border-muted-foreground/50 bg-background focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15">
        {selectedContent ? (
          <div className="flex items-center gap-2 border-b border-muted-foreground/50 bg-muted-foreground/20 px-3 py-2 text-[13px]">
            <p
              className="min-w-0 flex-1 truncate text-foreground"
              title={selectedContent}
            >
              “{selectedContent}”
            </p>
            <span className="shrink-0 text-foreground">selected</span>
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
              title="Remove selected content"
              aria-label="Remove selected content"
              onClick={clearSelectedContent}
            >
              <Icon name="close" />
            </button>
          </div>
        ) : null}
        <div className="relative">
          <ImageAttachments images={images} onRemove={removeImage} />
          {imagesLoading ? (
            <p className="mx-3 mt-2 mb-0 text-xs text-muted-foreground">
              Attaching image…
            </p>
          ) : imageError ? (
            <p className="mx-3 mt-2 mb-0 text-xs text-destructive">
              {imageError}
            </p>
          ) : null}
          <textarea
            id="instruction"
            rows={3}
            placeholder="Ask for an edit…"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="block min-h-18 w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <div className="absolute right-2 bottom-1.5 flex items-center gap-1.5">
            <label className="relative inline-flex cursor-pointer items-center">
              <span className="pointer-events-none inline-flex items-center gap-0.5 text-[13px] font-medium text-foreground">
                {selectedLabel}
                <Icon
                  name="chevron"
                  className="size-3 rotate-90 text-muted-foreground"
                />
              </span>
              <select
                title="Model"
                aria-label="Model"
                value={model}
                disabled={busy || modelsLoading}
                onChange={(e) => setModel(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              >
                {modelsLoading ? (
                  <option value="">Loading…</option>
                ) : models.length ? (
                  models.map((id) => (
                    <option key={id} value={id}>
                      {getModelLabel(id)}
                    </option>
                  ))
                ) : (
                  <option value="">Default</option>
                )}
              </select>
            </label>
            {busy ? (
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-full border border-destructive/45 bg-background text-destructive hover:bg-destructive/10"
                title="Stop generating"
                aria-label="Stop generating"
                onClick={stop}
              >
                <Icon name="stop" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex size-7 items-center justify-center rounded-full border-0 bg-brand text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
                title="Send"
                aria-label="Send"
              >
                <Icon name="send" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
