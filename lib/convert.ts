"use client";

/**
 * Conversión a Markdown 100% en el navegador.
 * El archivo nunca se sube: se procesa localmente y solo se guarda el Markdown.
 * Soporta cualquier tamaño (no hay límite de función serverless) y reporta el
 * progreso real página a página en los PDF.
 */

export type ConvertOutput = { filename: string; markdown: string; title: string };
export type ProgressCb = (pct: number) => void;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function baseName(name: string): string {
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const file = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

/** PDF → texto, con progreso real por página. */
async function pdfToMarkdown(file: File, onProgress?: ProgressCb): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // El worker se sirve como asset estático desde public/ (lo copia
  // scripts/copy-pdf-worker.mjs en predev/prebuild). Webpack no puede
  // empaquetarlo porque usa import.meta.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const total = doc.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (typeof item.str === "string") {
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
    page.cleanup();
    onProgress?.(Math.round((i / total) * 100));
  }

  await doc.destroy();
  return pages.join("\n\n").trim();
}

/** Excel / CSV → tablas Markdown (una por hoja). */
async function sheetsToMarkdown(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const parts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (rows.length === 0) continue;
    if (wb.SheetNames.length > 1) parts.push(`## ${sheetName}`);

    const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const cell = (r: string[], c: number) =>
      String(r[c] ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();

    const header = rows[0];
    const headerLine = `| ${Array.from({ length: cols }, (_, c) => cell(header, c)).join(" | ")} |`;
    const sepLine = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
    const bodyLines = rows
      .slice(1)
      .map((r) => `| ${Array.from({ length: cols }, (_, c) => cell(r, c)).join(" | ")} |`);

    parts.push([headerLine, sepLine, ...bodyLines].join("\n"));
  }

  return parts.join("\n\n").trim();
}

async function docxToMarkdown(file: File): Promise<string> {
  const mod = await import("mammoth");
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return htmlStringToMarkdown(html);
}

async function htmlStringToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import("turndown")).default;
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return td.turndown(html).trim();
}

export async function convertFile(file: File, onProgress?: ProgressCb): Promise<ConvertOutput> {
  const ext = extOf(file.name);
  let markdown = "";

  switch (ext) {
    case "pdf":
      markdown = await pdfToMarkdown(file, onProgress);
      break;
    case "docx":
      onProgress?.(40);
      markdown = await docxToMarkdown(file);
      onProgress?.(100);
      break;
    case "xlsx":
    case "xls":
    case "csv":
    case "tsv":
      onProgress?.(40);
      markdown = await sheetsToMarkdown(file);
      onProgress?.(100);
      break;
    case "html":
    case "htm":
      onProgress?.(40);
      markdown = (await htmlStringToMarkdown(await file.text())).trim();
      onProgress?.(100);
      break;
    case "json":
      onProgress?.(40);
      markdown = "```json\n" + JSON.stringify(JSON.parse(await file.text()), null, 2) + "\n```";
      onProgress?.(100);
      break;
    case "md":
    case "markdown":
    case "txt":
    case "text":
    case "log":
    case "":
      onProgress?.(40);
      markdown = (await file.text()).trim();
      onProgress?.(100);
      break;
    default:
      throw new Error(
        `Formato .${ext} no soportado todavía. Prueba con PDF, Word (.docx), Excel (.xlsx/.csv), HTML o texto.`
      );
  }

  return {
    filename: `${baseName(file.name)}.md`,
    markdown,
    title: baseName(file.name),
  };
}
