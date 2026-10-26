-- ORTHIVA: secure, atomic order creation for Cloudflare Pages.
-- Run in Supabase SQL Editor as project owner. Never put service_role/secret keys in the browser.

-- orders.order_number is already an IDENTITY column in this database.
-- Leave it out of INSERT statements so PostgreSQL generates it automatically.
-- Idempotency key: repeated submissions of the same checkout return the same order.
alter table public.orders add column if not exists client_request_id uuid;
alter table public.orders add column if not exists delivery_method text;
create unique index if not exists orders_client_request_id_unique
  on public.orders (client_request_id) where client_request_id is not null;

create or replace function public.create_orthiva_order(
  p_customer_name text,
  p_phone text,
  p_wilaya text,
  p_municipality text,
  p_address text,
  p_customer_note text,
  p_delivery_method text,
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
  v_delivery_fee numeric := 0;
  v_wilaya_code integer;
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
  -- Calculate shipping from trusted server-side rates; never accept a browser amount.
  v_wilaya_code := case trim(p_wilaya)
    when 'Adrar' then 1
    when 'Chlef' then 2
    when 'Laghouat' then 3
    when 'Oum El Bouaghi' then 4
    when 'Batna' then 5
    when 'Béjaïa' then 6
    when 'Biskra' then 7
    when 'Béchar' then 8
    when 'Blida' then 9
    when 'Bouira' then 10
    when 'Tamanrasset' then 11
    when 'Tébessa' then 12
    when 'Tlemcen' then 13
    when 'Tiaret' then 14
    when 'Tizi Ouzou' then 15
    when 'Alger' then 16
    when 'Djelfa' then 17
    when 'Jijel' then 18
    when 'Sétif' then 19
    when 'Saïda' then 20
    when 'Skikda' then 21
    when 'Sidi Bel Abbès' then 22
    when 'Annaba' then 23
    when 'Guelma' then 24
    when 'Constantine' then 25
    when 'Médéa' then 26
    when 'Mostaganem' then 27
    when 'M''Sila' then 28
    when 'Mascara' then 29
    when 'Ouargla' then 30
    when 'Oran' then 31
    when 'El Bayadh' then 32
    when 'Illizi' then 33
    when 'Bordj Bou Arreridj' then 34
    when 'Boumerdès' then 35
    when 'El Tarf' then 36
    when 'Tindouf' then 37
    when 'Tissemsilt' then 38
    when 'El Oued' then 39
    when 'Khenchela' then 40
    when 'Souk Ahras' then 41
    when 'Tipaza' then 42
    when 'Mila' then 43
    when 'Aïn Defla' then 44
    when 'Naâma' then 45
    when 'Aïn Témouchent' then 46
    when 'Ghardaïa' then 47
    when 'Relizane' then 48
    when 'Timimoun' then 49
    when 'Ouled Djellal' then 51
    when 'Beni Abbes' then 52
    when 'In Salah' then 53
    when 'Touggourt' then 55
    when 'El M''Ghair' then 57
    when 'El Meniaa' then 58
    else null end;
  if v_wilaya_code is null then raise exception 'الولاية غير متاحة للتوصيل'; end if;
  if p_delivery_method not in ('home', 'desk') then raise exception 'طريقة التوصيل غير صالحة'; end if;
  v_delivery_fee := case v_wilaya_code
    when 1 then case p_delivery_method when 'home' then 1100 else 600 end
    when 2 then case p_delivery_method when 'home' then 700 else 400 end
    when 3 then case p_delivery_method when 'home' then 900 else 500 end
    when 4 then case p_delivery_method when 'home' then 800 else 400 end
    when 5 then case p_delivery_method when 'home' then 800 else 400 end
    when 6 then case p_delivery_method when 'home' then 700 else 400 end
    when 7 then case p_delivery_method when 'home' then 900 else 500 end
    when 8 then case p_delivery_method when 'home' then 1100 else 600 end
    when 9 then case p_delivery_method when 'home' then 500 else 250 end
    when 10 then case p_delivery_method when 'home' then 650 else 400 end
    when 11 then case p_delivery_method when 'home' then 1300 else 800 end
    when 12 then case p_delivery_method when 'home' then 800 else 500 end
    when 13 then case p_delivery_method when 'home' then 800 else 400 end
    when 14 then case p_delivery_method when 'home' then 800 else 400 end
    when 15 then case p_delivery_method when 'home' then 650 else 400 end
    when 16 then case p_delivery_method when 'home' then 400 else 200 end
    when 17 then case p_delivery_method when 'home' then 900 else 500 end
    when 18 then case p_delivery_method when 'home' then 700 else 400 end
    when 19 then case p_delivery_method when 'home' then 700 else 400 end
    when 20 then case p_delivery_method when 'home' then 800 else 400 end
    when 21 then case p_delivery_method when 'home' then 700 else 400 end
    when 22 then case p_delivery_method when 'home' then 700 else 400 end
    when 23 then case p_delivery_method when 'home' then 700 else 400 end
    when 24 then case p_delivery_method when 'home' then 800 else 400 end
    when 25 then case p_delivery_method when 'home' then 700 else 400 end
    when 26 then case p_delivery_method when 'home' then 600 else 400 end
    when 27 then case p_delivery_method when 'home' then 700 else 400 end
    when 28 then case p_delivery_method when 'home' then 800 else 500 end
    when 29 then case p_delivery_method when 'home' then 700 else 400 end
    when 30 then case p_delivery_method when 'home' then 900 else 500 end
    when 31 then case p_delivery_method when 'home' then 700 else 400 end
    when 32 then case p_delivery_method when 'home' then 1000 else 500 end
    when 33 then case p_delivery_method when 'home' then 1300 else 600 end
    when 34 then case p_delivery_method when 'home' then 700 else 400 end
    when 35 then case p_delivery_method when 'home' then 600 else 350 end
    when 36 then case p_delivery_method when 'home' then 800 else 400 end
    when 37 then case p_delivery_method when 'home' then 1300 else 600 end
    when 38 then case p_delivery_method when 'home' then 800 else 400 end
    when 39 then case p_delivery_method when 'home' then 900 else 500 end
    when 40 then case p_delivery_method when 'home' then 800 else 500 end
    when 41 then case p_delivery_method when 'home' then 800 else 500 end
    when 42 then case p_delivery_method when 'home' then 600 else 350 end
    when 43 then case p_delivery_method when 'home' then 700 else 400 end
    when 44 then case p_delivery_method when 'home' then 600 else 400 end
    when 45 then case p_delivery_method when 'home' then 1000 else 500 end
    when 46 then case p_delivery_method when 'home' then 700 else 400 end
    when 47 then case p_delivery_method when 'home' then 900 else 500 end
    when 48 then case p_delivery_method when 'home' then 700 else 400 end
    when 49 then case p_delivery_method when 'home' then 1300 else 600 end
    when 51 then case p_delivery_method when 'home' then 900 else 500 end
    when 52 then case p_delivery_method when 'home' then 1300 else 0 end
    when 53 then case p_delivery_method when 'home' then 1300 else 600 end
    when 55 then case p_delivery_method when 'home' then 900 else 500 end
    when 57 then case p_delivery_method when 'home' then 900 else 0 end
    when 58 then case p_delivery_method when 'home' then 1000 else 500 end
    else 0 end;
  if v_delivery_fee <= 0 then raise exception 'طريقة التوصيل غير متاحة لهذه الولاية'; end if;

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
    customer_name, phone, wilaya, municipality, address, customer_note, delivery_method,
    subtotal, delivery_fee, total, status, client_request_id
  ) values (
    trim(p_customer_name), trim(p_phone), trim(p_wilaya), trim(p_municipality),
    trim(p_address), nullif(trim(coalesce(p_customer_note, '')), ''), p_delivery_method,
    v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee, 'new', p_client_request_id
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
revoke all on function public.create_orthiva_order(text, text, text, text, text, text, text, jsonb, uuid) from public;
grant execute on function public.create_orthiva_order(text, text, text, text, text, text, text, jsonb, uuid) to anon, authenticated;

-- Remove the previous non-idempotent overload, if this project had an earlier version.
drop function if exists public.create_orthiva_order(text, text, text, text, text, text, jsonb, uuid);
drop function if exists public.create_orthiva_order(text, text, text, text, text, text, jsonb);
