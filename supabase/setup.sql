-- QrEvento / Expo Live Gallery V1.2
-- Ejecutar en Supabase > SQL Editor.

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null,
  category text not null default 'General',
  storage_path text not null unique,
  public_url text not null,
  status text not null default 'PUBLICADA'
    check (status in ('PENDIENTE','PUBLICADA','OCULTA')),
  featured boolean not null default false
);

alter table public.event_photos enable row level security;

drop policy if exists "expo_live_public_read" on public.event_photos;
create policy "expo_live_public_read"
on public.event_photos for select
to anon
using (status = 'PUBLICADA');

drop policy if exists "expo_live_public_insert" on public.event_photos;
create policy "expo_live_public_insert"
on public.event_photos for insert
to anon
with check (
  status = 'PUBLICADA'
  and featured = false
  and char_length(author) between 1 and 80
  and category in ('Público','Stands','Conferencias','Experiencias','Escenario','General')
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('expo-live','expo-live',true,15728640,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=true,
  file_size_limit=15728640,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "expo_live_storage_insert" on storage.objects;
create policy "expo_live_storage_insert"
on storage.objects for insert
to anon
with check (bucket_id='expo-live');

drop policy if exists "expo_live_storage_delete" on storage.objects;
create policy "expo_live_storage_delete"
on storage.objects for delete
to anon
using (bucket_id='expo-live');

-- Realtime: si ya está agregado, Supabase puede indicar que existe.
do $$
begin
  alter publication supabase_realtime add table public.event_photos;
exception when duplicate_object then null;
end $$;
