"use client";
import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

export default function CityBackdrop() {
  const reduced = useReducedMotion();
  const scene = useRef<HTMLDivElement>(null);
  const targetX = useMotionValue(0),
    targetY = useMotionValue(0);
  const x = useSpring(targetX, { stiffness: 32, damping: 22 });
  const y = useSpring(targetY, { stiffness: 32, damping: 22 });
  useEffect(() => {
    if (reduced || !matchMedia("(hover: hover) and (pointer: fine)").matches) {
      targetX.set(0);
      targetY.set(0);
      return;
    }
    const move = (e: PointerEvent) => {
      targetX.set((e.clientX / innerWidth - 0.5) * -12);
      targetY.set((e.clientY / innerHeight - 0.5) * -8);
    };
    const reset = () => {
      targetX.set(0);
      targetY.set(0);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [reduced, targetX, targetY]);
  useEffect(() => {
    const visibility = () => {
      if (scene.current)
        scene.current.style.animationPlayState = document.hidden
          ? "paused"
          : "running";
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  return (
    <motion.div
      aria-hidden="true"
      className="city-backdrop"
      style={reduced ? { x: 0, y: 0 } : { x, y }}
    >
      <div ref={scene} className="city-backdrop-scene" />
    </motion.div>
  );
}
