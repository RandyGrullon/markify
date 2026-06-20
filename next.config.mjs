/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La conversión ocurre 100% en el navegador (pdfjs/mammoth/xlsx/turndown se
  // importan dinámicamente en el cliente). No hay función serverless de conversión.
};

export default nextConfig;
