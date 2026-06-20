import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://markify.vercel.app"),
  title: "Markify · Convierte archivos a Markdown para Claude",
  description:
    "Sube cualquier archivo (PDF, Word, PowerPoint, Excel, imágenes…) y obtén Markdown limpio, listo para pegar en Claude. Con vista previa, descarga e historial.",
  applicationName: "Markify",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Markify",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

// Evita el parpadeo de tema: aplica la clase `dark` antes de pintar.
const themeScript = `(function(){try{var t=localStorage.getItem('markify_theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-brand-50 via-slate-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
        {children}
      </body>
    </html>
  );
}
