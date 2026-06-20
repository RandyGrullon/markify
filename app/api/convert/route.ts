import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import TurndownService from "turndown";

// Necesita el runtime de Node (no Edge) por las librerías de conversión.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

type ConvertResult = { markdown: string; title?: string };

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

/** Excel / CSV → tablas Markdown (una por hoja). */
function sheetsToMarkdown(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer" });
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

async function convert(buf: Buffer, filename: string): Promise<ConvertResult> {
  const ext = extOf(filename);

  switch (ext) {
    case "pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const result = await parser.getText();
        return { markdown: (result.text || "").trim() };
      } finally {
        await parser.destroy();
      }
    }
    case "docx": {
      // `convertToMarkdown` existe en tiempo de ejecución pero no en los tipos.
      const m = mammoth as unknown as {
        convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const { value } = await m.convertToMarkdown({ buffer: buf });
      return { markdown: value.trim() };
    }
    case "xlsx":
    case "xls":
    case "csv":
    case "tsv":
      return { markdown: sheetsToMarkdown(buf) };
    case "html":
    case "htm": {
      const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
      return { markdown: td.turndown(buf.toString("utf-8")).trim() };
    }
    case "json": {
      const pretty = JSON.stringify(JSON.parse(buf.toString("utf-8")), null, 2);
      return { markdown: "```json\n" + pretty + "\n```" };
    }
    case "md":
    case "markdown":
    case "txt":
    case "text":
    case "log":
    case "":
      return { markdown: buf.toString("utf-8").trim() };
    default:
      throw new Error(
        `Formato .${ext} no soportado todavía. Prueba con PDF, Word (.docx), Excel (.xlsx/.csv), HTML o texto.`
      );
  }
}

export async function POST(req: Request) {
  let payload: { url?: string; filename?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const { url, filename } = payload;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Falta la URL del archivo." }, { status: 400 });
  }
  const name = filename && typeof filename === "string" ? filename : "archivo";

  try {
    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar el archivo (HTTP ${fileRes.status}).` },
        { status: 502 }
      );
    }

    const arrayBuf = await fileRes.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande (máximo 20 MB)." },
        { status: 413 }
      );
    }

    const buf = Buffer.from(arrayBuf);
    const { markdown, title } = await convert(buf, name);

    return NextResponse.json({
      filename: `${baseName(name)}.md`,
      markdown,
      title: title || baseName(name),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json(
      { error: `No se pudo convertir el archivo: ${message}` },
      { status: 500 }
    );
  }
}

// Endpoint de salud para comprobar que el conversor está vivo.
export async function GET() {
  return NextResponse.json({ status: "ok", service: "markify-converter" });
}
