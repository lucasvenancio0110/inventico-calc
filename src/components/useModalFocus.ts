import { useEffect } from "react";
export function useModalFocus(open: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const background = document.querySelectorAll<HTMLElement>("main,aside");
    background.forEach((el) => (el.inert = true));
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'input,select,button:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
    elements()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
      if (e.key === "Tab") {
        const items = elements(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      background.forEach((el) => (el.inert = false));
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [open, onEscape]);
}
