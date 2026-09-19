import type { TracePart } from "../types";
import { formatMilliseconds } from "../utils/time";
import { Icon } from "./Icon";
import { JsonHighlight } from "./JsonHighlight";

const TOOL_DISPLAY: Record<
  string,
  { label: string; verb: string; icon: string }
> = {
  read_document: {
    label: "Reading document",
    verb: "Read document",
    icon: "read",
  },
  search_document: {
    label: "Searching document",
    verb: "Searched document",
    icon: "search",
  },
  edit_document: {
    label: "Editing document",
    verb: "Edited document",
    icon: "edit",
  },
};

function editChangeCount(p: TracePart): number | null {
  const c = p.output?.count;
  if (typeof c === "number") return c;
  const edits = p.input?.edits;
  return Array.isArray(edits) ? edits.length : null;
}

function toolError(part: TracePart): string | undefined {
  const out = part.output;
  if (!out) return undefined;
  if (typeof out.error === "string") return out.error;
  if (out.ok === false) return String(out.message ?? "failed");
  return undefined;
}

function getToolTiming(part: TracePart): string | null {
  const segments: string[] = [];
  if (typeof part.argsMs === "number") {
    segments.push(`args ${formatMilliseconds(part.argsMs)}`);
  }
  if (typeof part.runMs === "number") {
    segments.push(`run ${formatMilliseconds(part.runMs)}`);
  }
  return segments.length ? `(${segments.join(" · ")})` : null;
}

type ToolCallRowProps = {
  part: TracePart;
  onToggle: () => void;
};

export function ToolCallRow({ part, onToggle }: ToolCallRowProps) {
  const name = part.name ?? "tool";
  const display = TOOL_DISPLAY[name] ?? {
    label: name,
    verb: name,
    icon: "tool",
  };
  const streaming = part.state === "input-streaming";
  const complete = part.state === "output-available";
  const error = toolError(part);

  let primary: string;
  let detail = "";
  if (name === "edit_document") {
    const n = editChangeCount(part);
    const noun = n === 1 ? "change" : "changes";
    if (error) primary = "Edit failed";
    else if (complete)
      primary = n != null ? `Applied ${n} ${noun}` : display.verb;
    else if (streaming) primary = "Editing document";
    else primary = n != null ? `Applying ${n} ${noun}` : "Applying changes";
  } else if (name === "read_document") {
    primary = error ? "Read failed" : complete ? display.verb : display.label;
    const tokens = part.output?.approx_tokens;
    if (!error && typeof tokens === "number") {
      detail = `${tokens.toLocaleString()} tokens`;
    }
  } else if (name === "search_document") {
    primary = error ? "Search failed" : complete ? display.verb : display.label;
    const total = part.output?.total_matches;
    if (!error && typeof total === "number") {
      const noun = total === 1 ? "match" : "matches";
      detail = `${total.toLocaleString()} ${noun}`;
    }
  } else {
    primary = complete ? display.verb : display.label;
  }

  const timing = getToolTiming(part);
  const argsText = part.argsText?.trim() ?? "";
  const hasBox = argsText !== "" && argsText !== "{}";
  const iconName = !complete ? "loader" : error ? "alert" : display.icon;
  const primaryClass = error
    ? "text-destructive"
    : complete
    ? "text-foreground"
    : "text-muted-foreground";
  const headerClass = `group flex w-full items-start gap-2 border-0 bg-transparent p-0 text-left text-xs leading-snug text-muted-foreground ${
    hasBox ? "cursor-pointer" : ""
  } ${error ? "text-destructive" : ""}`;
  const headerBody = (
    <>
      <Icon
        name={iconName}
        className={`mt-px ${!complete ? "animate-spin" : ""} ${
          error ? "text-destructive" : ""
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className={primaryClass}>{primary}</span>
        {detail ? (
          <span className="text-muted-foreground/70">{` · ${detail}`}</span>
        ) : null}
        {timing ? (
          <span className="text-muted-foreground/70">{` ${timing}`}</span>
        ) : null}
        {error ? (
          <span className="text-destructive/85">{` — ${error}`}</span>
        ) : null}
      </span>
      {hasBox ? (
        <Icon
          name="chevron"
          className={`mt-px ml-auto transition-all duration-150 ${
            part.open
              ? "rotate-90 opacity-60"
              : "opacity-0 group-hover:opacity-60"
          }`}
        />
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col">
      {hasBox ? (
        <button type="button" className={headerClass} onClick={onToggle}>
          {headerBody}
        </button>
      ) : (
        <div className={headerClass}>{headerBody}</div>
      )}
      {hasBox && part.open && part.argsText ? (
        <JsonHighlight json={part.argsText} follow={streaming} />
      ) : null}
    </div>
  );
}
