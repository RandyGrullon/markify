import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://markify.vercel.app"),
  title: "Markify · Convierte archivos a Markdown para Claude",
  description:
    "Sube un archivo (PDF, Word, Excel, CSV, HTML o texto) y obtén Markdown limpio, listo para pegar en Claude. Con vista previa, descarga e historial.",
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

// Mata cualquier Service Worker viejo (de otro proyecto en el mismo puerto/dominio)
// que pueda estar interceptando la página y dejándola en blanco. Limpia su caché
// y recarga una sola vez si había uno controlando la pestaña.
const cleanupScript = `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){if(!rs.length)return;Promise.all(rs.map(function(r){return r.unregister();})).then(function(){if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});});}if(navigator.serviceWorker.controller){window.location.reload();}});});}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: cleanupScript }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-brand-50 via-slate-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
        {children}
      </body>
    </html>
  );
}
