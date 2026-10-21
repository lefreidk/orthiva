/** Cloudflare Pages Function: POST /api/orders
 * Required Pages environment variable: SUPABASE_URL
 * Required Pages environment variable: SUPABASE_ANON_KEY (publishable/anon key only)
 * The database RPC validates prices and reserves stock atomically.
 */
export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return json({ error: 'إعدادات الخادم ناقصة. أضف SUPABASE_URL وSUPABASE_ANON_KEY إلى Cloudflare Pages.' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'بيانات الطلب غير صالحة.' }, 400); }

  const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const customer_name = clean(body.customer_name, 120);
  const phone = clean(body.phone, 40);
  const wilaya = clean(body.wilaya, 100);
  const municipality = clean(body.municipality, 100);
  const address = clean(body.address, 500);
  const customer_note = clean(body.customer_note, 1000);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customer_name || !phone || !wilaya || !municipality || !address) {
    return json({ error: 'يرجى ملء الاسم والهاتف والولاية والبلدية والعنوان.' }, 400);
  }
  if (!/^[+0-9 ()-]{8,40}$/.test(phone)) return json({ error: 'رقم الهاتف غير صالح.' }, 400);
  if (items.length < 1 || items.length > 20) return json({ error: 'السلة فارغة أو تحتوي على عدد غير مسموح من المنتجات.' }, 400);
  for (const item of items) {
    if (!item || typeof item.variant_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(item.variant_id)) {
      return json({ error: 'أحد خيارات المنتج غير صالح. أعد اختيار المنتج.' }, 400);
    }
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 20) {
      return json({ error: 'كمية أحد المنتجات غير صالحة.' }, 400);
    }
  }

  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/create_orthiva_order`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_customer_name: customer_name,
        p_phone: phone,
        p_wilaya: wilaya,
        p_municipality: municipality,
        p_address: address,
        p_customer_note: customer_note || null,
        p_items: items.map(i => ({ variant_id: i.variant_id, quantity: Number(i.quantity) })),
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof result?.message === 'string' ? result.message : '';
      if (/stock|المخزون|available|غير متوفر/i.test(message)) return json({ error: 'الكمية المطلوبة لم تعد متوفرة. حدّث الصفحة وتحقق من المخزون.' }, 409);
      if (/variant|product|option|خيار|منتج/i.test(message)) return json({ error: 'أحد خيارات المنتج لم يعد متاحًا. حدّث الصفحة وحاول مجددًا.' }, 400);
      console.error('Supabase order RPC failed', response.status, result);
      return json({ error: 'تعذر حفظ الطلب في قاعدة البيانات. تحقق من إعداد SQL وسياسات Supabase.' }, 500);
    }
    const order = Array.isArray(result) ? result[0] : result;
    return json({ success: true, order_id: order?.order_id || order?.id || null, order_number: order?.order_number || null }, 201);
  } catch (error) {
    console.error('Order request failed', error);
    return json({ error: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' }, 502);
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
