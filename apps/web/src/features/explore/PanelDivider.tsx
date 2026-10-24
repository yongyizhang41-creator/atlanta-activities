"use client";
import { useEffect, useRef, useState } from "react";
import { splitRatio } from "./splitWidth";

const storageKey = "atl-explore-split";
export default function PanelDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(0.6);
  const dragging = useRef(false);
  function apply(value: number) {
    const next = Math.min(0.8, Math.max(0.2, value));
    ref.current?.parentElement?.style.setProperty("--list-track", `${next}fr`);
    ref.current?.parentElement?.style.setProperty(
      "--map-track",
      `${1 - next}fr`,
    );
    setRatio(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      /* in-page resize still works */
    }
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null && Number.isFinite(Number(saved)))
        apply(Number(saved));
    } catch {
      /* storage is optional */
    }
  }, []);
  function available() {
    const parent = ref.current?.parentElement;
    const list = parent?.querySelector(".activities")?.getBoundingClientRect();
    const map = parent
      ?.querySelector(".discovery-map")
      ?.getBoundingClientRect();
    return list && map
      ? { left: list.left, width: list.width + map.width }
      : null;
  }
  return (
    <div
      ref={ref}
      className="panel-divider"
      role="separator"
      aria-label="Resize activities and map"
      aria-orientation="vertical"
      aria-valuemin={20}
      aria-valuemax={80}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={`Activities ${Math.round(ratio * 100)}%, map ${Math.round((1 - ratio) * 100)}%`}
      tabIndex={0}
      title="Drag to resize · Double-click to reset"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus();
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const bounds = available();
        if (bounds) apply(splitRatio(e.clientX - bounds.left, bounds.width));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onLostPointerCapture={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onDoubleClick={() => apply(0.6)}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
        e.preventDefault();
        if (e.key === "Home") {
          apply(0.6);
          return;
        }
        const bounds = available();
        if (bounds)
          apply(
            splitRatio(
              (ratio + (e.key === "ArrowRight" ? 0.02 : -0.02)) * bounds.width,
              bounds.width,
            ),
          );
      }}
    >
      <span />
    </div>
  );
}
