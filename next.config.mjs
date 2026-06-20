/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse / pdfjs-dist cargan un "worker" en tiempo de ejecución; si Next los
  // empaqueta, no encuentra el archivo del worker. Los dejamos como externos para
  // que se carguen desde node_modules (funciona en local y en Vercel).
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
    // En Vercel, la función serverless solo incluye los archivos que el bundler
    // "rastrea". pdfjs carga el worker, los cmaps y las fuentes por ruta dinámica,
    // así que el rastreador no los detecta y cualquier PDF da 500. Los forzamos a
    // incluirse en la función /api/convert.
    outputFileTracingIncludes: {
      "/api/convert": [
        "./node_modules/pdfjs-dist/legacy/build/**",
        "./node_modules/pdfjs-dist/build/**",
        "./node_modules/pdfjs-dist/cmaps/**",
        "./node_modules/pdfjs-dist/standard_fonts/**",
        "./node_modules/pdfjs-dist/wasm/**",
      ],
    },
  },
};

export default nextConfig;
