import { expect, it, vi } from "vitest";
import { createTypewriter } from "./typewriter";

it("reveals a whole received chunk one character at a time and waits for playback", async () => {
  vi.useFakeTimers();
  const render = vi.fn();
  const writer = createTypewriter(render);
  writer.push("你好👨‍👩‍👧‍👦");
  expect(render).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(25);
  expect(render.mock.calls).toEqual([["你"]]);
  writer.push("！");
  const finished = vi.fn();
  const drained = writer.drain().then(finished);
  await vi.advanceTimersByTimeAsync(50);
  expect(render.mock.lastCall).toEqual(["你好👨‍👩‍👧‍👦"]);
  expect(finished).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(25);
  await drained;
  expect(render.mock.lastCall).toEqual(["你好👨‍👩‍👧‍👦！"]);
  writer.cancel();
  vi.useRealTimers();
});

it("cancels pending updates on close", async () => {
  vi.useFakeTimers();
  const render = vi.fn();
  const writer = createTypewriter(render);
  writer.push("pending");
  const drained = writer.drain();
  writer.cancel();
  await drained;
  await vi.advanceTimersByTimeAsync(1000);
  expect(render).not.toHaveBeenCalled();
  vi.useRealTimers();
});
