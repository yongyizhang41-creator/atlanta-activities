import type { Variants } from "motion/react";

export const cardSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 23,
  mass: 0.85,
};
export const layoutSpring = {
  type: "spring" as const,
  stiffness: 340,
  damping: 30,
};
export const controlSpring = {
  type: "spring" as const,
  stiffness: 440,
  damping: 24,
  mass: 0.6,
};
export const cardVariants: Variants = {
  rest: { y: 0, scale: 1, transition: cardSpring },
  hover: { y: -7, scale: 1.02, transition: cardSpring },
};
export const detailVariants: Variants = {
  rest: { x: 0, transition: cardSpring },
  hover: { x: 3, transition: { ...cardSpring, delay: 0.035 } },
};
export const entrance = (index: number, reduced: boolean) => ({
  initial: { opacity: 0, y: reduced ? 0 : 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: reduced ? 0 : -8, transition: { duration: 0.16 } },
  transition: {
    layout: layoutSpring,
    opacity: {
      duration: reduced ? 0.1 : 0.35,
      delay: reduced ? 0 : Math.min(index, 6) * 0.055,
    },
    y: { ...layoutSpring, delay: reduced ? 0 : Math.min(index, 6) * 0.055 },
  },
});

export const titleVariants: Variants = {
  rest: { x: 0, y: 0, transition: cardSpring },
  hover: { x: 2, y: -1, transition: { ...cardSpring, delay: 0.06 } },
};
export const actionVariants: Variants = {
  rest: { y: 0, transition: cardSpring },
  hover: { y: -2, transition: { ...cardSpring, delay: 0.09 } },
};
