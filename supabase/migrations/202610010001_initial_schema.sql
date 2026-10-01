create extension if not exists pgcrypto;

create type public.transaction_kind as enum ('income', 'expense');
create type public.payment_method as enum ('cash', 'transfer', 'qris');
create type public.debt_kind as enum ('payable', 'receivable');
create type public.debt_status as enum ('unpaid', 'partial', 'paid');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default 'Marindo Farm',
  address text not null default '',
  logo_path text,
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.transaction_kind not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  is_default boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index categories_user_kind_name_active_idx
  on public.categories (user_id, kind, lower(name))
  where deleted_at is null;
create index categories_user_id_idx on public.categories (user_id);

create table public.pens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  livestock_type text not null check (char_length(trim(livestock_type)) between 1 and 80),
  head_count integer not null default 0 check (head_count >= 0),
  start_date date not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index pens_user_name_active_idx
  on public.pens (user_id, lower(name))
  where deleted_at is null;
create index pens_user_id_idx on public.pens (user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_date date not null,
  kind public.transaction_kind not null,
  category_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 180),
  payment_method public.payment_method not null,
  pen_id uuid,
  attachment_path text,
  note text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete restrict,
  foreign key (pen_id, user_id)
    references public.pens (id, user_id) on delete restrict
);

create index transactions_user_date_active_idx
  on public.transactions (user_id, transaction_date desc)
  where deleted_at is null;
create index transactions_user_category_date_idx
  on public.transactions (user_id, category_id, transaction_date desc)
  where deleted_at is null;
create index transactions_user_pen_date_idx
  on public.transactions (user_id, pen_id, transaction_date desc)
  where deleted_at is null;
create index transactions_user_kind_date_idx
  on public.transactions (user_id, kind, transaction_date desc)
  where deleted_at is null;

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.debt_kind not null,
  party_name text not null check (char_length(trim(party_name)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 1 and 180),
  amount numeric(14, 2) not null check (amount > 0),
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  due_date date,
  status public.debt_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index debts_user_due_date_idx on public.debts (user_id, due_date);
create index debts_user_status_idx on public.debts (user_id, status);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  debt_id uuid not null,
  payment_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method public.payment_method not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (debt_id, user_id)
    references public.debts (id, user_id) on delete cascade
);

create index debt_payments_user_date_idx
  on public.debt_payments (user_id, payment_date desc);
create index debt_payments_debt_date_idx
  on public.debt_payments (debt_id, payment_date desc);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null,
  period_month date not null check (extract(day from period_month) = 1),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade,
  unique (user_id, category_id, period_month)
);

