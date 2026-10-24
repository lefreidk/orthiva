-- ORTHIVA: secure, atomic order creation for Cloudflare Pages.
-- Run in Supabase SQL Editor as project owner. Never put service_role/secret keys in the browser.

-- orders.order_number is already an IDENTITY column in this database.
-- Leave it out of INSERT statements so PostgreSQL generates it automatically.
-- Idempotency key: repeated submissions of the same checkout return the same order.
alter table public.orders add column if not exists client_request_id uuid;
create unique index if not exists orders_client_request_id_unique
  on public.orders (client_request_id) where client_request_id is not null;

create or replace function public.create_orthiva_order(
  p_customer_name text,
  p_phone text,
  p_wilaya text,
  p_municipality text,
  p_address text,
  p_customer_note text,
  p_items jsonb,
  p_client_request_id uuid
)
returns table(order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_item jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_product_id uuid;
  v_product_name text;
  v_size text;
  v_color text;
  v_price numeric;
  v_stock integer;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_count integer := 0;
begin
  if p_client_request_id is null then
    raise exception 'معرّف الطلب مطلوب';
  end if;

  -- A retry after a timeout must not create a second order or reserve stock twice.
  select o.id, o.order_number into v_order_id, v_order_number
  from public.orders o where o.client_request_id = p_client_request_id;
  if found then
    return query select v_order_id, v_order_number;
    return;
  end if;

  if length(trim(coalesce(p_customer_name, ''))) < 2 or length(trim(coalesce(p_phone, ''))) < 8
     or length(trim(coalesce(p_wilaya, ''))) < 1 or length(trim(coalesce(p_municipality, ''))) < 1
     or length(trim(coalesce(p_address, ''))) < 3 then
    raise exception 'بيانات الزبون غير مكتملة';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'قائمة المنتجات غير صالحة';
  end if;

  -- Validate and reserve stock under row locks. Any error rolls the whole transaction back.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_count := v_count + 1;
    begin
      v_variant_id := (v_item->>'variant_id')::uuid;
      v_qty := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'خيار المنتج أو الكمية غير صالحين';
    end;
    if v_qty < 1 or v_qty > 20 then raise exception 'الكمية غير صالحة'; end if;

    select p.id, p.name, p.price, v.size, v.color, v.stock_quantity
      into v_product_id, v_product_name, v_price, v_size, v_color, v_stock
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = v_variant_id and v.is_active = true and p.is_published = true
    for update of v;

    if not found then raise exception 'خيار المنتج غير متاح'; end if;
    if v_stock < v_qty then raise exception 'المخزون غير كافٍ'; end if;

    update public.product_variants
      set stock_quantity = stock_quantity - v_qty, updated_at = now()
      where id = v_variant_id;

    v_line_total := round(v_price * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  insert into public.orders (
    customer_name, phone, wilaya, municipality, address, customer_note,
    subtotal, delivery_fee, total, status, client_request_id
  ) values (
    trim(p_customer_name), trim(p_phone), trim(p_wilaya), trim(p_municipality),
    trim(p_address), nullif(trim(coalesce(p_customer_note, '')), ''),
    v_subtotal, 0, v_subtotal, 'new', p_client_request_id
  ) returning id, orders.order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    select p.id, p.name, p.price, v.size, v.color
      into v_product_id, v_product_name, v_price, v_size, v_color
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = v_variant_id;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, size, color,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product_id, v_variant_id, v_product_name, v_size, v_color,
      v_price, v_qty, round(v_price * v_qty, 2)
    );
  end loop;

  return query select v_order_id, v_order_number;
end;
$function$;

-- Only public checkout can execute this narrow function; table writes remain behind RLS.
revoke all on function public.create_orthiva_order(text, text, text, text, text, text, jsonb, uuid) from public;
grant execute on function public.create_orthiva_order(text, text, text, text, text, text, jsonb, uuid) to anon, authenticated;

-- Remove the previous non-idempotent overload, if this project had an earlier version.
drop function if exists public.create_orthiva_order(text, text, text, text, text, text, jsonb);
