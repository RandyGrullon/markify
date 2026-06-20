-- ─────────────────────────────────────────────────────────────
--  Markify · Esquema de base de datos para Supabase
--  Pégalo completo en:  Supabase → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────

-- 1) Tabla con el historial de conversiones de cada usuario
create table if not exists public.conversions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  original_name text not null,
  markdown_name text not null,
  storage_path  text not null,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

create index if not exists conversions_user_id_created_at_idx
  on public.conversions (user_id, created_at desc);

-- 2) Seguridad a nivel de fila: cada quien solo ve/gestiona lo suyo
alter table public.conversions enable row level security;

drop policy if exists "Ver mis conversiones" on public.conversions;
create policy "Ver mis conversiones"
  on public.conversions for select
  using (auth.uid() = user_id);

drop policy if exists "Crear mis conversiones" on public.conversions;
create policy "Crear mis conversiones"
  on public.conversions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Borrar mis conversiones" on public.conversions;
create policy "Borrar mis conversiones"
  on public.conversions for delete
  using (auth.uid() = user_id);

-- 3) Bucket de almacenamiento para los .md (privado)
insert into storage.buckets (id, name, public)
values ('conversions', 'conversions', false)
on conflict (id) do nothing;

-- 4) Políticas del bucket: cada usuario solo accede a su propia carpeta
--    (los archivos se guardan como  <user_id>/<archivo>.md )
drop policy if exists "Leer mis archivos" on storage.objects;
create policy "Leer mis archivos"
  on storage.objects for select
  using (
    bucket_id = 'conversions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Subir mis archivos" on storage.objects;
create policy "Subir mis archivos"
  on storage.objects for insert
  with check (
    bucket_id = 'conversions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Borrar mis archivos" on storage.objects;
create policy "Borrar mis archivos"
  on storage.objects for delete
  using (
    bucket_id = 'conversions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
