"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

/** Render **bold** spans as <strong>; everything else stays plain text. */
function renderBold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") ? (
      <strong key={i} className="figure font-medium">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{chunk}</span>
    ),
  );
}

const SUGGESTIONS = [
  "How much did I spend this month?",
  "Am I over budget anywhere?",
  "What are my biggest merchants?",
];

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the clerk" : "Ask the clerk"}
        className="fixed bottom-5 right-5 z-40 size-13 rounded-full bg-ink text-cream shadow-[0_2px_16px_rgba(33,29,25,0.35)] hover:bg-moss-deep transition-colors cursor-pointer flex items-center justify-center"
      >
        {open ? (
          <span className="text-xl leading-none">×</span>
        ) : (
          <span
            className="font-[family-name:var(--font-display)] text-2xl italic leading-none"
            style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1' }}
          >
            ?
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-21 right-5 z-40 w-[min(24rem,calc(100vw-2.5rem))] h-[min(30rem,70vh)] bg-cream border border-rule-strong shadow-[0_6px_32px_rgba(33,29,25,0.18)] flex flex-col">
          <header className="px-4 py-3 rule-b flex items-baseline justify-between shrink-0">
            <span
              className="font-[family-name:var(--font-display)] text-lg"
              style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
            >
              The Clerk
            </span>
            <span className="label-caps">knows your ledger</span>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="pt-2">
                <p className="italic text-ink-soft text-[15px] mb-4">
                  Ask about your spending, budget, income, or any transaction.
                  Answers come from your own ledger, nowhere else.
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="block w-full text-left text-[14px] px-3 py-2 border border-rule hover:border-moss hover:text-moss transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id}>
                <p className="label-caps mb-1">
                  {message.role === "user" ? "You" : "The Clerk"}
                </p>
                <div
                  className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
                    message.role === "user" ? "italic text-ink-soft" : ""
                  }`}
                >
                  {message.parts.map((part, i) =>
                    part.type === "text" ? (
                      <span key={i}>{renderBold(part.text)}</span>
                    ) : part.type.startsWith("tool-") ? (
                      <span key={i} className="block label-caps !text-ink-faint py-0.5">
                        · consulting the ledger ·
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
            ))}

            {status === "ready" &&
              messages.at(-1)?.role === "assistant" &&
              !messages
                .at(-1)!
                .parts.some(
                  (p) => p.type === "text" && p.text.trim().length > 0,
                ) && (
                <p className="italic text-ink-faint text-[14px]">
                  The Clerk lost the thread there — try asking a narrower
                  question.
                </p>
              )}

            {status === "submitted" && (
              <p className="italic text-ink-faint text-[14px]">thinking…</p>
            )}
            {status === "error" && (
              <p className="italic text-oxblood text-[14px]">
                Something went wrong — try asking again.
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="rule-t px-4 py-3 flex gap-3 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the clerk…"
              className="flex-1 bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] italic focus:outline-none focus:border-moss"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="label-caps hover:text-moss disabled:opacity-40 cursor-pointer"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
