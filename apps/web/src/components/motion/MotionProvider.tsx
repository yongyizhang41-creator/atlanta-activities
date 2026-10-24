"use client";
import { useEffect } from "react";
import { animate, MotionConfig, useReducedMotion } from "motion/react";
import { controlSpring } from "./variants";

function ControlFeedback() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let pressedElement: HTMLElement | null = null;
    const running = new Map<HTMLElement, ReturnType<typeof animate>>();
    const eligible = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const el = target.closest<HTMLElement>(
        'button, a, select, input[type="checkbox"]',
      );
      if (
        !el ||
        el.matches(':disabled, [aria-disabled="true"], .event-title') ||
        el.closest(
          '.maplibregl-control-container, .plan-handle, [role="separator"]',
        )
      )
        return null;
      return el;
    };
    const move = (el: HTMLElement, pressed: boolean, hover: boolean) => {
      el.dataset.motionControl = "";
      running.get(el)?.stop();
      const primary = el.classList.contains("primary");
      const feedback = animate(
        el,
        {
          scale: pressed ? 0.96 : hover ? (primary ? 1.025 : 1.012) : 1,
          y: pressed ? 1 : hover ? (primary ? -2 : -1) : 0,
        },
        controlSpring,
      );
      running.set(el, feedback);
      feedback.then(() => {
        if (running.get(el) === feedback) running.delete(el);
      });
    };
    const over = (e: PointerEvent) => {
      const el = eligible(e.target);
      if (
        el &&
        e.pointerType === "mouse" &&
        !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))
      )
        move(el, false, true);
    };
    const out = (e: PointerEvent) => {
      const el = eligible(e.target);
      if (
        el &&
        !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))
      )
        move(el, false, false);
    };
    const down = (e: PointerEvent) => {
      const el = eligible(e.target);
      pressedElement = el;
      if (el) move(el, true, false);
    };
    const up = () => {
      const el = pressedElement;
      pressedElement = null;
      if (el)
        move(
          el,
          false,
          el.matches(":hover") && matchMedia("(hover: hover)").matches,
        );
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
      running.forEach((animation) => animation.stop());
      document
        .querySelectorAll<HTMLElement>("[data-motion-control]")
        .forEach((el) => {
          el.style.transform = "";
          delete el.dataset.motionControl;
        });
    };
  }, [reduced]);
  return null;
}
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <ControlFeedback />
      {children}
    </MotionConfig>
  );
}
