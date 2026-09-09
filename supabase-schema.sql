-- Milomércios — esquema Supabase (Auth + Postgres + RLS)
-- Execute este ficheiro no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('cliente','vendedor','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_state as enum ('ativo','pendente','bloqueado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_approval as enum ('pendente','aprovado','oculto','rejeitado');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  tipo public.user_role not null default 'cliente',
  nome_loja text,
  telefone text,
  whatsapp text,
  morada text,
  estado_conta public.account_state not null default 'ativo',
  subscricao_ativa boolean not null default false,
  plano_subscricao text default 'mensal',
  proxima_cobranca_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key references public.profiles(id) on delete cascade,
  nome_loja text not null default '',
  descricao text not null default '',
  localizacao text not null default '',
  telefone text not null default '',
  whatsapp text not null default '',
  imagem_url text not null default '',
  atualizado_em timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  preco numeric(14,2) not null check (preco > 0),
  stock integer not null default 0 check (stock >= 0),
  categoria text not null default 'outros',
  descricao text not null default '',
  imagem_url text not null default '',
  ativo boolean not null default false,
  estado_aprovacao public.product_approval not null default 'pendente',
  avaliacao_media numeric(3,2) not null default 0,
  avaliacao_quantidade integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.subscription_config (
  id boolean primary key default true check (id),
  plano text not null default 'mensal',
  valor numeric(14,2) not null default 0 check (valor >= 0),
  link_pagamento text not null default '',
  atualizado_em timestamptz not null default now()
);
insert into public.subscription_config(id) values (true) on conflict (id) do nothing;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  email text not null default '',
  admin_email text not null default 'domingosferrazfonseca283@gmail.com',
  plano text not null default 'mensal',
  valor numeric(14,2) not null default 0,
  link_pagamento text not null default '',
  estado text not null default 'aguardando_pagamento',
  comprovativo_imagem text,
  comprovativo_nome text,
  comprovativo_tipo text,
  comprovativo_enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  aprovado_por text,
  rejeitado_em timestamptz,
  rejeitado_por text
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles(id) on delete restrict,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  total numeric(14,2) not null default 0,
  payment_method text not null default '',
  payment_status text not null default 'aguardando_pagamento',
  order_status text not null default 'aguardando_pagamento',
  seller_ids uuid[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.products(id) on delete cascade,
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  nota integer not null check (nota between 1 and 5),
  comentario text not null default '',
  criado_em timestamptz not null default now(),
  unique(produto_id, cliente_id)
);

create index if not exists products_active_idx on public.products(ativo, categoria);
create index if not exists products_seller_idx on public.products(vendedor_id);
create index if not exists requests_seller_idx on public.subscription_requests(vendedor_id, criado_em desc);
create index if not exists orders_customer_idx on public.orders(cliente_id, criado_em desc);
create index if not exists reviews_product_idx on public.reviews(produto_id, criado_em desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.tipo = 'admin' and lower(p.email) = 'domingosferrazfonseca283@gmail.com'); $$;

create or replace function public.is_active_seller(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = uid and p.tipo = 'vendedor' and p.estado_conta = 'ativo' and p.subscricao_ativa = true); $$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.subscription_config enable row level security;
alter table public.subscription_requests enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (auth.uid() = id or public.is_admin() or tipo = 'vendedor');
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id and (tipo in ('cliente','vendedor') or (tipo = 'admin' and lower(email) = 'domingosferrazfonseca283@gmail.com')));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

create policy stores_public_read on public.stores for select using (true);
create policy stores_owner_write on public.stores for insert with check (auth.uid() = id and public.is_active_seller());
create policy stores_owner_update on public.stores for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

create policy products_public_read on public.products for select using (ativo = true or vendedor_id = auth.uid() or public.is_admin());
create policy products_seller_insert on public.products for insert with check (vendedor_id = auth.uid() and public.is_active_seller());
create policy products_seller_update on public.products for update using (vendedor_id = auth.uid() or public.is_admin()) with check (vendedor_id = auth.uid() or public.is_admin());
create policy products_admin_delete on public.products for delete using (public.is_admin());

create policy subscription_config_read on public.subscription_config for select using (auth.uid() is not null);
create policy subscription_config_admin_update on public.subscription_config for all using (public.is_admin()) with check (public.is_admin());

create policy requests_owner_insert on public.subscription_requests for insert with check (vendedor_id = auth.uid());
create policy requests_owner_read on public.subscription_requests for select using (vendedor_id = auth.uid() or public.is_admin());
create policy requests_owner_update_proof on public.subscription_requests for update using (vendedor_id = auth.uid() and estado <> 'pago') with check (vendedor_id = auth.uid() and estado in ('aguardando_pagamento','comprovativo_enviado','rejeitado'));
create policy requests_admin_update on public.subscription_requests for update using (public.is_admin()) with check (public.is_admin());
create policy requests_admin_delete on public.subscription_requests for delete using (public.is_admin());

create policy orders_customer_insert on public.orders for insert with check (cliente_id = auth.uid());
create policy orders_read on public.orders for select using (cliente_id = auth.uid() or public.is_admin() or public.is_active_seller());
create policy orders_customer_update on public.orders for update using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());

create policy reviews_public_read on public.reviews for select using (true);
create policy reviews_customer_insert on public.reviews for insert with check (cliente_id = auth.uid());
create policy reviews_customer_update on public.reviews for update using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy reviews_admin_delete on public.reviews for delete using (public.is_admin());

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.products p
  set avaliacao_media = coalesce((select round(avg(r.nota)::numeric, 2) from public.reviews r where r.produto_id = p.id), 0),
      avaliacao_quantidade = (select count(*) from public.reviews r where r.produto_id = p.id)
  where p.id = coalesce(new.produto_id, old.produto_id);
  return coalesce(new, old);
end; $$;

drop trigger if exists reviews_rating on public.reviews;
create trigger reviews_rating after insert or update or delete on public.reviews for each row execute function public.refresh_product_rating();

-- Depois de criar o primeiro utilizador administrador no Supabase Auth, execute:
-- update public.profiles set tipo='admin', estado_conta='ativo', email='domingosferrazfonseca283@gmail.com' where lower(email)='domingosferrazfonseca283@gmail.com';
