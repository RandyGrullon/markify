import { NextResponse } from "next/server";

// Proxy del chat con Groq. La API key vive solo en el servidor (GROQ_API_KEY) y
// nunca se expone al navegador. Devuelve la respuesta en streaming (texto plano).
export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
// Margen amplio para el contexto del documento (el modelo admite ~128k tokens).
const MAX_DOC_CHARS = 120_000;

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Falta GROQ_API_KEY en el servidor. Configúrala en .env.local y en Vercel." },
      { status: 500 }
    );
  }

  let payload: { messages?: ChatMessage[]; document?: string; title?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "No hay ninguna pregunta." }, { status: 400 });
  }

  const fullDoc = typeof payload.document === "string" ? payload.document : "";
  let docCharsLimit = MAX_DOC_CHARS;
  let doc = fullDoc.slice(0, docCharsLimit);
  let truncated = fullDoc.length > docCharsLimit;
  const title = payload.title || "documento";

  const makeSystemPrompt = (d: string, isTrunc: boolean) =>
    `Eres el asistente de Markify. Respondes preguntas sobre UN documento que el ` +
    `usuario acaba de convertir a Markdown. Conoces todo su contenido (está abajo).\n\n` +
    `Reglas:\n` +
    `- Responde en el mismo idioma de la pregunta.\n` +
    `- Sé preciso y concreto; cita o resume las partes relevantes del documento.\n` +
    `- IMPORTANTE: Cuando cites o hagas referencia a una frase, línea o sección exacta del documento, enciérrala EXACTAMENTE en etiquetas <ref>texto exacto del documento</ref>. No alteres el texto dentro de estas etiquetas (debe coincidir letra por letra con el documento) para que la interfaz pueda resaltarlo. Ejemplo: "como se menciona en <ref>el beneficio neto aumentó un 12%</ref>".\n` +
    `- Si la respuesta no está en el documento, dilo claramente en lugar de inventar.\n` +
    `- Usa Markdown cuando ayude (listas, negritas, tablas).\n\n` +
    `=== DOCUMENTO: "${title}" ===\n${d}` +
    (isTrunc ? "\n\n[El documento se truncó por su tamaño.]" : "") +
    `\n=== FIN DEL DOCUMENTO ===`;

  let system = makeSystemPrompt(doc, truncated);

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        stream: true,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar con la IA." }, { status: 502 });
  }

  let detail = "";
  if (!groqRes.ok) {
    detail = await groqRes.text().catch(() => "");
    const isTooLarge =
      groqRes.status === 413 ||
      groqRes.status === 429 ||
      /too large|tpm|limit|rate limit/i.test(detail);

    if (isTooLarge && docCharsLimit > 30_000) {
      // Si falla por tamaño/TPM, reintentamos inmediatamente truncando a un límite seguro (aprox. 6k tokens)
      docCharsLimit = 30_000;
      doc = fullDoc.slice(0, docCharsLimit);
      truncated = true;
      system = makeSystemPrompt(doc, truncated);

      try {
        groqRes = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.3,
            stream: true,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
      } catch {
        return NextResponse.json({ error: "No se pudo contactar con la IA en el reintento." }, { status: 502 });
      }

      if (!groqRes.ok) {
        detail = await groqRes.text().catch(() => "");
      }
    }
  }

  if (!groqRes.ok || !groqRes.body) {
    return NextResponse.json(
      { error: `La IA devolvió un error (${groqRes.status}). ${detail.slice(0, 200)}` },
      { status: groqRes.status || 502 }
    );
  }

  // Transformamos el SSE de Groq en un stream de texto plano (solo los deltas).
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = groqRes.body.getReader();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      // Procesamos solo líneas completas; guardamos el resto para el próximo chunk.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          // dato incompleto/no-JSON; se ignora
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
