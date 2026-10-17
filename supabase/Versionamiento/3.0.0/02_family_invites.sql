-- v3.0.0 · 02 — Invitaciones a la familia (D2: se canjean con sesión de Finance OS).
--
-- Flujo: el núcleo (o un guardián) crea una invitación para su familia (id de
-- la familia en el contrato `family`) y comparte el enlace con el token. Solo
-- se guarda el SHA-256 del token. Quien lo abre inicia sesión, conecta su
-- wallet y la canjea con `redeem_family_invite`: queda su dirección. Después
-- el núcleo la agrega en la cadena (firma él) y marca `added_at`.
--
-- Única pieza entre usuarios: `redeem_family_invite` es `security definer`
-- porque quien canjea no puede ver la fila de otro usuario por RLS. Solo
-- escribe la dirección y quién canjeó, y solo con el token correcto.
--
-- Ejecutar ANTES de desplegar el código 3.0.0 (después de 01_). Idempotente.
-- Requiere pgcrypto (en Supabase viene en el esquema `extensions`).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.family_invites (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  family_id         integer not null check (family_id >= 0),
  role              text not null default 'member' check (role in ('guardian', 'member')),
  token_hash        text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at        timestamptz not null,
  redeemed_address  text check (redeemed_address is null or redeemed_address ~ '^G[A-Z2-7]{55}$'),
  redeemed_by       uuid references auth.users (id) on delete set null,
  redeemed_at       timestamptz,
  added_at          timestamptz,
  revoked           boolean not null default false,
  archived          boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.family_invites enable row level security;

drop policy if exists family_invites_select_own on public.family_invites;
drop policy if exists family_invites_insert_own on public.family_invites;
drop policy if exists family_invites_update_own on public.family_invites;
drop policy if exists family_invites_delete_own on public.family_invites;

create policy family_invites_select_own on public.family_invites
  for select using (auth.uid() = user_id);
create policy family_invites_insert_own on public.family_invites
  for insert with check (auth.uid() = user_id);
create policy family_invites_update_own on public.family_invites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy family_invites_delete_own on public.family_invites
  for delete using (auth.uid() = user_id);

create index if not exists family_invites_user_idx
  on public.family_invites (user_id, created_at desc) where not archived;

-- Canje con el token en claro: lo hashea aquí y solo toca esa fila.
create or replace function public.redeem_family_invite(p_token text, p_address text)
returns table (family_id integer, role text)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_invite public.family_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;
  if p_address !~ '^G[A-Z2-7]{55}$' then
    raise exception 'Dirección inválida';
  end if;

  select * into v_invite
    from public.family_invites i
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and not i.archived
   for update;

  if not found or v_invite.revoked then
    raise exception 'Invitación inválida o revocada';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'Esa invitación ya se usó';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'La invitación venció: pide una nueva';
  end if;
  if v_invite.user_id = auth.uid() then
    raise exception 'No puedes canjear tu propia invitación';
  end if;

  update public.family_invites
     set redeemed_address = p_address,
         redeemed_by = auth.uid(),
         redeemed_at = now()
   where id = v_invite.id;

  return query select v_invite.family_id, v_invite.role;
end;
$$;

revoke all on function public.redeem_family_invite(text, text) from public, anon;
grant execute on function public.redeem_family_invite(text, text) to authenticated;
