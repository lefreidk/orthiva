ORTHIVA static store + Cloudflare Pages order function

DEPLOY
1. Deploy the contents of this folder to Cloudflare Pages. Keep index.html at the deploy root and include functions/.
2. In Cloudflare Pages > Settings > Variables and Secrets, set SUPABASE_URL and SUPABASE_ANON_KEY to the same project URL and publishable/anon key used by config.js. Never use service_role or sb_secret keys in browser or Pages variables for this public checkout function.
3. In Supabase SQL Editor, run supabase-create-orders.sql. It creates the atomic order RPC and adds a unique idempotency key to orders. This assumes the existing orders, order_items, products, and product_variants schema described in the project.
4. Run supabase-fix-atomic-admin-save.sql. This creates the admin-only RPC used to save a product and all its variants in one transaction. It requires public.is_orthiva_admin() to exist and return true only for authorized admins. It expects the product/variant columns used by this project, including product_variants.updated_at.
5. Run supabase-add-images-column.sql if the products.images JSONB column does not already exist.
6. Run supabase-admin-variants-policy.sql only if its prerequisite helper and admin policies already exist. Do not weaken RLS or Storage policies to make errors disappear.

SECURITY / TESTING
- The browser key must be publishable/anon only. RLS remains enabled.
- Confirm that public.is_orthiva_admin() is correctly secured and that products, product_variants, orders, order_items, and Storage policies match your intended access rules.
- Test admin login, product save/edit, stock concurrency, image upload, duplicate checkout retry, and a low-cost test order before accepting real orders.
- The SQL migrations cannot be applied remotely by this package; run them manually in the correct Supabase project.
