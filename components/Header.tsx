"use client";

import { FileText, HelpCircle, LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

type User = {
  email?: string;
  name?: string;
  avatar?: string;
};

export default function Header({
  user,
  onSignOut,
  onOpenTutorial,
}: {
  user: User | null;
  onSignOut: () => void;
  onOpenTutorial: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
            <FileText className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Markify
            </p>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Convierte, busca y pregúntale a la IA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onOpenTutorial}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">¿Cómo funciona?</span>
          </button>

          <ThemeToggle />

          {user && (
            <div className="flex items-center gap-2">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name || "Avatar"}
                  className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  {(user.name || user.email || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={onSignOut}
                aria-label="Cerrar sesión"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
