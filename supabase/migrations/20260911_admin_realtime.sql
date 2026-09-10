-- Realtime do painel administrativo Milomércios.
-- Adiciona apenas tabelas existentes que ainda não estejam na publicação.
do $$
begin
  if to_regclass('public.orders') is not null and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
  if to_regclass('public.subscription_requests') is not null and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subscription_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.subscription_requests';
  end if;
  if to_regclass('public.profiles') is not null and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
  if to_regclass('public.products') is not null and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    execute 'alter publication supabase_realtime add table public.products';
  end if;
end $$;