-- ORTHIVA: إضافة دعم الصور المتعددة لجدول المنتجات
-- هذا السكربت آمن للتنفيذ المتكرر (Idempotent) ولا يمس البيانات الموجودة.

DO $$
BEGIN
    -- التحقق من عدم وجود العمود لتجنب خطأ التكرار
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'images'
    ) THEN
        -- إضافة العمود مع قيمة افتراضية مصفوفة فارغة للمنتجات الحالية
        ALTER TABLE public.products ADD COLUMN images jsonb DEFAULT '[]'::jsonb;

        -- تعليق توضيحي للعمود (اختياري)
        COMMENT ON COLUMN public.products.images IS 'مصفوفة روابط صور المنتج بتنسيق JSON';
    END IF;
END $$;

-- تحديث المنتجات القديمة لملء مصفوفة images بصورتها الوحيدة الموجودة في image_url (اختياري)
UPDATE public.products
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL AND (images IS NULL OR images = '[]'::jsonb);
