// Pace rendering independently of network chunk size, including buffered responses.
export function createTypewriter(render: (text: string) => void) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let pending: string[] = [];
  let visible = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  let waiters: (() => void)[] = [];
  function settle() {
    clearInterval(timer);
    timer = undefined;
    waiters.splice(0).forEach((resolve) => resolve());
  }
  return {
    push(text: string) {
      if (cancelled) return;
      pending.push(
        ...Array.from(segmenter.segment(text), (part) => part.segment),
      );
      if (timer !== undefined || !pending.length) return;
      timer = setInterval(() => {
        visible += pending.shift()!;
        render(visible);
        if (!pending.length) settle();
      }, 25);
    },
    drain() {
      return pending.length
        ? new Promise<void>((resolve) => waiters.push(resolve))
        : Promise.resolve();
    },
    cancel() {
      cancelled = true;
      pending = [];
      settle();
    },
  };
}
