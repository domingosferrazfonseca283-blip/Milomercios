create table if not exists public.seller_integrations (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('instagram','whatsapp','google_ads','tiktok')),
  external_account_id text,
  status text not null default 'pending',
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (seller_id, provider)
);

alter table public.seller_integrations enable row level security;

create policy "seller reads own integrations"
  on public.seller_integrations for select
  using (auth.uid() = seller_id);

create policy "seller creates own integrations"
  on public.seller_integrations for insert
  with check (auth.uid() = seller_id);

create policy "seller updates own integrations"
  on public.seller_integrations for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create index if not exists seller_integrations_seller_idx
  on public.seller_integrations (seller_id);
