import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  onDelete: () => void;
  children: React.ReactNode;
  deleteLabel?: string;
}

const BTN_W = 76;
const OPEN_THRESHOLD = BTN_W * 0.45;

/**
 * Wraps children with swipe-left-to-reveal-delete UX on mobile.
 * On desktop the ✕ button in the child content serves as fallback.
 */
export function SwipeDeleteRow({ onDelete, children, deleteLabel = "מחק" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [animating, setAnimating] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const direction = useRef<"h" | "v" | null>(null);
  const isTouching = useRef(false);

  const snapTo = useCallback((target: number) => {
    setAnimating(true);
    setOffset(target);
    currentOffset.current = target;
    setIsOpen(target < -BTN_W * 0.5);
  }, []);

  const close = useCallback(() => snapTo(0), [snapTo]);
  const open = useCallback(() => snapTo(-BTN_W), [snapTo]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      isTouching.current = true;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      direction.current = null;
      setAnimating(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouching.current) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (direction.current === null) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        direction.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
      if (direction.current !== "h") return;

      e.preventDefault();

      const base = isOpen ? -BTN_W : 0;
      const raw = base + dx;
      const clamped = Math.min(4, Math.max(-BTN_W * 1.15, raw));
      currentOffset.current = clamped;
      setOffset(clamped);
    };

    const onTouchEnd = () => {
      if (!isTouching.current) return;
      isTouching.current = false;
      if (direction.current !== "h") return;

      if (currentOffset.current < -OPEN_THRESHOLD) {
        open();
      } else {
        close();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isOpen, open, close]);

  // Close on outside click when open
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isOpen, close]);

  return (
    <div ref={containerRef} className="swipe-delete-outer">
      <div
        className="swipe-delete-content"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? "transform 0.22s ease" : "none",
        }}
        onClick={isOpen ? close : undefined}
      >
        {children}
      </div>
      <button
        type="button"
        className="swipe-delete-btn"
        style={{ width: BTN_W }}
        onClick={(e) => {
          e.stopPropagation();
          close();
          onDelete();
        }}
        tabIndex={isOpen ? 0 : -1}
        aria-label={deleteLabel}
        aria-hidden={!isOpen}
      >
        <span className="material-symbols-outlined">delete</span>
        {deleteLabel}
      </button>
    </div>
  );
}
