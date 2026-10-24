import { expect, it } from "vitest";
import { readChatStream } from "./chat-stream";
it("reads split Unicode deltas and completion", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"type":"delta","text":"你好"}\n\ndata: {"type":"done","session_id":"s1"}\n\n',
  );
  const events: unknown[] = [];
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, 34));
      c.enqueue(bytes.slice(34));
      c.close();
    },
  });
  await readChatStream(body, (e) => events.push(e));
  expect(events).toEqual([
    { type: "delta", text: "你好" },
    { type: "done", session_id: "s1" },
  ]);
});
it("rejects interrupted streams", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.close();
    },
  });
  await expect(readChatStream(body, () => {})).rejects.toThrow();
});
