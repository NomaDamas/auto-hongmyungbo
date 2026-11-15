import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface Props {
  anchor: RefObject<HTMLElement | null>;
  align: "left" | "right";
  width: number;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Popover rendered into document.body at the anchor's viewport position, so dockview
 * panels (overflow: hidden) never clip it. Clamped to the viewport; flips above when
 * there is more room there. Closes on outside pointerdown (anchor excluded) and Esc.
 */
export function Popover({ anchor, align, width, onClose, className = "", children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const margin = 8;
      const h = panel.current?.offsetHeight ?? 0;
      const below = window.innerHeight - a.bottom - margin * 2;
      const above = a.top - margin * 2;
      const up = h > below && above > below;
      const left = Math.min(Math.max(margin, align === "right" ? a.right - width : a.left), window.innerWidth - width - margin);
      const maxHeight = Math.max(160, up ? above : below);
      const top = up ? Math.max(margin, a.top - margin - Math.min(h, maxHeight)) : a.bottom + margin;
      setPos({ left, top, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, align, width]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panel}
      className={`glass fixed z-[60] overflow-y-auto ${className}`}
      style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}
