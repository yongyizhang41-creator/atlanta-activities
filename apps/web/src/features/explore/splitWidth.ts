export function splitRatio(left: number, available: number) {
  if (available <= 560) return 0.5;
  const min = Math.max(0.2, 280 / available);
  return Math.min(1 - min, Math.max(min, left / available));
}
