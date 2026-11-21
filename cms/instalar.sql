-- Ejecutar después de resenas/instalar.sql, en el proyecto de Xebax.
begin;
create table if not exists public.xebax_site_editors (
  user_id uuid primary key references public.xebax_moderators(user_id) on delete cascade
);
alter table public.xebax_site_editors enable row level security;
revoke all on public.xebax_site_editors from public, anon, authenticated;
grant select(user_id) on public.xebax_site_editors to authenticated;
drop policy if exists xebax_editor_self on public.xebax_site_editors;
create policy xebax_editor_self on public.xebax_site_editors for select to authenticated using (user_id=(select auth.uid()));
insert into public.xebax_site_editors(user_id)
select m.user_id from public.xebax_moderators m join auth.users u on u.id=m.user_id
where m.username='aventura360land' and lower(u.email)='aventura360land@outlook.com' and u.email_confirmed_at is not null
on conflict do nothing;

create table if not exists public.xebax_cms (
  slot text primary key check (slot in ('draft','live')),
  version bigint not null default 0,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.xebax_cms(slot) values ('draft'),('live') on conflict do nothing;
alter table public.xebax_cms enable row level security;
revoke all on public.xebax_cms from public, anon, authenticated;
grant select on public.xebax_cms to anon, authenticated;
drop policy if exists xebax_public_site on public.xebax_cms;
create policy xebax_public_site on public.xebax_cms for select to anon,authenticated using(slot='live');
drop policy if exists xebax_private_draft on public.xebax_cms;
create policy xebax_private_draft on public.xebax_cms for select to authenticated using(exists(select 1 from public.xebax_site_editors where user_id=(select auth.uid())));

create table if not exists public.xebax_cms_history (
  version bigint primary key,
  content jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.xebax_cms_history enable row level security;
revoke all on public.xebax_cms_history from public,anon,authenticated;
grant select on public.xebax_cms_history to authenticated;
drop policy if exists xebax_editor_history on public.xebax_cms_history;
create policy xebax_editor_history on public.xebax_cms_history for select to authenticated using(exists(select 1 from public.xebax_site_editors where user_id=(select auth.uid())));

create or replace function public.xebax_save_site(payload jsonb, expected_version bigint, publish_now boolean)
returns bigint language plpgsql security definer set search_path='' as $$
declare v bigint;
begin
  if not exists(select 1 from public.xebax_site_editors where user_id=auth.uid()) then
    raise exception 'Sin permiso de edición' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>3500000 or publish_now is null then
    raise exception 'Documento inválido o demasiado grande' using errcode='22023';
  end if;
  update public.xebax_cms set version=version+1, content=payload, updated_at=now()
  where slot='draft' and version=expected_version returning version into v;
  if not found then raise exception 'El borrador ha cambiado' using errcode='40001'; end if;
  if publish_now then
    insert into public.xebax_cms_history(version,content) select version,content from public.xebax_cms where slot='live' on conflict do nothing;
    update public.xebax_cms set version=v,content=payload,updated_at=now() where slot='live';
  end if;
  return v;
end; $$;
revoke all on function public.xebax_save_site(jsonb,bigint,boolean) from public,anon,authenticated;
grant execute on function public.xebax_save_site(jsonb,bigint,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('xebax-media','xebax-media',true,52428800,array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm'])
on conflict (id) do nothing;
drop policy if exists xebax_editor_upload on storage.objects;
create policy xebax_editor_upload on storage.objects for insert to authenticated with check(
  bucket_id='xebax-media' and (storage.foldername(name))[1]='contenido'
  and exists(select 1 from public.xebax_site_editors where user_id=(select auth.uid()))
);
drop policy if exists xebax_editor_list_media on storage.objects;
create policy xebax_editor_list_media on storage.objects for select to authenticated using(
  bucket_id='xebax-media' and exists(select 1 from public.xebax_site_editors where user_id=(select auth.uid()))
);
create or replace function public.xebax_publish_page(draft_content jsonb, live_content jsonb, expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v bigint;
begin
  if draft_content is null or jsonb_typeof(draft_content)<>'object' or octet_length(draft_content::text)>3500000 then
    raise exception 'Borrador inválido' using errcode='22023';
  end if;
  -- La función existente comprueba auth.uid(), el rol de editor y la versión antes de escribir.
  v := public.xebax_save_site(live_content, expected_version, true);
  update public.xebax_cms set content=draft_content where slot='draft';
  return v;
end; $$;
revoke all on function public.xebax_publish_page(jsonb,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.xebax_publish_page(jsonb,jsonb,bigint) to authenticated;

notify pgrst,'reload schema';
commit;
