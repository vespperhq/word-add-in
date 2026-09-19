import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getImageDataUrl, getImageTypeLabel } from "../images";
import type { MessageImage } from "../types";
import { Icon } from "./Icon";

type ImageAttachmentsProps = {
  images: MessageImage[];
  variant?: "composer" | "message";
  onRemove?: (id: string) => void;
};

export function ImageAttachments({
  images,
  variant = "composer",
  onRemove,
}: ImageAttachmentsProps) {
  const [preview, setPreview] = useState<MessageImage>();

  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(undefined);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [preview]);

  if (!images.length) return null;

  const isComposer = variant === "composer";

  return (
    <>
      <div
        className={
          isComposer
            ? "flex max-w-full gap-2 overflow-x-auto px-3 pt-3 pb-1"
            : "flex max-w-full gap-2 overflow-x-auto"
        }
      >
        {images.map((image) => (
          <div key={image.id} className="group relative shrink-0 p-1">
            <button
              type="button"
              className={`relative block overflow-hidden rounded-lg border border-muted-foreground/40 bg-background text-left shadow-sm hover:border-brand ${
                isComposer ? "size-24" : "size-20"
              }`}
              title={`Preview ${image.name}`}
              onClick={() => setPreview(image)}
            >
              <img
                src={getImageDataUrl(image)}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
              <span className="absolute inset-x-1.5 top-1.5 truncate rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                {image.name}
              </span>
              <span className="absolute bottom-1.5 left-1.5 rounded border border-border bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
                {getImageTypeLabel(image)}
              </span>
            </button>
            {onRemove ? (
              <button
                type="button"
                className="absolute top-0 right-0 inline-flex size-5 items-center justify-center rounded-full border border-muted-foreground/50 bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-foreground"
                title={`Remove ${image.name}`}
                aria-label={`Remove ${image.name}`}
                onClick={() => {
                  if (preview?.id === image.id) setPreview(undefined);
                  onRemove(image.id);
                }}
              >
                <Icon name="close" className="size-3" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {preview
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Preview ${preview.name}`}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
              onClick={() => setPreview(undefined)}
            >
              <button
                type="button"
                className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full bg-background text-foreground shadow-lg hover:bg-muted"
                title="Close image preview"
                aria-label="Close image preview"
                onClick={() => setPreview(undefined)}
              >
                <Icon name="close" className="size-5" />
              </button>
              <img
                src={getImageDataUrl(preview)}
                alt={preview.name}
                className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
