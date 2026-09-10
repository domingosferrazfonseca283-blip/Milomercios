-- Centro de Divulgação: campanhas criadas pelo vendedor.
-- Usa UUID para ficar compatível com o rastreio de campanhas.
-- Execute as migrations no SQL Editor do projeto Supabase pela ordem dos ficheiros.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  produto_id uuid not null references public.products(id) on delete cascade,
  nome text not null,
  objetivo text not null default 'vendas',
  publico text not null default '',
  canais text[] not null default '{}',
  titulo text not null default '',
  texto text not null default '',
  chamada text not null default '',
  estado text not null default 'rascunho',
  cliques integer not null default 0,
  conversoes integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists campaigns_vendedor_id_idx on public.campaigns(vendedor_id);
create index if not exists campaigns_produto_id_idx on public.campaigns(produto_id);

alter table public.campaigns enable row level security;

drop policy if exists "campaigns vendedor select own" on public.campaigns;
drop policy if exists "campaigns vendedor insert own" on public.campaigns;
drop policy if exists "campaigns vendedor update own" on public.campaigns;
drop policy if exists "campaigns vendedor delete own" on public.campaigns;

create policy "campaigns vendedor select own" on public.campaigns
  for select using (auth.uid() = vendedor_id);
create policy "campaigns vendedor insert own" on public.campaigns
  for insert with check (auth.uid() = vendedor_id);
create policy "campaigns vendedor update own" on public.campaigns
  for update using (auth.uid() = vendedor_id) with check (auth.uid() = vendedor_id);
create policy "campaigns vendedor delete own" on public.campaigns
  for delete using (auth.uid() = vendedor_id);
