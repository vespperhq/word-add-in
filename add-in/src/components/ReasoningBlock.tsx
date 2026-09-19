import ReactMarkdown from "react-markdown";
import type { TracePart } from "../types";
import { formatMilliseconds } from "../utils/time";
import { Icon } from "./Icon";

type ReasoningBlockProps = {
  part: TracePart;
  onToggle: () => void;
};

export function ReasoningBlock({ part, onToggle }: ReasoningBlockProps) {
  if (!part.text) return null;
  const active = part.thinkMs == null;
  return (
    <div className="group/think text-xs leading-snug text-muted-foreground">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={Boolean(part.open)}
        className="flex w-full cursor-pointer items-start gap-2 border-0 bg-transparent p-0 text-left text-xs leading-snug text-muted-foreground"
      >
        <Icon
          name={active ? "loader" : "think"}
          className={`mt-px ${active ? "animate-spin" : ""}`}
        />
        <span className="text-muted-foreground">
          {typeof part.thinkMs === "number"
            ? `Thought for ${formatMilliseconds(part.thinkMs)}`
            : "Thinking"}
        </span>
        <Icon
          name="chevron"
          className={`mt-px ml-auto transition-all duration-150 ${
            part.open
              ? "rotate-90 opacity-60"
              : "opacity-0 group-hover/think:opacity-60"
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
          part.open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-1 ml-5.5 text-xs leading-relaxed wrap-break-word text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:pl-4 [&_p]:my-1 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:my-1 [&_ul]:pl-4">
            <ReactMarkdown>{part.text}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
