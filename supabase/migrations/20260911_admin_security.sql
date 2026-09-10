-- Segurança administrativa do Milomércios.
-- Importante: a autorização no navegador NÃO é suficiente; as mutações abaixo
-- só podem ser executadas pelo administrador identificado no JWT.
-- Antes de executar, substitua o email abaixo pelo email real do administrador.

create or replace function public.is_milomercios_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('domingosferrazfonseca283@gmail.com');
$$;

revoke all on function public.is_milomercios_admin() from public;
grant execute on function public.is_milomercios_admin() to authenticated;

-- Campanhas: o vendedor continua a gerir apenas as suas campanhas;
-- o administrador passa a ter acesso de supervisão.
drop policy if exists "campaigns admin select" on public.campaigns;
create policy "campaigns admin select" on public.campaigns
  for select using (public.is_milomercios_admin());

drop policy if exists "campaigns admin update" on public.campaigns;
create policy "campaigns admin update" on public.campaigns
  for update using (public.is_milomercios_admin())
  with check (public.is_milomercios_admin());

-- Se estas tabelas existirem no projeto, as policies dão ao administrador
-- acesso operacional sem abrir os dados aos demais utilizadores.
do $$ begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    execute 'drop policy if exists "profiles admin all" on public.profiles';
    execute 'create policy "profiles admin all" on public.profiles for all using (public.is_milomercios_admin()) with check (public.is_milomercios_admin())';
  end if;
  if to_regclass('public.products') is not null then
    execute 'alter table public.products enable row level security';
    execute 'drop policy if exists "products admin all" on public.products';
    execute 'create policy "products admin all" on public.products for all using (public.is_milomercios_admin()) with check (public.is_milomercios_admin())';
  end if;
  if to_regclass('public.subscription_config') is not null then
    execute 'alter table public.subscription_config enable row level security';
    execute 'drop policy if exists "subscription config admin all" on public.subscription_config';
    execute 'create policy "subscription config admin all" on public.subscription_config for all using (public.is_milomercios_admin()) with check (public.is_milomercios_admin())';
  end if;
  if to_regclass('public.subscription_requests') is not null then
    execute 'alter table public.subscription_requests enable row level security';
    execute 'drop policy if exists "subscription requests admin all" on public.subscription_requests';
    execute 'create policy "subscription requests admin all" on public.subscription_requests for all using (public.is_milomercios_admin()) with check (public.is_milomercios_admin())';
  end if;
  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders enable row level security';
    execute 'drop policy if exists "orders admin all" on public.orders';
    execute 'create policy "orders admin all" on public.orders for all using (public.is_milomercios_admin()) with check (public.is_milomercios_admin())';
  end if;
end $$;
