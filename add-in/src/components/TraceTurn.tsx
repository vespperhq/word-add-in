import ReactMarkdown from "react-markdown";
import type { Turn } from "../types";
import { Icon } from "./Icon";
import { ImageAttachments } from "./ImageAttachments";
import { ReasoningBlock } from "./ReasoningBlock";
import { ToolCallRow } from "./ToolCallRow";

type TraceTurnProps = {
  turn: Turn;
  onTogglePart: (id: string) => void;
};

export function TraceTurn({ turn, onTogglePart }: TraceTurnProps) {
  return (
    <div className="flex flex-col gap-3">
      {turn.instruction.trim() || turn.images.length ? (
        <div className="flex justify-end">
          <div className="flex max-w-[85%] min-w-0 flex-col items-end gap-2">
            <ImageAttachments images={turn.images} variant="message" />
            {turn.instruction.trim() ? (
              <div className="rounded-lg bg-brand px-3 py-2 text-[13px] wrap-break-word whitespace-pre-wrap text-white">
                {turn.instruction}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex w-full">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {turn.parts.map((part) => {
            if (part.kind === "reasoning") {
              return (
                <ReasoningBlock
                  key={part.id}
                  part={part}
                  onToggle={() => onTogglePart(part.id)}
                />
              );
            }
            if (part.kind === "tool") {
              return (
                <ToolCallRow
                  key={part.id}
                  part={part}
                  onToggle={() => onTogglePart(part.id)}
                />
              );
            }
            if (!part.text?.trim()) return null;
            return (
              <div
                key={part.id}
                className={`text-[13px] wrap-break-word [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-brand [&_a]:underline [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 ${
                  turn.summarySuperseded
                    ? "text-muted-foreground line-through decoration-destructive/60"
                    : "text-foreground"
                }`}
              >
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          })}
          {turn.error ? (
            <div className="flex items-start gap-2 text-xs leading-snug text-destructive">
              <Icon name="alert" className="mt-px text-destructive" />
              <span className="text-destructive">{turn.error}</span>
            </div>
          ) : null}
          {turn.note ? (
            <div className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
              <Icon name="stop" className="mt-px" />
              <span className="text-muted-foreground/70">{turn.note}</span>
            </div>
          ) : null}
          {turn.working ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="loader" className="animate-spin" />
              working…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
