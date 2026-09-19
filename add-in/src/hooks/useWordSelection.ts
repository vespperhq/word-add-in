import { useCallback, useEffect, useRef, useState } from "react";

async function getSelectedContent(): Promise<string> {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    return selection.text.trim();
  });
}

export function useWordSelection() {
  const [selectedContent, setSelectedContent] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let registered = false;

    const refreshSelection = async () => {
      const requestId = ++requestIdRef.current;
      try {
        const content = await getSelectedContent();
        if (!disposed && requestId === requestIdRef.current) {
          setSelectedContent(content);
        }
      } catch {
        if (!disposed && requestId === requestIdRef.current) {
          setSelectedContent("");
        }
      }
    };

    const handleSelectionChanged = () => {
      void refreshSelection();
    };
    const removeHandler = () => {
      Office.context.document.removeHandlerAsync(
        Office.EventType.DocumentSelectionChanged,
        { handler: handleSelectionChanged }
      );
    };

    void refreshSelection();
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handleSelectionChanged,
      (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) return;
        registered = true;
        if (disposed) removeHandler();
      }
    );

    return () => {
      disposed = true;
      requestIdRef.current += 1;
      if (registered) removeHandler();
    };
  }, []);

  const clearSelectedContent = useCallback(() => {
    requestIdRef.current += 1;
    setSelectedContent("");
  }, []);

  return { selectedContent, clearSelectedContent };
}
