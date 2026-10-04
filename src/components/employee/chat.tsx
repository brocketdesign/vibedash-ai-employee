"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Strategy chat. Unlimited on the plan, and the only place the founder can
 * argue with the employee before it commits a night to something. Tool calls
 * made here turn into real queued tasks, which is why the reply surfaces what
 * was queued rather than leaving it implicit.
 */
export function ChatPanel({
  slug,
  companyName,
  onQueued,
}: {
  slug: string;
  companyName: string;
  onQueued: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/companies/${slug}/chat`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages(d.messages || []))
      .catch(() => undefined);
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const optimistic: Message = { id: `local-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/companies/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error || "Your employee could not reply.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `reply-${Date.now()}`, role: "assistant", content: body.reply },
      ]);

      if (body.queued?.length) await onQueued();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l rule">
      <div className="border-b px-5 py-4 rule">
        <h2 className="display text-xl">Ask {companyName}&apos;s employee</h2>
        <p className="label mt-1">Strategy &amp; planning · unlimited</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--muted-ink)" }}>
            Ask me what to do next, argue with my plan, or tell me to ship something. I will queue
            the work rather than describe it.
          </p>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="text-right">
              <p className="mono inline-block max-w-[85%] border px-3 py-2 text-left text-[13px] rule">
                {message.content}
              </p>
            </div>
          ) : (
            <div key={message.id} className="space-y-2 text-[15px] leading-relaxed">
              {message.content.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          ),
        )}

        {sending && <p className="label">Thinking…</p>}
        {error && (
          <p className="mono text-xs" style={{ color: "#dc2626" }} role="alert">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={send} className="border-t p-3 rule">
        <div className="flex gap-2">
          <input
            className="field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            maxLength={4000}
            disabled={sending}
          />
          <button className="btn btn-sm btn-solid shrink-0" disabled={sending || !input.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
