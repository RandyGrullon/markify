"use client";

import { useEffect, useState } from "react";
import {
  X,
  LogIn,
  UploadCloud,
  Wand2,
  Eye,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Step = {
  icon: React.ReactNode;
  title: string;
  body: string;
  tip?: string;
};

const STEPS: Step[] = [
  {
    icon: <LogIn className="h-7 w-7" />,
    title: "1 · Inicia sesión con Google",
    body: "Toca «Entrar con Google» y elige tu cuenta. Así tus conversiones quedan guardadas y privadas, solo tú las ves.",
    tip: "Funciona igual en iPhone, iPad y Mac. No necesitas instalar nada.",
  },
  {
    icon: <UploadCloud className="h-7 w-7" />,
    title: "2 · Sube tu archivo",
    body: "Arrastra el archivo a la zona punteada o tócala para elegirlo. Sirve PDF, Word, PowerPoint, Excel, imágenes, audio y más.",
    tip: "En móvil/iPad puedes subir desde Archivos, Fotos o iCloud Drive.",
  },
  {
    icon: <Wand2 className="h-7 w-7" />,
    title: "3 · Se convierte solo",
    body: "Markify convierte tu archivo a Markdown limpio en segundos usando la tecnología markitdown de Microsoft.",
  },
  {
    icon: <Eye className="h-7 w-7" />,
    title: "4 · Revisa la vista previa",
    body: "Mira cómo quedó en la pestaña «Vista» (con formato) o «Código» (el Markdown puro). Todo se ve ordenado.",
  },
  {
    icon: <Download className="h-7 w-7" />,
    title: "5 · Descarga o copia",
    body: "Descarga el archivo .md o cópialo con un toque. Queda guardado en tu historial para volver a usarlo cuando quieras.",
  },
  {
    icon: <Sparkles className="h-7 w-7" />,
    title: "6 · Úsalo en Claude",
    body: "Abre Claude, pega el Markdown (o sube el .md) y listo. Claude entiende el contenido perfectamente estructurado.",
    tip: "El Markdown es el formato que mejor «lee» Claude. ✨",
  },
];

const SEEN_KEY = "markify_tutorial_seen_v1";

export default function Tutorial({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (open) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, [open]);

  if (!open) return null;

  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-scale-in w-full max-w-lg rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-white/10 sm:rounded-3xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Cómo usar Markify
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="px-6 py-7 text-center sm:px-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            {step.icon}
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            {step.body}
          </p>
          {step.tip && (
            <p className="mx-auto mt-4 max-w-sm rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              💡 {step.tip}
            </p>
          )}
        </div>

        {/* Puntos de progreso */}
        <div className="flex justify-center gap-1.5 pb-2">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Paso ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-6 bg-brand-600" : "w-2 bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Navegación */}
        <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-3 sm:px-8">
          <button
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition enabled:hover:bg-slate-100 disabled:opacity-0 dark:text-slate-400 dark:enabled:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" /> Atrás
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-700"
            >
              ¡Empezar! <Sparkles className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setI((v) => Math.min(STEPS.length - 1, v + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-700"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Hook auxiliar: ¿es la primera visita del usuario? */
export function useFirstVisit(): boolean {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setFirst(true);
    } catch {
      /* ignore */
    }
  }, []);
  return first;
}
