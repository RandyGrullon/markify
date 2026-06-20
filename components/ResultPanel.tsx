"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Copy,
  Check,
  Download,
  Sparkles,
  Search,
  X,
  Eye,
  Pencil,
  Save,
  Loader2,
} from "lucide-react";
import DocChat from "@/components/DocChat";

type Result = { filename: string; markdown: string; title: string };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function ResultPanel({
  result,
  saving,
  initialView = "preview",
  onSave,
}: {
  result: Result;
  saving: boolean;
  initialView?: "preview" | "chat";
  onSave?: (newMarkdown: string) => Promise<void>;
}) {
  const [markdownText, setMarkdownText] = useState(result.markdown);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);
  const [showChat, setShowChat] = useState<boolean>(initialView === "chat");
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isAiSource, setIsAiSource] = useState(false);
  const [aiCitations, setAiCitations] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);

  // Sincronizar el estado interno si el resultado del prop cambia (ej. al navegar el historial)
  useEffect(() => {
    setMarkdownText(result.markdown);
    setIsEditing(false);
    setAiCitations([]);
  }, [result.markdown]);

  const toggleChat = useCallback(() => {
    setShowChat((prev) => !prev);
  }, []);

  const triggerSearch = useCallback((text: string, immediate = false, fromAi = false) => {
    setQuery(text);
    setIsAiSource(fromAi);
    if (immediate) {
      setDebouncedQuery(text);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);
    return () => clearTimeout(handler);
  }, [query]);

  // Derivamos los términos a resaltar y el tipo de fuente (IA o manual)
  const { activeQueries, activeIsAiSource } = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q) {
      return { activeQueries: [q], activeIsAiSource: isAiSource };
    }
    if (aiCitations.length > 0) {
      return { activeQueries: aiCitations, activeIsAiSource: true };
    }
    return { activeQueries: [], activeIsAiSource: false };
  }, [debouncedQuery, aiCitations, isAiSource]);

  // Resalta y desplaza la vista previa al buscar/referenciar texto exacto o citas de la IA
  useEffect(() => {
    const container = panelRef.current;
    if (!container) return;

    // 1. Limpiar marcas anteriores (.preview-hl)
    const marks = container.querySelectorAll("span.preview-hl");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        const textContent = mark.querySelector("mark")?.textContent || "";
        const textNode = document.createTextNode(textContent);
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    });

    if (activeQueries.length === 0) return;

    // Buscamos el contenedor de la Vista Previa activa
    const previewContainer = container.querySelector(".markdown-preview");
    if (!previewContainer) return;

    const escaped = activeQueries.map((q) => escapeRegExp(q));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");

    // Helper recursivo para buscar y resaltar en nodos de texto
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || "";
        const parts = text.split(re);
        if (parts.length > 1) {
          const parent = node.parentNode;
          if (parent) {
            const fragment = document.createDocumentFragment();
            parts.forEach((part) => {
              const isMatch = activeQueries.some(
                (q) => q.toLowerCase() === part.toLowerCase()
              );
              if (isMatch) {
                const wrapper = document.createElement("span");
                wrapper.className = "preview-hl inline-flex items-center flex-wrap";

                const mark = document.createElement("mark");
                mark.className =
                  "bg-brand-100 dark:bg-brand-500/25 text-brand-900 dark:text-brand-300 rounded px-1 py-0.5 dark:text-white ring-2 ring-brand-500/30 font-medium transition-all duration-300";
                mark.textContent = part;
                wrapper.appendChild(mark);

                if (activeIsAiSource) {
                  const badge = document.createElement("span");
                  badge.className =
                    "ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-brand-600 to-violet-600 text-white px-2 py-0.5 rounded-full shadow-sm cursor-default select-none animate-pulse";
                  badge.innerHTML = "✨ Fuente IA";
                  wrapper.appendChild(badge);
                }

                fragment.appendChild(wrapper);
              } else if (part) {
                fragment.appendChild(document.createTextNode(part));
              }
            });
            parent.replaceChild(fragment, node);
          }
        }
      } else {
        const isWrapper =
          node.nodeName === "SPAN" &&
          (node as HTMLElement).classList.contains("preview-hl");
        if (
          !isWrapper &&
          node.nodeName !== "SCRIPT" &&
          node.nodeName !== "STYLE" &&
          node.nodeName !== "MARK" &&
          node.nodeName !== "A" &&
          node.nodeName !== "BUTTON"
        ) {
          const children = Array.from(node.childNodes);
          children.forEach(walk);
        }
      }
    };

    walk(previewContainer);

    // Hacer scroll al primer mark encontrado en la vista previa
    const firstMark = previewContainer.querySelector("span.preview-hl mark");
    if (firstMark) {
      firstMark.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeQueries, activeIsAiSource, isEditing, markdownText]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename.endsWith(".md") ? result.filename : `${result.filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startEditing = () => {
    setEditedText(markdownText);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (editedText !== markdownText) {
      const confirmDiscard = window.confirm("¿Descartar los cambios no guardados?");
      if (!confirmDiscard) return;
    }
    setIsEditing(false);
  };

  const saveEditing = async () => {
    if (!onSave) return;
    const trimmed = editedText.trim();
    if (!trimmed) {
      alert("El contenido del documento no puede estar vacío.");
      return;
    }
    setSavingChanges(true);
    try {
      await onSave(editedText);
      setMarkdownText(editedText);
      setIsEditing(false);
    } catch (err) {
      console.error("Error al guardar el Markdown:", err);
      alert("Hubo un error al intentar guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setSavingChanges(false);
    }
  };

  const hasText = markdownText.trim().length > 0;
  const isBusy = saving || savingChanges;

  return (
    <div ref={panelRef} className="animate-fade-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              {savingChanges
                ? "Guardando cambios..."
                : saving
                ? "Guardando..."
                : isEditing
                ? "Modo edición activo"
                : "Listo para usar en Claude"}
            </p>
          </div>
        </div>

        {/* Acciones de la cabecera (se ocultan en modo edición) */}
        {!isEditing && (
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
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
            >
              <Download className="h-4 w-4" /> Descargar
            </button>
            {onSave && (
              <button
                onClick={startEditing}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:flex-none active:scale-[0.98]"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barra de control: vista + búsqueda u opciones de guardar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        {isEditing ? (
          /* Controles del Editor */
          <>
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Pencil className="h-4 w-4 text-brand-500" /> Editar Markdown
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelEditing}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditing}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
              >
                {savingChanges ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Guardar
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Controles de la Vista Previa */
          <>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300">
                <Eye className="h-4 w-4 text-brand-500" /> Vista Previa
              </div>
            </div>

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

              <div className="relative flex-1 sm:w-60 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => triggerSearch(e.target.value, false, false)}
                  placeholder="Buscar en el documento…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {query && (
                  <button
                    onClick={() => triggerSearch("", true, false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Limpiar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cuerpo principal con documento/editor y chat lateral */}
      <div className="flex h-[75vh] flex-col lg:flex-row overflow-hidden bg-slate-100/50 dark:bg-slate-950/20">
        {/* Área de Documentos / Editor */}
        <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {isEditing ? (
            /* Vista del Editor */
            <div className="thin-scroll flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/10 animate-fade-in">
              <div className="mx-auto my-3 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-12 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[800px] flex flex-col transition-colors">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  placeholder="Escribe tu Markdown aquí..."
                  disabled={savingChanges}
                  className="w-full flex-1 resize-none bg-transparent font-mono text-sm leading-relaxed text-slate-800 outline-none dark:text-slate-100 min-h-[700px] border-0 p-0 focus:ring-0"
                />
              </div>
            </div>
          ) : (
            /* Vista Previa */
            <div className="thin-scroll flex-1 overflow-auto p-4 sm:p-6 animate-fade-in">
              {hasText ? (
                <div className="mx-auto my-3 w-full max-w-[800px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-12 shadow-[0_4px_25px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-900 min-h-[800px] transition-colors">
                  <div className="markdown-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownText}</ReactMarkdown>
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
          )}
        </div>

        {/* Panel lateral del Chat (sacable a la derecha con transición suave de deslizamiento) */}
        <div
          className={`h-full border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.02)] dark:shadow-none transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
            showChat
              ? "w-full lg:w-[380px] xl:w-[420px] opacity-100"
              : "w-0 opacity-0 pointer-events-none border-l-0"
          }`}
        >
          <div className="w-full lg:w-[380px] xl:w-[420px] h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Chat IA del Documento
              </span>
              <button
                onClick={() => setShowChat(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar Chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <DocChat
                document={markdownText}
                title={result.title}
                onCitationClick={(text) => {
                  triggerSearch(text, true, true);
                }}
                onCitationsFound={(citations) => {
                  setAiCitations(citations);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
