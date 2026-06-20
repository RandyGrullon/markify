"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Sparkles, ShieldCheck, Smartphone, Zap } from "lucide-react";
import Header from "@/components/Header";
import Converter from "@/components/Converter";
import Tutorial, { useFirstVisit } from "@/components/Tutorial";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const firstVisit = useFirstVisit();

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  // Abre el tutorial automáticamente en la primera visita.
  useEffect(() => {
    if (firstVisit) setTutorialOpen(true);
  }, [firstVisit]);

  const signIn = async () => {
    setSigningIn(true);
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setSession(null);
  };

  const user = session?.user
    ? {
        email: session.user.email,
        name:
          (session.user.user_metadata?.full_name as string) ||
          (session.user.user_metadata?.name as string),
        avatar: session.user.user_metadata?.avatar_url as string,
      }
    : null;

  const [hasResult, setHasResult] = useState(false);

  return (
    <div className="min-h-screen">
      <Header
        user={user}
        onSignOut={signOut}
        onOpenTutorial={() => setTutorialOpen(true)}
      />

      <main className={`mx-auto px-4 py-8 sm:px-6 sm:py-12 transition-all duration-300 ${
        hasResult ? "max-w-[98vw] 2xl:max-w-[1700px]" : "max-w-3xl"
      }`}>
        {/* Hero */}
        <section className="mb-8 text-center sm:mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> Ahora con chat de IA
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Convierte cualquier archivo a{" "}
            <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent dark:from-brand-400 dark:to-violet-400">
              Markdown
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
            Convierte un PDF, Word, Excel, CSV, HTML o texto a Markdown limpio,
            con vista dividida, buscador y un chat de IA que conoce tu documento.
            El archivo se procesa en tu navegador (no se sube) y solo el Markdown
            se guarda en tu nube privada.
          </p>
        </section>

        {!configured ? (
          <SetupNotice />
        ) : loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-400" />
          </div>
        ) : !session ? (
          <SignIn onSignIn={signIn} signingIn={signingIn} />
        ) : (
          <Converter userId={session.user.id} onResultChange={setHasResult} />
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-slate-400 dark:text-slate-500 sm:px-6">
        Hecho con 💜 · Conversión en tu navegador · IA por{" "}
        <a
          href="https://groq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600 dark:hover:text-slate-300"
        >
          Groq
        </a>
      </footer>

      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}

function SignIn({
  onSignIn,
  signingIn,
}: {
  onSignIn: () => void;
  signingIn: boolean;
}) {
  return (
    <div className="animate-fade-in rounded-3xl border border-slate-200 bg-white/80 p-8 text-center shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        Entra para empezar
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
        Inicia sesión con Google para convertir tus archivos y guardarlos de forma
        privada.
      </p>

      <button
        onClick={onSignIn}
        disabled={signingIn}
        className="mx-auto mt-6 inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <GoogleIcon />
        {signingIn ? "Conectando…" : "Entrar con Google"}
      </button>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Feature icon={<Zap className="h-5 w-5" />} text="Rápido y simple" />
        <Feature
          icon={<Smartphone className="h-5 w-5" />}
          text="Móvil, iPad y Mac"
        />
        <Feature icon={<ShieldCheck className="h-5 w-5" />} text="Privado y seguro" />
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-4 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
      <span className="text-brand-600 dark:text-brand-400">{icon}</span>
      <span className="text-xs font-medium">{text}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <p className="font-semibold">⚙️ Falta configurar Supabase</p>
      <p className="mt-2">
        Crea un archivo <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">.env.local</code>{" "}
        con tus claves <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        y <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        Sigue el archivo <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">README.md</code>.
      </p>
    </div>
  );
}
