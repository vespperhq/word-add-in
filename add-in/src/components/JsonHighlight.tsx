import { useEffect, useRef } from "react";

type JsonHighlightProps = {
  json: string;
  follow: boolean;
};

export function JsonHighlight({ json, follow }: JsonHighlightProps) {
  const previewRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !follow) return;
    const frame = requestAnimationFrame(() => {
      preview.scrollTop = preview.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [follow, json]);

  return (
    <pre
      ref={previewRef}
      className="mt-1 ml-5.5 max-h-44 overflow-auto rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs leading-normal wrap-break-word whitespace-pre-wrap text-foreground"
    >
      {json}
    </pre>
  );
}
