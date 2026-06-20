"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  Loader2,
  Download,
  AlertCircle,
  Trash2,
  History as HistoryIcon,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { getSupabase, STORAGE_BUCKET, type Conversion } from "@/lib/supabase";
import { convertFile } from "@/lib/convert";
import ResultPanel from "@/components/ResultPanel";

type Result = { filename: string; markdown: string; title: string };
type Status = "idle" | "converting" | "saving" | "done" | "error";

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

export default function Converter({
  userId,
  onResultChange,
}: {
  userId: string;
  onResultChange?: (hasResult: boolean) => void;
}) {
  const supabase = useMemo(() => getSupabase(), []);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Conversion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [progress, setProgress] = useState(0);
  const [historyQuery, setHistoryQuery] = useState("");
  // Cada apertura (conversión o item del historial) remonta el panel de resultado.
  const [openId, setOpenId] = useState(0);
  const [initialChat, setInitialChat] = useState(false);

  useEffect(() => {
    if (onResultChange) {
      onResultChange(result !== null);
    }
  }, [result, onResultChange]);

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
      setProgress(0);
      setInitialChat(false);
      setStatus("converting");

      try {
        // Conversión 100% en el navegador: el archivo nunca se sube.
        // Sin límite de tamaño y con progreso real (página a página en PDF).
        const r = await convertFile(file, (pct) => setProgress(pct));
        setResult(r);
        setOpenId((n) => n + 1);

        // Solo se guarda el Markdown en Supabase (Storage + base de datos).
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
          if (upErr) {
            if (/bucket not found/i.test(upErr.message || "")) {
              throw new Error(
                "Falta el bucket «conversions» en Supabase. Ejecuta supabase/schema.sql en el SQL Editor (crea el bucket y sus políticas)."
              );
            }
            throw upErr;
          }

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

  const downloadFromHistory = async (item: Conversion) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(item.storage_path);
    if (error || !data) return;
    const text = await data.text();
    downloadMarkdown(text, item.markdown_name);
  };

  const openFromHistory = async (item: Conversion, chat = false) => {
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
    setInitialChat(chat);
    setOpenId((n) => n + 1);
    setStatus("done");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteFromHistory = async (item: Conversion) => {
    await supabase.storage.from(STORAGE_BUCKET).remove([item.storage_path]);
    await supabase.from("conversions").delete().eq("id", item.id);
    setHistory((h) => h.filter((x) => x.id !== item.id));
  };

  const busy = status === "converting" || status === "saving";

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) => h.original_name.toLowerCase().includes(q));
  }, [history, historyQuery]);

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
                ? "Procesando en tu navegador…"
                : "Guardando el Markdown en tu nube…"}
            </p>

            {/* Barra de progreso (porcentaje real página a página en PDF) */}
            <div className="mt-1 w-full max-w-sm">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-[width] duration-200 ease-out"
                  style={{ width: `${status === "saving" ? 100 : progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                {status === "saving" ? "Casi listo…" : `${progress}%`}
              </p>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              El archivo no se sube: se procesa en tu dispositivo.
            </p>
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
                PDF, Word, Excel, CSV, HTML y texto · sin límite de tamaño · privado
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
        <ResultPanel
          key={openId}
          result={result}
          saving={status === "saving"}
          initialView={initialChat ? "chat" : "split"}
        />
      )}

      {/* ── Historial ── */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
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

        {/* Buscador por nombre */}
        {history.length > 0 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Buscar por nombre…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}

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
        ) : filteredHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Ningún documento coincide con «{historyQuery}».
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredHistory.map((item) => (
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
                  onClick={() => openFromHistory(item, true)}
                  aria-label="Preguntar a la IA"
                  title="Preguntar a la IA"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                >
                  <Sparkles className="h-4 w-4" />
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
