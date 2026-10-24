"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Sparkles } from "lucide-react";
import { api, apiResponse, send } from "@/lib/api";
import { Notice } from "@/components/ui";
import { readChatStream } from "@/lib/chat-stream";
import { createTypewriter } from "@/lib/typewriter";
import AssistantMessage from "./AssistantMessage";
export default function ActivityChat({ eventId }: { eventId: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
      [],
    ),
    [text, setText] = useState(""),
    [session, setSession] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const playback = useRef<ReturnType<typeof createTypewriter> | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      playback.current?.cancel();
    },
    [eventId],
  );
  const scrollEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  useEffect(() => {
    let active = true;
    api<{
      items: { id: string; messages: { role: string; content: string }[] }[];
    }>("/events/" + eventId + "/chats")
      .then((d) => {
        if (active && d.items.length) {
          setSession(d.items[0].id);
          setMessages(d.items[0].messages);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    const question = text.trim();
    setText("");
    const previous = messages;
    setMessages([
      ...previous,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    const controller = new AbortController();
    request.current = controller;
    const writer = createTypewriter((content) => {
      setMessages((current) =>
        current.map((m, i) =>
          i === previous.length + 1 ? { ...m, content } : m,
        ),
      );
    });
    playback.current = writer;
    try {
      const response = await apiResponse("/events/" + eventId + "/chat", {
        ...send("POST", {
          message: question,
          session_id: session,
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!response.body)
        throw new Error("Streaming is unavailable. Please try again.");
      await readChatStream(response.body, (event) => {
        if (event.type === "done") setSession(event.session_id);
        if (event.type === "delta") writer.push(event.text);
      });
      await writer.drain();
    } catch (e) {
      if (controller.signal.aborted) return;
      setError((e as Error).message);
      setMessages(previous);
      setText(question);
    } finally {
      writer.cancel();
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="chat">
      <header>
        <h3>
          <Sparkles size={16} />
          Ask about this activity
        </h3>
        {session && (
          <button
            className="icon-button"
            aria-label="Delete conversation"
            disabled={busy}
            onClick={async () => {
              try {
                await api("/me/chats/" + session, send("DELETE"));
                setSession(null);
                setMessages([]);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>
      <p className="muted">
        Answers use event information and sources. Ask in any language.
      </p>
      {messages.length === 0 && (
        <div className="chat-prompts">
          {["Who can attend?", "Do I need tickets?"].map((q) => (
            <button key={q} className="small" onClick={() => setText(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="messages" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={"message " + m.role}>
            <small>{m.role === "user" ? "You" : "Activity assistant"}</small>
            {m.role === "assistant" ? (
              m.content ? (
                <AssistantMessage content={m.content} />
              ) : (
                <p role="status">Thinking…</p>
              )
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}
        <div ref={scrollEnd} />
      </div>
      {error && <Notice error>{error}</Notice>}
      <form noValidate onSubmit={submit} className="chat-input">
        <label htmlFor="chat-question" className="sr-only">
          Question about activity
        </label>
        <input
          id="chat-question"
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder="What would you like to know?"
        />
        <button
          className="primary icon-button"
          aria-label="Send question"
          disabled={busy || !text.trim()}
        >
          {busy ? "…" : <Send size={17} />}
        </button>
      </form>
    </section>
  );
}
