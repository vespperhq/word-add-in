import { useEffect, useRef, type RefObject } from "react";

const STICK_THRESHOLD_PX = 48;

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD_PX;
}

export function useStickToBottom(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[]
): void {
  const stick = useRef(true);
  const lastTop = useRef(0);
  const nonce = deps.join("\0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const movedUp = el.scrollTop < lastTop.current;
      lastTop.current = el.scrollTop;
      if (movedUp) stick.current = false;
      else if (isNearBottom(el)) stick.current = true;
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new MutationObserver(() => {
      if (!stick.current) return;
      el.scrollTop = el.scrollHeight;
      lastTop.current = el.scrollTop;
    });
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
    lastTop.current = el.scrollTop;
  }, [nonce, ref]);
}
