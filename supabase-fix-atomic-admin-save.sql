-- ORTHIVA repair migration: atomic product + variant saving.
-- Run once in Supabase SQL Editor as project owner.
-- Requires public.is_orthiva_admin() and the columns used by the current project.
-- This does not expose any service-role key and does not weaken table RLS.

create or replace function public.save_orthiva_product(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product_id uuid;
  v_variant jsonb;
  v_variant_id uuid;
  v_expected_updated_at timestamptz;
  v_stock_changed boolean;
  v_size text;
  v_color text;
  v_stock integer;
  v_active boolean;
  v_count integer := 0;
begin
  if auth.uid() is null or not coalesce(public.is_orthiva_admin(), false) then
    raise exception 'غير مصرح لك بإدارة المنتجات' using errcode = '42501';
  end if;

  if jsonb_typeof(p_product) <> 'object' or jsonb_typeof(p_variants) <> 'array' then
    raise exception 'بيانات المنتج أو الخيارات غير صالحة';
  end if;
  if jsonb_array_length(p_variants) < 1 or jsonb_array_length(p_variants) > 200 then
    raise exception 'يجب إضافة خيار واحد على الأقل، وبحد أقصى 200 خيار';
  end if;
  if length(trim(coalesce(p_product->>'name', ''))) < 2
     or length(trim(coalesce(p_product->>'slug', ''))) < 1
     or length(trim(coalesce(p_product->>'category', ''))) < 1 then
    raise exception 'اسم المنتج والرابط والفئة مطلوبة';
  end if;
  if coalesce((p_product->>'price')::numeric, 0) <= 0 then
    raise exception 'سعر المنتج يجب أن يكون أكبر من صفر';
  end if;
  if nullif(p_product->>'compare_at_price', '') is not null
     and (p_product->>'compare_at_price')::numeric < (p_product->>'price')::numeric then
    raise exception 'السعر السابق لا يمكن أن يكون أقل من السعر الحالي';
  end if;

  -- Product write is in the same transaction as every variant write below.
  if p_product_id is null then
    insert into public.products (
      name, slug, description, category, price, compare_at_price,
      image_url, images, is_published
    ) values (
      trim(p_product->>'name'), trim(p_product->>'slug'),
      nullif(trim(coalesce(p_product->>'description', '')), ''),
      trim(p_product->>'category'), (p_product->>'price')::numeric,
      nullif(p_product->>'compare_at_price', '')::numeric,
      nullif(p_product->>'image_url', ''),
      coalesce(p_product->'images', '[]'::jsonb),
      coalesce((p_product->>'is_published')::boolean, false)
    ) returning id into v_product_id;
  else
    update public.products set
      name = trim(p_product->>'name'),
      slug = trim(p_product->>'slug'),
      description = nullif(trim(coalesce(p_product->>'description', '')), ''),
      category = trim(p_product->>'category'),
      price = (p_product->>'price')::numeric,
      compare_at_price = nullif(p_product->>'compare_at_price', '')::numeric,
      image_url = nullif(p_product->>'image_url', ''),
      images = coalesce(p_product->'images', '[]'::jsonb),
      is_published = coalesce((p_product->>'is_published')::boolean, false)
    where id = p_product_id
    returning id into v_product_id;
    if v_product_id is null then raise exception 'المنتج المطلوب غير موجود'; end if;
  end if;

  -- Validate every row and prevent duplicate size/color combinations.
  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    v_count := v_count + 1;
    v_size := trim(coalesce(v_variant->>'size', ''));
    v_color := trim(coalesce(v_variant->>'color', ''));
    v_stock := (v_variant->>'stock_quantity')::integer;
    v_active := coalesce((v_variant->>'is_active')::boolean, true);
    if v_size = '' or v_color = '' or v_stock < 0 then
      raise exception 'بيانات أحد المقاسات أو الألوان أو الكمية غير صالحة';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_variants) a
      where lower(trim(coalesce(a->>'size',''))) = lower(v_size)
        and lower(trim(coalesce(a->>'color',''))) = lower(v_color)
      group by lower(trim(coalesce(a->>'size',''))), lower(trim(coalesce(a->>'color','')))
      having count(*) > 1
    ) then
      raise exception 'توجد تركيبة مقاس ولون مكررة';
    end if;

    if nullif(v_variant->>'id', '') is null then
      insert into public.product_variants (product_id, size, color, stock_quantity, is_active)
      values (v_product_id, v_size, v_color, v_stock, v_active);
    else
      v_variant_id := (v_variant->>'id')::uuid;
      v_stock_changed := coalesce((v_variant->>'stock_changed')::boolean, false);
      v_expected_updated_at := nullif(v_variant->>'expected_updated_at', '')::timestamptz;

      if v_stock_changed then
        -- Optimistic concurrency: never overwrite stock changed by a recent order.
        update public.product_variants set
          size = v_size, color = v_color, stock_quantity = v_stock,
          is_active = v_active, updated_at = now()
        where id = v_variant_id and product_id = v_product_id
          and ((v_expected_updated_at is null and updated_at is null)
               or updated_at = v_expected_updated_at);
      else
        -- Do not write the stock value read by the page; preserve the live DB quantity.
        update public.product_variants set
          size = v_size, color = v_color, is_active = v_active, updated_at = now()
        where id = v_variant_id and product_id = v_product_id;
      end if;
      if not found then
        raise exception 'تغير المخزون أو لم يعد الخيار موجودًا. أعد تحميل المنتجات قبل الحفظ';
      end if;
    end if;
  end loop;

  -- Removed options are deactivated, never physically deleted, so order history stays intact.
  update public.product_variants pv set is_active = false, updated_at = now()
  where pv.product_id = v_product_id
    and not exists (
      select 1 from jsonb_array_elements(p_variants) a
      where nullif(a->>'id','') is not null and (a->>'id')::uuid = pv.id
    );

  return v_product_id;
end;
$function$;

revoke all on function public.save_orthiva_product(uuid, jsonb, jsonb) from public;
grant execute on function public.save_orthiva_product(uuid, jsonb, jsonb) to authenticated;