create index budgets_user_month_idx on public.budgets (user_id, period_month desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();
create trigger debts_set_updated_at before update on public.debts
for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets
for each row execute function public.set_updated_at();

create or replace function public.sync_debt_payment_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_debt_id uuid;
  target_user_id uuid;
  total_paid numeric(14, 2);
  total_due numeric(14, 2);
begin
  target_debt_id = coalesce(new.debt_id, old.debt_id);
  target_user_id = coalesce(new.user_id, old.user_id);
  select coalesce(sum(p.amount), 0) into total_paid
    from public.debt_payments p
    where p.debt_id = target_debt_id and p.user_id = target_user_id;
  select d.amount into total_due from public.debts d
    where d.id = target_debt_id and d.user_id = target_user_id;
  update public.debts
    set paid_amount = least(total_paid, total_due),
        status = case
          when total_paid >= total_due then 'paid'::public.debt_status
          when total_paid > 0 then 'partial'::public.debt_status
          else 'unpaid'::public.debt_status
        end
    where id = target_debt_id and user_id = target_user_id;
  return coalesce(new, old);
end;
$$;

create trigger debt_payments_sync_after_write
after insert or update or delete on public.debt_payments
for each row execute function public.sync_debt_payment_totals();

create or replace function public.record_debt_payment(
  target_debt_id uuid,
  payment_date date,
  payment_amount numeric,
  payment_method public.payment_method,
  payment_note text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_debt public.debts%rowtype;
  target_category_id uuid;
  payment_id uuid;
  transaction_id uuid;
begin
  select * into current_debt from public.debts
    where id = target_debt_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Catatan hutang/piutang tidak ditemukan.'; end if;
  if payment_amount <= 0 or payment_amount > current_debt.amount - current_debt.paid_amount then
    raise exception 'Nominal pembayaran melebihi sisa tagihan.';
  end if;

  select id into target_category_id from public.categories
    where user_id = current_debt.user_id
      and kind = case when current_debt.kind = 'payable' then 'expense'::public.transaction_kind else 'income'::public.transaction_kind end
      and lower(name) = 'lain-lain' and deleted_at is null
    order by is_default desc limit 1;
  if target_category_id is null then
    select id into target_category_id from public.categories
      where user_id = current_debt.user_id
        and kind = case when current_debt.kind = 'payable' then 'expense'::public.transaction_kind else 'income'::public.transaction_kind end
        and deleted_at is null limit 1;
  end if;
  if target_category_id is null then raise exception 'Buat kategori transaksi sebelum mencatat pembayaran.'; end if;

  insert into public.debt_payments (user_id, debt_id, payment_date, amount, payment_method, note)
  values (current_debt.user_id, current_debt.id, payment_date, payment_amount, payment_method, coalesce(payment_note, ''))
  returning id into payment_id;

  insert into public.transactions (user_id, transaction_date, kind, category_id, amount, description, payment_method, note)
  values (
    current_debt.user_id, payment_date,
    case when current_debt.kind = 'payable' then 'expense'::public.transaction_kind else 'income'::public.transaction_kind end,
    target_category_id, payment_amount,
    case when current_debt.kind = 'payable' then 'Pembayaran hutang: ' else 'Penerimaan piutang: ' end || current_debt.party_name,
    payment_method, coalesce(payment_note, '')
  ) returning id into transaction_id;
  return jsonb_build_object('payment_id', payment_id, 'transaction_id', transaction_id);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, business_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'Marindo Farm'))
  on conflict (id) do nothing;

  insert into public.categories (user_id, kind, name, is_default)
  values
    (new.id, 'income', 'Penjualan Ternak', true),
    (new.id, 'income', 'Penjualan Telur/Susu/Daging', true),
    (new.id, 'income', 'Penjualan Pupuk Kandang', true),
    (new.id, 'income', 'Lain-lain', true),
    (new.id, 'expense', 'Pembelian Bibit/Bakalan', true),
    (new.id, 'expense', 'Pakan', true),
    (new.id, 'expense', 'Obat dan Vitamin', true),
    (new.id, 'expense', 'Vaksinasi', true),
    (new.id, 'expense', 'Tenaga Kerja', true),
    (new.id, 'expense', 'Listrik dan Air', true),
    (new.id, 'expense', 'Perawatan Kandang', true),
    (new.id, 'expense', 'Transportasi', true),
    (new.id, 'expense', 'Peralatan', true),
    (new.id, 'expense', 'Lain-lain', true)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.pens enable row level security;
alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.budgets enable row level security;

create policy "profiles_owner_all" on public.profiles
for all using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "categories_owner_all" on public.categories
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "pens_owner_all" on public.pens
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "transactions_owner_all" on public.transactions
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "debts_owner_all" on public.debts
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "debt_payments_owner_all" on public.debt_payments
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "budgets_owner_all" on public.budgets
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'farm-assets',
  'farm-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "farm_assets_owner_select" on storage.objects
for select using (
  bucket_id = 'farm-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "farm_assets_owner_insert" on storage.objects
for insert with check (
  bucket_id = 'farm-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "farm_assets_owner_update" on storage.objects
for update using (
  bucket_id = 'farm-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'farm-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "farm_assets_owner_delete" on storage.objects
for delete using (
  bucket_id = 'farm-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
