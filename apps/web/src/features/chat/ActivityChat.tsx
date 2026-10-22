"use client";
import { useEffect, useState } from "react";
import { Send, Trash2, Sparkles } from "lucide-react";
import { api, send } from "@/lib/api";
import { Notice } from "@/components/ui";
export default function ActivityChat({ eventId }: { eventId: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
      [],
    ),
    [text, setText] = useState(""),
    [session, setSession] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
    try {
      const d = await api<{ session_id: string; message: string }>(
        "/events/" + eventId + "/chat",
        send("POST", { message: text, session_id: session }),
      );
      setSession(d.session_id);
      setMessages((m) => [
        ...m,
        { role: "user", content: text },
        { role: "assistant", content: d.message },
      ]);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
            <p>{m.content}</p>
          </div>
        ))}
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
