-- ORTHIVA: allow authenticated admins to read ALL product variants in the admin dashboard.
-- Run this in Supabase SQL Editor. It does not expose inactive variants to anonymous visitors.

DROP POLICY IF EXISTS "Admins can read ORTHIVA product variants" ON public.product_variants;
CREATE POLICY "Admins can read ORTHIVA product variants"
ON public.product_variants
FOR SELECT
TO authenticated
USING ((SELECT public.is_orthiva_admin()));

-- Keep the existing public read policy for active variants of published products.
-- Keep the existing INSERT/UPDATE/DELETE admin policies and Storage policies.
