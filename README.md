# 📄 Markify

Convierte tus archivos (**PDF, Word, Excel, CSV, HTML y texto**) a **Markdown limpio**, listo para pegar en **Claude**. Con vista previa, descarga, login con Google e historial guardado en la nube.

- 🎨 Diseño moderno y responsive: se ve y funciona perfecto en **móvil, iPad y Mac**.
- 🔐 Login con **Google** (vía Supabase).
- ☁️ Guarda tus conversiones de forma **privada** (Supabase Storage + base de datos).
- 👀 **Vista previa** con formato + código Markdown.
- 🧙 **Tutorial guiado** dentro de la app (se abre solo la primera vez; botón «¿Cómo funciona?» para repetirlo).
- ⚙️ Conversión **100% en Node/TypeScript** (sin Python): funciona igual en local y en Vercel.

Todo en **un solo proyecto** Next.js que se despliega en **Vercel** (web + API de conversión).

---

## 🧩 Arquitectura (cómo funciona el flujo)

```
Usuario (móvil/iPad/Mac)
        │  sube archivo
        ▼
Next.js (la web)  ──1) sube el original──►  Supabase Storage (URL firmada)
        │                                          │
        │  2) POST { url } ──► /api/convert (Node) ─┘  descarga + convierte → Markdown
        │  ◄──────────── { markdown } ─────────────────┘
        ▼
Supabase  ── guarda el .md en Storage + registro en la tabla "conversions"
        ▼
Vista previa + Descargar + Historial
```

> El archivo se sube primero a tu nube y la API lo convierte desde una **URL firmada**.
> Así se evita el límite de 4.5 MB del cuerpo de las funciones serverless y cualquier
> PDF (hasta 20 MB) funciona igual. El original temporal se borra tras convertir.

---

## ✅ Qué necesitas de Supabase (resumen rápido)

Crea un proyecto gratis en [supabase.com](https://supabase.com) y necesitarás:

| Qué | Para qué | Dónde lo consigues |
|-----|----------|--------------------|
| **Project URL** | Conectar la app | Settings → API → *Project URL* |
| **anon public key** | Conectar la app (clave pública) | Settings → API → *Project API keys → anon public* |
| **Tabla + bucket** | Guardar conversiones | Ejecutar `supabase/schema.sql` |
| **Google habilitado** | Login con Google | Authentication → Providers → Google |

> No necesitas la `service_role key` ni backend extra. Todo se hace con la `anon key` + las políticas de seguridad (RLS) del SQL.

---

## 🚀 Puesta en marcha paso a paso

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project** (elige una contraseña y región cercana).
2. Ve a **SQL Editor → New query**, pega TODO el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y pulsa **Run**. Esto crea la tabla `conversions`, el bucket `conversions` y las reglas de seguridad.
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public** key

### 3. Activar el login con Google

1. En Supabase: **Authentication → Providers → Google → Enable**.
2. Necesitas un **OAuth Client ID** de Google:
   - Entra a [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto.
   - **APIs & Services → OAuth consent screen** → tipo *External* → completa lo básico → añade tu email como *test user* (o publícalo).
   - **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   - En **Authorized redirect URIs** pega la URL que te muestra Supabase en la pantalla del proveedor Google (algo como `https://TU-PROYECTO.supabase.co/auth/v1/callback`).
   - Copia el **Client ID** y **Client Secret** y pégalos en Supabase (Google provider) → **Save**.
3. En Supabase: **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (para local) y luego tu dominio de Vercel.
   - En **Redirect URLs** añade ambos: `http://localhost:3000` y `https://TU-APP.vercel.app`.

### 4. Variables de entorno

Copia el ejemplo y rellena tus claves:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-public-key
```

### 5. Correr en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> ✅ La conversión ahora corre en **Node** (`app/api/convert/route.ts`), así que funciona
> directamente con `npm run dev` — sin Python ni `vercel dev`.

### 6. Desplegar en Vercel (para que tu novia lo use desde cualquier lado)

1. Sube el proyecto a un repositorio de GitHub.
2. Entra a [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. En **Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Vercel detecta automáticamente el proyecto **Next.js** (web + API de
   conversión en Node). No hay dependencias de Python.
5. Cuando tengas la URL final (`https://TU-APP.vercel.app`), vuelve a Supabase → **Authentication → URL Configuration** y añádela a **Site URL** y **Redirect URLs**.

¡Listo! Comparte la URL de Vercel con tu novia. Puede abrirla en **Safari/Chrome** del iPhone, iPad o Mac, iniciar sesión con Google y empezar a convertir.

> 💡 Tip para iPhone/iPad: en Safari, **Compartir → Añadir a pantalla de inicio** para tenerlo como una app.

---

## 📱 Uso (lo que verá tu novia)

1. **Entrar con Google.**
2. **Arrastrar o elegir** un archivo (en móvil/iPad sale el selector de Archivos/Fotos/iCloud).
3. Espera unos segundos → aparece la **vista previa** en Markdown.
4. **Copiar** o **Descargar** el `.md`.
5. Pegarlo (o subir el `.md`) en **Claude**.
6. Todo queda en **«Tus conversiones guardadas»** para reutilizar o borrar.

El tutorial guiado se abre solo la primera vez. Para verlo otra vez: botón **«¿Cómo funciona?»** arriba a la derecha.

---

## 🛠️ Stack técnico

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Auth con Google · Postgres · Storage)
- **API de conversión en Node** (Route Handler): `pdf-parse` (PDF), `mammoth` (Word),
  `xlsx` (Excel/CSV), `turndown` (HTML)
- `react-markdown` + `remark-gfm` para la vista previa
- `react-dropzone` para subir archivos · `lucide-react` para iconos

---

## ❓ Problemas frecuentes

- **«Falta configurar Supabase»** → no creaste `.env.local` o faltan las claves.
- **El login no vuelve a la app** → revisa **Redirect URLs** en Supabase (deben incluir la URL exacta, local y de Vercel).
- **La conversión falla** → revisa que el bucket `conversions` y las políticas (RLS) del `schema.sql` estén creados: el archivo se sube primero a tu nube.
- **Archivo muy grande** → el límite es 20 MB (ajustable en `app/api/convert/route.ts` y `vercel.json`).
- **PDF escaneado sin texto** → se extrae el texto incrustado; si el PDF es solo imágenes (sin capa de texto), el resultado puede salir vacío.
- **Formato no soportado** → hoy soporta PDF, Word (.docx), Excel (.xlsx/.xls/.csv), HTML y texto. PowerPoint, imágenes y audio no están incluidos.
