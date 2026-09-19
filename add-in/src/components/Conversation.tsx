import { useConversation } from "../context/ChatContext";
import { useStickToBottom } from "../hooks/useStickToBottom";
import { TraceTurn } from "./TraceTurn";

export function Conversation() {
  const { conversationRef, turns, togglePart } = useConversation();
  const last = turns[turns.length - 1];
  useStickToBottom(conversationRef, [
    turns.length,
    last?.parts.length,
    last?.summary,
    last?.working,
  ]);
  const empty = turns.length === 0;

  return (
    <div
      id="conversation"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-10 pb-4"
      ref={conversationRef}
    >
      {empty ? (
        <div className="rounded-lg border border-border bg-background p-3.5">
          <p className="m-0 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Chat
          </p>
          <p className="mt-2 mb-0 text-[13px] leading-relaxed text-muted-foreground">
            Ask me to edit the open document — e.g.{" "}
            <em>“Replace every occurrence of DFAT with Hello”</em>. I&apos;ll
            read it via MCP, make tracked changes, and show my work here.{" "}
            <strong>Save the document first</strong> (⌘S).
          </p>
        </div>
      ) : null}

      {turns.map((turn, i) => (
        <TraceTurn
          key={i}
          turn={turn}
          onTogglePart={(id) => togglePart(i, id)}
        />
      ))}
    </div>
  );
}
