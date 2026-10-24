(() => {
    'use strict';

    const cfg = window.ORTHIVA_CONFIG || {};
    const $ = id => document.getElementById(id);
    const notice = $('notice');

    let db = null;
    let products = [];
    let variantRows = [];

    // State for Multiple Images and Multi-select
    let productImages = []; // Array of { id, url, file?, isExisting }
    let newlyUploadedImagePaths = [];
    let availableSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
    let availableColors = ['أسود', 'أبيض', 'بني', 'بيج', 'رمادي', 'كحلي', 'وردي', 'أزرق', 'أخضر'];
    let selectedSizes = new Set();
    let selectedColors = new Set();

    // =========================================================
    // أدوات مساعدة
    // =========================================================

    const escapeHtml = value =>
        String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);

    const money = value =>
        `${Number(value || 0).toLocaleString('ar-DZ')} دج`;

    function say(message, bad = false) {
        if (!notice) {
            console[bad ? 'error' : 'log'](message);
            return;
        }

        notice.textContent = message;
        notice.style.background = bad ? '#fdeaea' : '#eef3ec';

        notice.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }

    function getFirstValue(object, keys, fallback = '—') {
        for (const key of keys) {
            const value = object?.[key];

            if (
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ''
            ) {
                return value;
            }
        }

        return fallback;
    }

    function formatDate(value) {
        if (!value) return '—';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString('ar-DZ', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // =========================================================
    // الاتصال بـ Supabase
    // =========================================================

    if (
        !window.supabase ||
        !cfg.SUPABASE_URL ||
        !cfg.SUPABASE_ANON_KEY
    ) {
        if ($('connection-status')) {
            $('connection-status').textContent =
                'إعدادات الاتصال ناقصة';
        }

        say(
            'تعذر تهيئة Supabase. تحقق من ملف config.js.',
            true
        );

        return;
    }

    db = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
    );

    $('connection-status').textContent =
        'تم تهيئة عميل Supabase';

    // =========================================================
    // تسجيل الدخول والخروج
    // =========================================================

    function toggleLoggedIn(user) {
        $('login-panel').classList.toggle('hidden', !!user);
        $('admin-area').classList.toggle('hidden', !user);
        $('logout').classList.toggle('hidden', !user);
    }

    async function loadSession() {
        const { data, error } = await db.auth.getSession();

        if (error) {
            say(
                'تعذر التحقق من جلسة الدخول: ' + error.message,
                true
            );
            return;
        }

        toggleLoggedIn(data.session?.user || null);

        if (data.session?.user) {
            say('تم تسجيل الدخول. جارٍ تحميل المنتجات...');
            await loadProducts();
        }
    }

    $('login-form').addEventListener('submit', async event => {
        event.preventDefault();

        const button = event.submitter;

        if (button) button.disabled = true;

        say('جارٍ تسجيل الدخول...');

        try {
            const { data, error } =
                await db.auth.signInWithPassword({
                    email: $('email').value.trim(),
                    password: $('password').value
                });

            if (error) throw error;

            toggleLoggedIn(data.user);

            say('تم تسجيل الدخول. جارٍ تحميل المنتجات...');

            await loadProducts();

        } catch (error) {
            say(
                'فشل تسجيل الدخول: ' +
                (error.message || String(error)),
                true
            );
        } finally {
            if (button) button.disabled = false;
        }
    });

    $('logout').addEventListener('click', async () => {
        const { error } = await db.auth.signOut();

        if (error) {
            say(
                'تعذر تسجيل الخروج: ' + error.message,
                true
            );
            return;
        }

        toggleLoggedIn(null);
        say('تم تسجيل الخروج.');
    });

    db.auth.onAuthStateChange((_event, session) => {
        toggleLoggedIn(session?.user || null);
    });

    // =========================================================
    // UI Rendering: Multiple Images & Multi-select Pills
    // =========================================================

    function renderImagePreviews() {
        const container = $('image-previews');
        if (!container) return;

        if (productImages.length === 0) {
            container.innerHTML = '<p style="color:var(--muted); font-size:13px;">لا توجد صور مضافة حاليًا.</p>';
            return;
        }

        container.innerHTML = productImages.map((img, index) => `
            <div class="preview-thumb-wrap" data-img-id="${img.id}">
                <img src="${img.url}" alt="">
                <button type="button" class="preview-thumb-remove" data-remove-img="${img.id}" title="حذف">×</button>
                ${index === 0 ? '<span class="preview-thumb-badge">رئيسية</span>' : ''}
            </div>
        `).join('');
    }

    function renderSizePills() {
        const container = $('size-pills');
        if (!container) return;

        container.innerHTML = availableSizes.map(size => `
            <div class="pill ${selectedSizes.has(size) ? 'selected' : ''}" data-size-pill="${escapeHtml(size)}">
                ${escapeHtml(size)}
            </div>
        `).join('');
    }

    function renderColorPills() {
        const container = $('color-pills');
        if (!container) return;

        container.innerHTML = availableColors.map(color => `
            <div class="pill ${selectedColors.has(color) ? 'selected' : ''}" data-color-pill="${escapeHtml(color)}">
                ${escapeHtml(color)}
            </div>
        `).join('');
    }

    // =========================================================
    // Event Listeners: Images & Multi-select
    // =========================================================

    // Image Handlers
    $('add-image-url-btn').addEventListener('click', () => {
        const urlInput = $('image-url-input');
        const url = urlInput.value.trim();
        if (url) {
            productImages.push({ id: crypto.randomUUID(), url, isExisting: false });
            urlInput.value = '';
            renderImagePreviews();
        }
    });

    $('image-files').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                productImages.push({ id: crypto.randomUUID(), url: event.target.result, file, isExisting: false });
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        });
        e.target.value = ''; // Reset
    });

    $('image-previews').addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-remove-img]');
        if (removeBtn) {
            productImages = productImages.filter(img => img.id !== removeBtn.dataset.removeImg);
            renderImagePreviews();
        }
    });

    // Pill Handlers
    $('size-pills').addEventListener('click', (e) => {
        const pill = e.target.closest('[data-size-pill]');
        if (pill) {
            const size = pill.dataset.sizePill;
            if (selectedSizes.has(size)) selectedSizes.delete(size);
            else selectedSizes.add(size);
            renderSizePills();
        }
    });

    $('add-custom-size-btn').addEventListener('click', () => {
        const input = $('custom-size-input');
        const size = input.value.trim();
        if (size && !availableSizes.includes(size)) {
            availableSizes.push(size);
            selectedSizes.add(size);
            renderSizePills();
            input.value = '';
        }
    });

    $('color-pills').addEventListener('click', (e) => {
        const pill = e.target.closest('[data-color-pill]');
        if (pill) {
            const color = pill.dataset.colorPill;
            if (selectedColors.has(color)) selectedColors.delete(color);
            else selectedColors.add(color);
            renderColorPills();
        }
    });

    $('add-custom-color-btn').addEventListener('click', () => {
        const input = $('custom-color-input');
        const color = input.value.trim();
        if (color && !availableColors.includes(color)) {
            availableColors.push(color);
            selectedColors.add(color);
            renderColorPills();
            input.value = '';
        }
    });

    $('generate-variants-btn').addEventListener('click', () => {
        if (selectedSizes.size === 0 || selectedColors.size === 0) {
            say('يرجى اختيار مقاس ولون واحد على الأقل.', true);
            return;
        }

        readVariantInputs();
        const existingVariants = new Map(variantRows.map(v => [`${v.size.toLowerCase()}::${v.color.toLowerCase()}`, v]));
        const defaultStock = Number($('default-stock-input').value) || 0;
        const newVariantRows = [];

        for (const size of selectedSizes) {
            for (const color of selectedColors) {
                const key = `${size.toLowerCase()}::${color.toLowerCase()}`;
                if (existingVariants.has(key)) {
                    newVariantRows.push(existingVariants.get(key));
                } else {
                    newVariantRows.push({
                        size,
                        color,
                        stock_quantity: defaultStock,
                        original_stock_quantity: null,
                        stock_changed: true,
                        is_active: true
                    });
                }
            }
        }

        variantRows = newVariantRows;
        renderVariants();
    });

    // =========================================================
    // تحميل المنتجات
    // =========================================================

    async function loadProducts() {
        const body = $('products-body');

        body.innerHTML = `
            <tr>
                <td colspan="5">جارٍ تحميل المنتجات...</td>
            </tr>
        `;

        const { data, error } = await db
            .from('products')
            .select(`
                id,
                name,
                slug,
                description,
                category,
                price,
                compare_at_price,
                image_url,
                images,
                is_published,
                created_at,
                product_variants (
                    id,
                    product_id,
                    size,
                    color,
                    stock_quantity,
                    is_active,
                    updated_at
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            body.innerHTML = `
                <tr>
                    <td colspan="5">تعذر تحميل المنتجات.</td>
                </tr>
            `;

            say(
                'تعذر قراءة المنتجات: ' +
                error.message +
                ' — تحقق من سياسات RLS وصلاحيات المدير.',
                true
            );

            return;
        }

        products = (data || []).map(product => ({
            ...product,
            variants: product.product_variants || []
        }));

        body.innerHTML = products.length
            ? products.map(product => `
                <tr>
                    <td>
                        ${
                            product.image_url
                                ? `
                                    <img
                                        class="thumb"
                                        src="${escapeHtml(product.image_url)}"
                                        alt=""
                                    >
                                `
                                : '—'
                        }
                    </td>

                    <td>
                        ${escapeHtml(product.name)}
                        <br>
                        <small>${escapeHtml(product.slug)}</small>
                    </td>

                    <td>${money(product.price)}</td>

                    <td>
                        ${product.is_published ? 'منشور' : 'مسودة'}
                    </td>

                    <td>
                        <div class="actions">
                            <button
                                type="button"
                                class="btn secondary"
                                data-edit="${escapeHtml(product.id)}">
                                تعديل
                            </button>

                            <button
                                type="button"
                                class="btn danger"
                                data-delete="${escapeHtml(product.id)}">
                                حذف
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td colspan="5">لا توجد منتجات.</td>
                </tr>
            `;
    }

    // =========================================================
    // عرض المقاسات والألوان
    // =========================================================

    function renderVariants() {
        const body = $('variants-body');

        if (!variantRows.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="5">
                        أضف مقاسًا ولونًا واحدًا على الأقل.
                    </td>
                </tr>
            `;
            return;
        }

        const defaultSizes = [
            '36', '37', '38', '39', '40',
            '41', '42', '43', '44', '45', '46'
        ];

        const defaultColors = [
            'أسود',
            'أبيض',
            'بني',
            'بيج',
            'رمادي',
            'كحلي',
            'وردي',
            'أزرق',
            'أخضر'
        ];

        body.innerHTML = variantRows.map((variant, index) => {
            const sizes = [...defaultSizes];
            const colors = [...defaultColors];

            const currentSize = String(variant.size ?? '');
            const currentColor = String(variant.color ?? '');

            if (currentSize && !sizes.includes(currentSize)) {
                sizes.unshift(currentSize);
            }

            if (currentColor && !colors.includes(currentColor)) {
                colors.unshift(currentColor);
            }

            return `
                <tr data-variant-row="${index}">
                    <td>
                        <select
                            aria-label="المقاس"
                            data-vsize="${index}"
                            required
                        >
                            <option
                                value=""
                                disabled
                                ${currentSize ? '' : 'selected'}
                            >
                                اختر المقاس
                            </option>

                            ${sizes.map(size => `
                                <option
                                    value="${escapeHtml(size)}"
                                    ${currentSize === size ? 'selected' : ''}
                                >
                                    ${escapeHtml(size)}
                                </option>
                            `).join('')}
                        </select>
                    </td>

                    <td>
                        <select
                            aria-label="اللون"
                            data-vcolor="${index}"
                            required
                        >
                            <option
                                value=""
                                disabled
                                ${currentColor ? '' : 'selected'}
                            >
                                اختر اللون
                            </option>

                            ${colors.map(color => `
                                <option
                                    value="${escapeHtml(color)}"
                                    ${currentColor === color ? 'selected' : ''}
                                >
                                    ${escapeHtml(color)}
                                </option>
                            `).join('')}
                        </select>
                    </td>

                    <td>
                        <input
                            aria-label="الكمية"
                            data-vstock="${index}"
                            type="number"
                            min="0"
                            step="1"
                            value="${Number(variant.stock_quantity ?? 0)}"
                            required
                            style="width:90px"
                        >
                    </td>

                    <td>
                        <select
                            aria-label="حالة الخيار"
                            data-vactive="${index}"
                        >
                            <option
                                value="true"
                                ${variant.is_active !== false ? 'selected' : ''}
                            >
                                نشط
                            </option>

                            <option
                                value="false"
                                ${variant.is_active === false ? 'selected' : ''}
                            >
                                متوقف
                            </option>
                        </select>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="btn danger"
                            data-vremove="${index}"
                        >
                            حذف
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function readVariantInputs() {
        const updatedRows = [];

        for (let index = 0; index < variantRows.length; index++) {
            const size = document.querySelector(
                `[data-vsize="${index}"]`
            );

            const color = document.querySelector(
                `[data-vcolor="${index}"]`
            );

            const stock = document.querySelector(
                `[data-vstock="${index}"]`
            );

            const active = document.querySelector(
                `[data-vactive="${index}"]`
            );

            if (!size || !color || !stock || !active) {
                throw new Error(
                    `تعذر قراءة بيانات الخيار رقم ${index + 1}.`
                );
            }

            updatedRows.push({
                ...variantRows[index],
                size: size.value.trim(),
                color: color.value.trim(),
                stock_quantity:
                    stock.value === '' ? NaN : Number(stock.value),
                stock_changed: !variantRows[index].id || Number(stock.value) !== Number(variantRows[index].original_stock_quantity ?? variantRows[index].stock_quantity),
                is_active: active.value === 'true'
            });
        }

        variantRows = updatedRows;
    }

    // =========================================================
    // إضافة خيار جديد
    // =========================================================

    $('add-variant').addEventListener('click', event => {
        event.preventDefault();

        try {
            readVariantInputs();

            variantRows.push({
                size: '',
                color: '',
                stock_quantity: 0,
                is_active: true
            });

            renderVariants();

        } catch (error) {
            say(error.message, true);
        }
    });

    // =========================================================
    // حذف صف من خيارات المنتج
    // =========================================================

    $('variants-body').addEventListener('click', event => {
        const button = event.target.closest('[data-vremove]');

        if (!button) return;

        try {
            readVariantInputs();

            const index = Number(button.dataset.vremove);

            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= variantRows.length
            ) {
                throw new Error('تعذر تحديد الخيار المطلوب حذفه.');
            }

            variantRows.splice(index, 1);

            renderVariants();

        } catch (error) {
            say(error.message, true);
        }
    });

    // =========================================================
    // حفظ خيارات المنتج المتعددة
    // =========================================================

    async function saveVariants(productId) {
        readVariantInputs();

        if (!variantRows.length) {
            throw new Error(
                'أضف مقاسًا ولونًا واحدًا على الأقل.'
            );
        }

        const combinations = new Set();

        // التحقق من كل صف ومنع تكرار المقاس واللون.
        for (let index = 0; index < variantRows.length; index++) {
            const variant = variantRows[index];

            if (!variant.size || !variant.color) {
                throw new Error(
                    `أكمل المقاس واللون في الصف رقم ${index + 1}.`
                );
            }

            if (
                !Number.isInteger(variant.stock_quantity) ||
                variant.stock_quantity < 0
            ) {
                throw new Error(
                    `الكمية في الصف رقم ${index + 1} غير صحيحة.`
                );
            }

            const key =
                `${variant.size.trim().toLowerCase()}::` +
                `${variant.color.trim().toLowerCase()}`;

            if (combinations.has(key)) {
                throw new Error(
                    `المقاس ${variant.size} واللون ${variant.color} مكرران.`
                );
            }

            combinations.add(key);
        }

        const existingProduct = products.find(product =>
            String(product.id) === String(productId)
        );

        const oldVariants = existingProduct?.variants || [];

        const currentIds = new Set(
            variantRows
                .filter(variant => variant.id)
                .map(variant => String(variant.id))
        );

        // تحديث الخيارات الموجودة.
        for (const variant of variantRows) {
            if (!variant.id) continue;

            const payload = {
                product_id: productId,
                size: variant.size,
                color: variant.color,
                stock_quantity: variant.stock_quantity,
                is_active: variant.is_active
            };

            const { error } = await db
                .from('product_variants')
                .update(payload)
                .eq('id', variant.id)
                .eq('product_id', productId);

            if (error) {
                throw new Error(
                    `تعذر تحديث ${variant.size}/${variant.color}: ` +
                    error.message
                );
            }
        }

        // إدراج جميع الخيارات الجديدة في عملية واحدة.
        const newVariants = variantRows
            .filter(variant => !variant.id)
            .map(variant => ({
                product_id: productId,
                size: variant.size,
                color: variant.color,
                stock_quantity: variant.stock_quantity,
                is_active: variant.is_active
            }));

        if (newVariants.length) {
            const { error } = await db
                .from('product_variants')
                .insert(newVariants);

            if (error) {
                throw new Error(
                    'فشل حفظ المقاسات والألوان الجديدة: ' +
                    error.message
                );
            }
        }

        // إيقاف الخيارات القديمة التي حُذفت من النموذج.
        const removedVariants = oldVariants.filter(variant =>
            !currentIds.has(String(variant.id))
        );

        for (const variant of removedVariants) {
            const { error } = await db
                .from('product_variants')
                .update({ is_active: false })
                .eq('id', variant.id)
                .eq('product_id', productId);

            if (error) {
                throw new Error(
                    'تعذر إيقاف الخيار ' +
                    `${variant.size}/${variant.color}: ` +
                    error.message
                );
            }
        }
    }

    // =========================================================
    // إعادة ضبط نموذج المنتج
    // =========================================================

    function resetForm() {
        $('product-form').reset();

        variantRows = [];
        productImages = [];
        newlyUploadedImagePaths = [];
        selectedSizes.clear();
        selectedColors.clear();

        renderVariants();
        renderImagePreviews();
        renderSizePills();
        renderColorPills();

        $('product-id').value = '';
        $('category').value = 'medical-shoes';
        $('is_published').value = 'false';

        $('form-heading').textContent = 'إضافة منتج';
        $('save-product').textContent = 'حفظ المنتج';
    }

    $('reset-form').addEventListener('click', event => {
        event.preventDefault();
        resetForm();
    });

    $('refresh-products').addEventListener('click', loadProducts);

    // =========================================================
    // إنشاء الرابط المختصر للمنتج
    // =========================================================

    $('name').addEventListener('input', () => {
        if (!$('product-id').value) {
            $('slug').value = $('name').value
                .trim()
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]+/gu, '-')
                .replace(/^-|-$/g, '');
        }
    });

    // =========================================================
    // رفع الصور
    // =========================================================

    async function uploadImage(file) {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.type)) {
            throw new Error(
                'اختر صورة JPG أو PNG أو WebP.'
            );
        }

        if (file.size > 5 * 1024 * 1024) {
            throw new Error(
                'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.'
            );
        }

        const extension =
            file.type === 'image/png'
                ? 'png'
                : file.type === 'image/webp'
                    ? 'webp'
                    : 'jpg';

        const path =
            `products/${crypto.randomUUID()}.${extension}`;

        const { error } = await db
            .storage
            .from('orthiva-products')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            throw new Error(
                'فشل رفع الصورة: ' + error.message
            );
        }

        newlyUploadedImagePaths.push(path);
        const { data } = db
            .storage
            .from('orthiva-products')
            .getPublicUrl(path);

        return data.publicUrl;
    }

    // =========================================================
    // حفظ المنتج مع جميع خياراته
    // =========================================================

    $('product-form').addEventListener('submit', async event => {
        event.preventDefault();

        const button = $('save-product');

        if (button.disabled) return;

        button.disabled = true;

        try {
            // التحقق من الخيارات قبل حفظ المنتج.
            readVariantInputs();

            if (!variantRows.length) {
                throw new Error(
                    'أضف مقاسًا ولونًا واحدًا على الأقل.'
                );
            }

            const combinations = new Set();

            for (let index = 0; index < variantRows.length; index++) {
                const variant = variantRows[index];

                if (!variant.size || !variant.color) {
                    throw new Error(
                        `أكمل المقاس واللون في الصف رقم ${index + 1}.`
                    );
                }

                if (
                    !Number.isInteger(variant.stock_quantity) ||
                    variant.stock_quantity < 0
                ) {
                    throw new Error(
                        `الكمية في الصف رقم ${index + 1} غير صحيحة.`
                    );
                }

                const key =
                    `${variant.size.trim().toLowerCase()}::` +
                    `${variant.color.trim().toLowerCase()}`;

                if (combinations.has(key)) {
                    throw new Error(
                        `المقاس ${variant.size} واللون ${variant.color} مكرران.`
                    );
                }

                combinations.add(key);
            }

            // Upload images and prepare final array
            const finalImages = [];
            for (const img of productImages) {
                if (img.file) {
                    say(`جارٍ رفع صورة: ${img.file.name}...`);
                    const url = await uploadImage(img.file);
                    finalImages.push(url);
                } else {
                    finalImages.push(img.url);
                }
            }

            const payload = {
                name: $('name').value.trim(),
                slug: $('slug').value.trim(),
                description: $('description').value.trim(),
                category: $('category').value.trim(),
                price: Number($('price').value),

                compare_at_price:
                    $('compare_at_price').value === ''
                        ? null
                        : Number($('compare_at_price').value),

                images: finalImages,
                image_url: finalImages[0] || null,

                is_published:
                    $('is_published').value === 'true'
            };

            const id = $('product-id').value || null;

            say(
                id
                    ? 'جارٍ تحديث المنتج وخياراته في عملية واحدة...'
                    : 'جارٍ حفظ المنتج وخياراته في عملية واحدة...'
            );

            // The database RPC commits the product and all variants atomically.
            const variantsPayload = variantRows.map(variant => ({
                id: variant.id || null,
                size: variant.size,
                color: variant.color,
                stock_quantity: variant.stock_quantity,
                stock_changed: Boolean(variant.stock_changed || !variant.id),
                expected_updated_at: variant.updated_at || null,
                is_active: variant.is_active !== false
            }));

            const { data: savedProductId, error: saveError } = await db.rpc(
                'save_orthiva_product',
                {
                    p_product_id: id,
                    p_product: payload,
                    p_variants: variantsPayload
                }
            );

            if (saveError) {
                throw new Error(
                    'فشل حفظ المنتج وخياراته دون تطبيق تغييرات جزئية: ' + saveError.message
                );
            }
            if (!savedProductId) {
                throw new Error('لم تُرجع قاعدة البيانات معرّف المنتج المحفوظ.');
            }

            say(
                id
                    ? 'تم تحديث المنتج وجميع خياراته بنجاح.'
                    : 'تمت إضافة المنتج وجميع خياراته بنجاح.'
            );

            // Images are now referenced by the committed product; do not remove them.
            newlyUploadedImagePaths = [];
            resetForm();

            await loadProducts();

        } catch (error) {
            // Avoid leaving newly uploaded orphan files if the database transaction fails.
            if (newlyUploadedImagePaths.length) {
                try {
                    await db.storage.from('orthiva-products').remove(newlyUploadedImagePaths);
                } catch (cleanupError) {
                    console.warn('ORTHIVA image cleanup failed:', cleanupError);
                }
                newlyUploadedImagePaths = [];
            }
            console.error('ORTHIVA save error:', error);

            say(
                'تعذر الحفظ: ' +
                (error.message || String(error)),
                true
            );

        } finally {
            button.disabled = false;
        }
    });

    // =========================================================
    // تعديل المنتجات وحذفها
    // =========================================================

    $('products-body').addEventListener('click', async event => {
        const editButton = event.target.closest('[data-edit]');
        const deleteButton = event.target.closest('[data-delete]');

        if (editButton) {
            const product = products.find(item =>
                String(item.id) === editButton.dataset.edit
            );

            if (!product) return;

            $('product-id').value = product.id;
            $('name').value = product.name || '';
            $('slug').value = product.slug || '';
            $('description').value = product.description || '';
            $('category').value = product.category || '';
            $('price').value = product.price ?? '';

            $('compare_at_price').value =
                product.compare_at_price ?? '';

            // Populate images
            productImages = (product.images || []).map(url => ({ id: crypto.randomUUID(), url, isExisting: true }));
            if (productImages.length === 0 && product.image_url) {
                productImages.push({ id: crypto.randomUUID(), url: product.image_url, isExisting: true });
            }
            renderImagePreviews();

            // Populate selected sizes/colors
            selectedSizes.clear();
            selectedColors.clear();
            (product.variants || []).forEach(v => {
                selectedSizes.add(v.size);
                selectedColors.add(v.color);
            });
            renderSizePills();
            renderColorPills();

            $('is_published').value =
                String(!!product.is_published);

            variantRows = (product.variants || []).map(variant => ({
                ...variant,
                original_stock_quantity: Number(variant.stock_quantity),
                stock_changed: false
            }));

            renderVariants();

            $('form-heading').textContent = 'تعديل المنتج';
            $('save-product').textContent = 'حفظ التعديلات';

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            return;
        }

        if (deleteButton) {
            const product = products.find(item =>
                String(item.id) === deleteButton.dataset.delete
            );

            if (
                !product ||
                !confirm(
                    `هل تريد حذف المنتج «${product.name}»؟`
                )
            ) {
                return;
            }

            // Archive instead of hard-delete so historical order records remain intact.
            const { error } = await db
                .from('products')
                .update({ is_published: false })
                .eq('id', product.id);

            if (error) {
                say(
                    'تعذر إخفاء المنتج: ' + error.message,
                    true
                );
            } else {
                say('تم إخفاء المنتج من المتجر مع الحفاظ على سجل الطلبات.');
                await loadProducts();
            }
        }
    });

    // =========================================================
    // الطلبات وتفاصيل المنتجات
    // =========================================================

    async function loadOrders() {
        const body = $('orders-body');

        body.innerHTML = `
            <tr>
                <td colspan="6">
                    جارٍ تحميل الطلبات وتفاصيل المنتجات...
                </td>
            </tr>
        `;

        try {
            // تحميل آخر 50 طلبًا.
            const { data: orders, error: ordersError } = await db
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (ordersError) throw ordersError;

            if (!orders || orders.length === 0) {
                body.innerHTML = `
                    <tr>
                        <td colspan="6">لا توجد طلبات.</td>
                    </tr>
                `;
                return;
            }

            // استخدام معرّفات الطلبات لجلب تفاصيل منتجاتها.
            const orderIds = orders.map(order => order.id);

            const { data: items, error: itemsError } = await db
                .from('order_items')
                .select(`
                    id,
                    order_id,
                    product_id,
                    variant_id,
                    product_name,
                    size,
                    color,
                    unit_price,
                    quantity,
                    line_total,
                    created_at
                `)
                .in('order_id', orderIds)
                .order('created_at', { ascending: true });

            if (itemsError) throw itemsError;

            // تجميع المنتجات حسب الطلب.
            const itemsByOrder = new Map();

            for (const item of items || []) {
                const key = String(item.order_id);

                if (!itemsByOrder.has(key)) {
                    itemsByOrder.set(key, []);
                }

                itemsByOrder.get(key).push(item);
            }

            // بناء جدول الطلبات.
            body.innerHTML = orders.map(order => {
                const orderItems =
                    itemsByOrder.get(String(order.id)) || [];

                const customerName = getFirstValue(order, [
                    'customer_name',
                    'full_name',
                    'name'
                ]);

                const phone = getFirstValue(order, [
                    'phone',
                    'customer_phone'
                ]);

                const status = getFirstValue(order, [
                    'status'
                ]);

                const orderNumber = getFirstValue(order, [
                    'order_number'
                ], order.id);

                const date = formatDate(order.created_at);

                const productsHtml = orderItems.length
                    ? `
                        <div style="
                            display:flex;
                            flex-direction:column;
                            gap:8px;
                            min-width:220px;
                        ">
                            ${orderItems.map(item => `
                                <div style="
                                    padding:10px;
                                    border:1px solid #ddd;
                                    border-radius:8px;
                                    line-height:1.8;
                                ">
                                    <strong>
                                        ${escapeHtml(item.product_name)}
                                    </strong>

                                    <div>
                                        المقاس:
                                        ${escapeHtml(item.size)}
                                    </div>

                                    <div>
                                        اللون:
                                        ${escapeHtml(item.color)}
                                    </div>

                                    <div>
                                        الكمية:
                                        ${Number(item.quantity)}
                                    </div>

                                    <div>
                                        سعر الوحدة:
                                        ${money(item.unit_price)}
                                    </div>

                                    <div>
                                        إجمالي المنتج:
                                        <strong>
                                            ${money(item.line_total)}
                                        </strong>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `
                    : `
                        <span>
                            لا توجد تفاصيل منتجات لهذا الطلب.
                        </span>
                    `;

                // عرض الإجمالي المخزن في الطلب إذا كان العمود موجودًا.
                const totalValue = getFirstValue(order, [
                    'total_amount',
                    'total',
                    'grand_total'
                ], null);

                const totalHtml = totalValue !== null
                    ? `
                        <div style="margin-top:8px">
                            إجمالي الطلب:
                            <strong>${money(totalValue)}</strong>
                        </div>
                    `
                    : '';

                return `
                    <tr>
                        <td>${escapeHtml(orderNumber)}</td>

                        <td>${escapeHtml(customerName)}</td>

                        <td>${escapeHtml(phone)}</td>

                        <td>
                            ${productsHtml}
                            ${totalHtml}
                        </td>

                        <td>${escapeHtml(status)}</td>

                        <td>${escapeHtml(date)}</td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('ORTHIVA orders error:', error);

            body.innerHTML = `
                <tr>
                    <td colspan="6">
                        تعذر تحميل الطلبات وتفاصيل المنتجات.
                        <br>
                        ${escapeHtml(error.message || String(error))}
                    </td>
                </tr>
            `;

            say(
                'تعذر تحميل الطلبات: ' +
                (error.message || String(error)) +
                ' — تحقق من سياسات RLS.',
                true
            );
        }
    }

    $('refresh-orders').addEventListener('click', loadOrders);

    // =========================================================
    // بدء التشغيل
    // =========================================================

    renderVariants();
    loadSession();

})();
