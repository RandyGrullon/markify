/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse / pdfjs-dist cargan un "worker" en tiempo de ejecución; si Next los
  // empaqueta, no encuentra el archivo del worker. Los dejamos como externos para
  // que se carguen desde node_modules (funciona en local y en Vercel).
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
