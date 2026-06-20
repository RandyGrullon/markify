"""
Función serverless de Vercel (runtime Python).
Recibe el archivo crudo en el cuerpo del POST y el nombre en el header `x-filename`,
lo convierte a Markdown con la librería markitdown de Microsoft y devuelve JSON:
    { "filename": "documento.md", "markdown": "# ...", "title": "..." }

Se usa el cuerpo crudo (no multipart) para evitar dependencias de parseo y porque
el módulo `cgi` fue eliminado en Python 3.13.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import tempfile
from urllib.parse import unquote

from markitdown import MarkItDown

# Una sola instancia reutilizable entre invocaciones "calientes".
_md = MarkItDown(enable_plugins=False)

# Tamaño máximo aceptado (20 MB). Vercel también limita el cuerpo, esto es defensa extra.
MAX_BYTES = 20 * 1024 * 1024


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # Endpoint de salud, útil para comprobar que el conversor está vivo.
        self._json(200, {"status": "ok", "service": "markify-converter"})

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
        except (TypeError, ValueError):
            length = 0

        if length <= 0:
            self._json(400, {"error": "No se recibió ningún archivo."})
            return

        if length > MAX_BYTES:
            self._json(413, {"error": "El archivo es demasiado grande (máximo 20 MB)."})
            return

        raw_name = self.headers.get("x-filename", "archivo")
        filename = unquote(raw_name) or "archivo"
        suffix = os.path.splitext(filename)[1] or ""

        data = self.rfile.read(length)

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(data)
                tmp_path = tmp.name

            result = _md.convert(tmp_path)
            markdown = result.text_content or ""

            self._json(
                200,
                {
                    "filename": os.path.splitext(os.path.basename(filename))[0] + ".md",
                    "markdown": markdown,
                    "title": getattr(result, "title", None) or os.path.basename(filename),
                },
            )
        except Exception as exc:  # noqa: BLE001 - queremos devolver el mensaje al cliente
            self._json(
                500,
                {"error": f"No se pudo convertir el archivo: {exc}"},
            )
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
