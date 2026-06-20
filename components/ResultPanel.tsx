"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Copy,
  Check,
  Download,
  Columns2,
  Sparkles,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Eye,
  Code,
} from "lucide-react";
import DocChat from "@/components/DocChat";

type Result = { filename: string; markdown: string; title: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resalta las coincidencias en el Markdown crudo (panel de código). */
function highlight(text: string, query: string, activeIndex: number): { html: string; count: number } {
  if (!query.trim()) return { html: escapeHtml(text), count: 0 };
  const re = new RegExp(escapeRegExp(query), "gi");
  let count = 0;
  let last = 0;
  let html = "";
  for (let m = re.exec(text); m; m = re.exec(text)) {
    html += escapeHtml(text.slice(last, m.index));
    const isActive = count === activeIndex;
    html += `<mark class="search-hl${isActive ? " active" : ""}" data-i="${count}">${escapeHtml(
      m[0]
    )}</mark>`;
    last = m.index + m[0].length;
    count++;
    if (m[0].length === 0) re.lastIndex++; // evita bucle infinito
  }
  html += escapeHtml(text.slice(last));
  return { html, count };
}

export default function ResultPanel({
  result,
  saving,
  initialView = "split",
}: {
  result: Result;
  saving: boolean;
  initialView?: "split" | "chat";
}) {
  const [docView, setDocView] = useState<"split" | "preview" | "markdown">(
    initialView === "chat" ? "preview" : "split"
  );
  const [prevDocView, setPrevDocView] = useState<"split" | "preview" | "markdown">("split");
  const [showChat, setShowChat] = useState<boolean>(initialView === "chat");

  const toggleChat = useCallback(() => {
    setShowChat((prev) => {
      const next = !prev;
      if (next) {
        setPrevDocView(docView);
        setDocView("preview");
      } else {
        setDocView(prevDocView);
      }
      return next;
    });
  }, [docView, prevDocView]);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  // Split redimensionable (solo escritorio).
  const [ratio, setRatio] = useState(50);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const setFromX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    setRatio(Math.min(80, Math.max(20, pct)));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => dragging.current && setFromX(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (dragging.current && e.touches[0]) {
        e.preventDefault();
        setFromX(e.touches[0].clientX);
      }
    };
    const onUp = () => (dragging.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, [setFromX]);

  const { html, count } = useMemo(
    () => highlight(result.markdown, query, activeMatch),
    [result.markdown, query, activeMatch]
  );

  // Al cambiar la búsqueda, vuelve al primer resultado y desplázate a él.
  useEffect(() => {
    setActiveMatch(0);
  }, [query]);

  useEffect(() => {
    const el = codeRef.current?.querySelector<HTMLElement>("mark.active");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatch, html]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename.endsWith(".md") ? result.filename : `${result.filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const step = (dir: 1 | -1) => {
    if (count === 0) return;
    setActiveMatch((i) => (i + dir + count) % count);
  };

  const hasText = result.markdown.trim().length > 0;

  return (
    <div className="animate-fade-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
              {result.filename}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {saving ? "Guardando…" : "Listo para usar en Claude"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copiar
              </>
            )}
          </button>
          <button
            onClick={download}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:flex-none"
          >
            <Download className="h-4 w-4" /> Descargar
          </button>
        </div>
      </div>

      {/* Barra de control: vista + búsqueda */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        {!showChat ? (
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <ToggleBtn active={docView === "preview"} onClick={() => setDocView("preview")}>
              <Eye className="h-4 w-4" /> Vista Previa
            </ToggleBtn>
            <ToggleBtn active={docView === "markdown"} onClick={() => setDocView("markdown")}>
              <Code className="h-4 w-4" /> Código Markdown
            </ToggleBtn>
            <ToggleBtn active={docView === "split"} onClick={() => setDocView("split")}>
              <Columns2 className="h-4 w-4" /> Dividido
            </ToggleBtn>
          </div>
        ) : (
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300">
              <Eye className="h-4 w-4 text-brand-500" /> Vista Previa
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {/* Botón para sacar el chat a la derecha */}
          <button
            onClick={toggleChat}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition active:scale-[0.98] ${
              showChat
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Chat IA
          </button>

          {(docView === "split" || docView === "markdown") && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar en el Markdown…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Limpiar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {query && (
                <div className="flex items-center gap-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="tabular-nums">{count ? activeMatch + 1 : 0}/{count}</span>
                  <button
                    onClick={() => step(-1)}
                    disabled={count === 0}
                    className="rounded-lg p-1 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                    aria-label="Anterior"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => step(1)}
                    disabled={count === 0}
                    className="rounded-lg p-1 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                    aria-label="Siguiente"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cuerpo principal con documentos y chat lateral */}
      <div className="flex h-[75vh] flex-col lg:flex-row overflow-hidden bg-slate-100/50 dark:bg-slate-950/20">
        {/* Área de Documentos */}
        <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {docView === "split" ? (
            <div ref={containerRef} className="flex h-full flex-col sm:flex-row overflow-hidden">
              {/* Vista previa */}
              <div
                className="thin-scroll min-h-0 flex-1 overflow-auto p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 sm:border-b-0 sm:border-r"
                style={isDesktop ? { width: `${ratio}%`, flex: "none" } : undefined}
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Vista previa
                </p>
                {hasText ? (
                  <div className="mx-auto my-2 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[700px] transition-colors">
                    <div className="markdown-preview">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto my-2 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[200px] flex items-center justify-center transition-colors">
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      (El archivo no contenía texto extraíble.)
                    </p>
                  </div>
                )}
              </div>

              {/* Divisor arrastrable (escritorio) */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  dragging.current = true;
                }}
                onTouchStart={() => (dragging.current = true)}
                className="group hidden w-1.5 cursor-col-resize items-center justify-center bg-slate-200/50 transition hover:bg-brand-200 dark:bg-slate-800 dark:hover:bg-brand-500/30 sm:flex"
                title="Arrastra para redimensionar"
              >
                <div className="h-10 w-1 rounded-full bg-slate-300 group-hover:bg-brand-500 dark:bg-slate-600" />
              </div>

              {/* Código Markdown */}
              <div className="thin-scroll min-h-0 flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Markdown
                </p>
                <div className="mx-auto my-2 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[700px] transition-colors">
                  <pre
                    ref={codeRef}
                    className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              </div>
            </div>
          ) : docView === "preview" ? (
            /* Vista previa completa */
            <div className="thin-scroll flex-1 overflow-auto p-4 sm:p-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Vista previa
              </p>
              {hasText ? (
                <div className="mx-auto my-3 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-12 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[800px] transition-colors">
                  <div className="markdown-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="mx-auto my-3 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-12 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[200px] flex items-center justify-center transition-colors">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    (El archivo no contenía texto extraíble.)
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Código Markdown completo */
            <div className="thin-scroll flex-1 overflow-auto p-4 sm:p-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Markdown
              </p>
              <div className="mx-auto my-3 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-12 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[800px] transition-colors">
                <pre
                  ref={codeRef}
                  className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral del Chat (sacable a la derecha) */}
        {showChat && (
          <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 h-full border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.02)] dark:shadow-none animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Chat IA del Documento
              </span>
              <button
                onClick={() => {
                  setShowChat(false);
                  setDocView(prevDocView);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar Chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <DocChat document={result.markdown} title={result.title} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
