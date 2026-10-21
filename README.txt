ORTHIVA static store + Cloudflare Pages order function

1. Deploy the contents of this folder to Cloudflare Pages. Keep index.html at the deploy root and include the functions/ directory.
2. In Cloudflare Pages > Settings > Variables and Secrets, add:
   SUPABASE_URL = your Supabase project URL
   SUPABASE_ANON_KEY = your Supabase publishable/anon key (never service_role/sb_secret)
   Use the same values as config.js.
3. In Supabase SQL Editor, run supabase-create-orders.sql once. It creates an atomic RPC that validates current published products/variants and reserves stock while saving orders and order_items.
4. Keep RLS enabled. The SQL function is SECURITY DEFINER with a fixed empty search_path and only accepts validated customer data and variant IDs/quantities. Test with a low-cost test product before real orders.
5. Storage upload remains a separate admin-auth/RLS issue. Do not weaken storage policies or expose secret keys to fix it.

The SQL assumes the existing public.orders, public.order_items, public.products, and public.product_variants schemas provided by the project owner. Delivery fee is currently 0, matching config.js.
