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
