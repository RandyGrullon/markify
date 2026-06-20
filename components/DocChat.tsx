"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Sparkles, Loader2, Bot, User, RotateCcw, Copy, Check } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Resume el documento en 5 puntos",
  "¿Cuáles son las ideas principales?",
  "Explícamelo como si tuviera 12 años",
  "Hazme 3 preguntas de repaso",
];

export default function DocChat({
  document,
  title,
  onCitationClick,
}: {
  document: string;
  title: string;
  onCitationClick?: (text: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setError(null);
      setInput("");

      const next: Msg[] = [...messages, { role: "user", content: q }];
      setMessages([...next, { role: "assistant", content: "" }]);
      setBusy(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, document, title }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "La IA no pudo responder.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let lastUpdate = Date.now();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            setMessages((m) => {
              const copy = m.slice();
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
            break;
          }
          acc += decoder.decode(value, { stream: true });
          const now = Date.now();
          if (now - lastUpdate > 60) {
            lastUpdate = now;
            setMessages((m) => {
              const copy = m.slice();
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          }
        }
        if (!acc.trim()) {
          setMessages((m) => {
            const copy = m.slice();
            copy[copy.length - 1] = {
              role: "assistant",
              content: "_(Sin respuesta. Intenta reformular la pregunta.)_",
            };
            return copy;
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado.");
        // Quitamos la burbuja vacía del asistente.
        setMessages((m) => m.slice(0, -1));
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, document, title]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Mensajes */}
      <div ref={scrollRef} className="thin-scroll flex-1 space-y-4 overflow-auto p-4 sm:p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Pregúntale a la IA sobre este documento
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Conoce todo el contenido de «{title}».
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Etiqueta de emisor para la IA */}
              {m.role === "assistant" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pl-1.5">
                  <Sparkles className="h-3 w-3 text-brand-500 animate-pulse" /> Markify IA
                </span>
              )}
              
              <div className={`flex gap-2.5 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div
                  className={`flex h-7.5 w-7.5 h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    m.role === "user"
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-500/10"
                      : "bg-gradient-to-tr from-brand-500 to-violet-500 text-white shadow-md shadow-brand-500/25"
                  }`}
                >
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>

                {/* Burbuja de chat */}
                <div
                  className={`chat-bubble min-w-0 rounded-2xl px-4 py-2.5 text-sm transition-all duration-300 ${
                    m.role === "user"
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-gradient-to-br from-brand-50/50 via-slate-50/20 to-slate-100/60 border border-brand-100/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 dark:border-slate-800/60 shadow-sm text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children, ...props }) => {
                            if (href && href.startsWith("cite:")) {
                              const text = decodeURIComponent(href.slice(5));
                              return (
                                <CitationBubble
                                  text={text}
                                  title={title}
                                  onClick={() => onCitationClick?.(text)}
                                />
                              );
                            }
                            return (
                              <a href={href} {...props} className="text-brand-600 underline dark:text-brand-400">
                                {children}
                              </a>
                            );
                          },
                          code: ({ node, inline, className, children, ...props }: any) => {
                            return (
                              <code className="bg-brand-100/60 dark:bg-brand-500/10 text-brand-800 dark:text-brand-300 px-1 py-0.5 rounded text-xs font-mono font-semibold">
                                {children}
                              </code>
                            );
                          },
                          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300">{children}</ol>,
                          strong: ({ children }) => <strong className="font-extrabold text-brand-900 dark:text-brand-300 bg-brand-500/5 px-0.5 rounded">{children}</strong>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-brand-400 pl-3 italic my-2 bg-brand-500/5 py-1 pr-1.5 rounded-r-lg text-slate-600 dark:text-slate-400">
                              {children}
                            </blockquote>
                          ),
                          h1: ({ children }) => <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-1">{children}</h3>,
                          h2: ({ children }) => <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2 mb-1">{children}</h4>,
                          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>
                        }}
                      >
                        {m.content.replace(/<ref>(.*?)<\/ref>/gs, (_, text) => `[${text}](cite:${encodeURIComponent(text)})`)}
                      </ReactMarkdown>
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    )
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{m.content}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <p className="px-4 pb-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
      >
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            title="Reiniciar conversación"
            className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function CitationBubble({
  text,
  title,
  onClick,
}: {
  text: string;
  title: string;
  onClick?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyApa = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita disparar el highlight al hacer click en el botón de copia
    const currentYear = new Date().getFullYear();
    const apaText = `"${text}". En: ${title} (Markify, ${currentYear}).`;
    try {
      await navigator.clipboard.writeText(apaText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("No se pudo copiar la cita:", err);
    }
  };

  return (
    <span
      onClick={onClick}
      title="Haz clic para resaltar en el documento"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-500/20 text-brand-800 dark:text-brand-300 font-medium cursor-pointer border border-brand-200/40 dark:border-brand-500/10 hover:bg-brand-200 dark:hover:bg-brand-500/30 transition-all duration-200 my-0.5 group"
    >
      <span className="underline decoration-dotted decoration-brand-500/50 underline-offset-2">
        {text}
      </span>
      <button
        type="button"
        onClick={copyApa}
        title="Copiar como referencia APA"
        className="ml-1 p-0.5 rounded hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}
