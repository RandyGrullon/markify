"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  UploadCloud,
  FileText,
  Loader2,
  Download,
  Copy,
  Check,
  Eye,
  Code2,
  AlertCircle,
  Trash2,
  History as HistoryIcon,
  RefreshCw,
} from "lucide-react";
import { getSupabase, STORAGE_BUCKET, type Conversion } from "@/lib/supabase";

type Result = { filename: string; markdown: string; title: string };
type Status = "idle" | "converting" | "saving" | "done" | "error";

const CONVERTER_URL = process.env.NEXT_PUBLIC_CONVERTER_URL || "/api/convert";

function prettyBytes(n: number | null | undefined): string {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export default function Converter({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabase(), []);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Conversion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("conversions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setHistory(data as Conversion[]);
    setLoadingHistory(false);
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const convert = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setCopied(false);
      setTab("preview");
      setStatus("converting");

      try {
        const res = await fetch(CONVERTER_URL, {
          method: "POST",
          headers: { "x-filename": encodeURIComponent(file.name) },
          body: file,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudo convertir el archivo.");
        }

        const r: Result = {
          filename: data.filename || "documento.md",
          markdown: data.markdown || "",
          title: data.title || file.name,
        };
        setResult(r);

        // Guardar en Supabase (Storage + base de datos)
        setStatus("saving");
        try {
          const path = `${userId}/${Date.now()}-${r.filename}`;
          const blob = new Blob([r.markdown], { type: "text/markdown" });

          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, blob, {
              contentType: "text/markdown",
              upsert: false,
            });
          if (upErr) throw upErr;

          const { error: dbErr } = await supabase.from("conversions").insert({
            user_id: userId,
            original_name: file.name,
            markdown_name: r.filename,
            storage_path: path,
            size_bytes: file.size,
          });
          if (dbErr) throw dbErr;

          await loadHistory();
        } catch (saveErr) {
          // La conversión sirvió aunque falle el guardado: avisamos sin bloquear.
          console.error("No se pudo guardar en la nube:", saveErr);
        }

        setStatus("done");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
        setStatus("error");
      }
    },
    [supabase, userId, loadHistory]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) convert(accepted[0]);
    },
    [convert]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  const downloadCurrent = () => {
    if (!result) return;
    downloadMarkdown(result.markdown, result.filename);
  };

  const copyCurrent = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const downloadFromHistory = async (item: Conversion) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(item.storage_path);
    if (error || !data) return;
    const text = await data.text();
    downloadMarkdown(text, item.markdown_name);
  };

  const openFromHistory = async (item: Conversion) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(item.storage_path);
    if (error || !data) return;
    const text = await data.text();
    setResult({
      filename: item.markdown_name,
      markdown: text,
      title: item.original_name,
    });
    setStatus("done");
    setTab("preview");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteFromHistory = async (item: Conversion) => {
    await supabase.storage.from(STORAGE_BUCKET).remove([item.storage_path]);
    await supabase.from("conversions").delete().eq("id", item.id);
    setHistory((h) => h.filter((x) => x.id !== item.id));
  };

  const busy = status === "converting" || status === "saving";

  return (
    <div className="space-y-6">
      {/* ── Zona de carga ── */}
      <div
        {...getRootProps()}
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed bg-white/70 p-8 text-center backdrop-blur-sm transition-colors dark:bg-slate-900/50 sm:p-12 ${
          isDragActive
            ? "border-brand-500 bg-brand-50/80 dark:bg-brand-500/10"
            : "border-slate-300 hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-500"
        }`}
      >
        <input {...getInputProps()} />

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <Loader2 className="h-10 w-10 animate-spin text-brand-600 dark:text-brand-400" />
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {status === "converting"
                ? "Convirtiendo a Markdown…"
                : "Guardando en tu nube…"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Esto toma solo unos segundos</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {isDragActive ? "Suelta el archivo aquí" : "Arrastra tu archivo"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                PDF, Word, PowerPoint, Excel, imágenes, audio y más · máx. 20&nbsp;MB
              </p>
            </div>
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-700 active:scale-[0.98]"
            >
              <UploadCloud className="h-4 w-4" />
              Elegir archivo
            </button>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {status === "error" && error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-fade-in dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ── Resultado ── */}
      {result && (status === "done" || status === "saving") && (
        <div className="animate-fade-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                  {result.filename}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {status === "saving" ? "Guardando…" : "Listo para usar en Claude"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyCurrent}
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
                onClick={downloadCurrent}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:flex-none"
              >
                <Download className="h-4 w-4" /> Descargar
              </button>
            </div>
          </div>

          {/* Pestañas */}
          <div className="flex gap-1 border-b border-slate-100 px-4 pt-3 dark:border-slate-800 sm:px-5">
            <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>
              <Eye className="h-4 w-4" /> Vista
            </TabBtn>
            <TabBtn active={tab === "code"} onClick={() => setTab("code")}>
              <Code2 className="h-4 w-4" /> Código
            </TabBtn>
          </div>

          <div className="thin-scroll max-h-[60vh] overflow-auto p-5 sm:p-6">
            {tab === "preview" ? (
              result.markdown.trim() ? (
                <div className="markdown-preview">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  (El archivo no contenía texto extraíble.)
                </p>
              )
            ) : (
              <pre className="thin-scroll overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100 dark:bg-black/40 dark:ring-1 dark:ring-white/10">
                {result.markdown}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <HistoryIcon className="h-4 w-4 text-slate-400" />
            Tus conversiones guardadas
          </h2>
          <button
            onClick={loadHistory}
            aria-label="Refrescar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${loadingHistory ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingHistory ? (
          <div className="space-y-2">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Aún no tienes conversiones. ¡Sube tu primer archivo arriba! ☝️
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <FileText className="h-4 w-4" />
                </div>
                <button
                  onClick={() => openFromHistory(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {item.original_name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(item.created_at).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {item.size_bytes ? ` · ${prettyBytes(item.size_bytes)}` : ""}
                  </p>
                </button>
                <button
                  onClick={() => downloadFromHistory(item)}
                  aria-label="Descargar"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteFromHistory(item)}
                  aria-label="Eliminar"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabBtn({
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
      className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-b-2 border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function downloadMarkdown(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
