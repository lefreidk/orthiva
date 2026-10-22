(() => {
    'use strict';

    const cfg = window.ORTHIVA_CONFIG || {};
    const $ = id => document.getElementById(id);

    const notice = $('notice');

    let db = null;
    let products = [];
    let variantRows = [];

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

    if (
        !window.supabase ||
        !cfg.SUPABASE_URL ||
        !cfg.SUPABASE_ANON_KEY
    ) {
        $('connection-status').textContent = 'إعدادات الاتصال ناقصة';
        say('تعذر تهيئة Supabase. تحقق من config.js.', true);
        return;
    }

    db = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
    );

    $('connection-status').textContent = 'تم تهيئة عميل Supabase';

    function toggleLoggedIn(user) {
        $('login-panel').classList.toggle('hidden', !!user);
        $('admin-area').classList.toggle('hidden', !user);
        $('logout').classList.toggle('hidden', !user);
    }

    async function loadSession() {
        const { data, error } = await db.auth.getSession();

        if (error) {
            say('تعذر التحقق من الجلسة: ' + error.message, true);
            return;
        }

        toggleLoggedIn(data.session?.user || null);

        if (data.session?.user) {
            say('تم تسجيل الدخول. جارٍ تحميل البيانات...');
            await loadProducts();
        }
    }

    $('login-form').addEventListener('submit', async event => {
        event.preventDefault();

        const button = event.submitter;
        if (button) button.disabled = true;

        say('جارٍ تسجيل الدخول...');

        try {
            const { data, error } = await db.auth.signInWithPassword({
                email: $('email').value.trim(),
                password: $('password').value
            });

            if (error) throw error;

            toggleLoggedIn(data.user);

            say('تم تسجيل الدخول. جارٍ تحميل المنتجات...');
            await loadProducts();

        } catch (error) {
            say('فشل تسجيل الدخول: ' + error.message, true);
        } finally {
            if (button) button.disabled = false;
        }
    });

    $('logout').addEventListener('click', async () => {
        const { error } = await db.auth.signOut();

        if (error) {
            say('تعذر تسجيل الخروج: ' + error.message, true);
            return;
        }

        toggleLoggedIn(null);
        say('تم تسجيل الخروج.');
    });

    db.auth.onAuthStateChange((_event, session) => {
        toggleLoggedIn(session?.user || null);
    });

    async function loadProducts() {
        const body = $('products-body');

        body.innerHTML =
            '<tr><td colspan="5">جارٍ تحميل المنتجات...</td></tr>';

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
                    is_active
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            body.innerHTML =
                '<tr><td colspan="5">تعذر تحميل المنتجات.</td></tr>';

            say(
                'تعذر قراءة المنتجات: ' + error.message +
                ' — تحقق من صلاحيات Supabase وسياسات RLS.',
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
                                ? `<img class="thumb"
                                    src="${escapeHtml(product.image_url)}"
                                    alt="">`
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
            : '<tr><td colspan="5">لا توجد منتجات.</td></tr>';
    }

    // =========================================================
    // إدارة المقاسات والألوان
    // =========================================================

    function renderVariants() {
        const body = $('variants-body');

        if (!variantRows.length) {
            body.innerHTML =
                '<tr><td colspan="5">أضف مقاسًا ولونًا واحدًا على الأقل.</td></tr>';
            return;
        }

        const defaultSizes = [
            '36', '37', '38', '39', '40', '41',
            '42', '43', '44', '45', '46'
        ];

        const defaultColors = [
            'أسود', 'أبيض', 'بني', 'بيج',
            'رمادي', 'كحلي', 'وردي', 'أزرق', 'أخضر'
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
                            required>
                            <option value="" disabled
                                ${currentSize ? '' : 'selected'}>
                                اختر المقاس
                            </option>

                            ${sizes.map(size => `
                                <option
                                    value="${escapeHtml(size)}"
                                    ${currentSize === size ? 'selected' : ''}>
                                    ${escapeHtml(size)}
                                </option>
                            `).join('')}
                        </select>
                    </td>

                    <td>
                        <select
                            aria-label="اللون"
                            data-vcolor="${index}"
                            required>
                            <option value="" disabled
                                ${currentColor ? '' : 'selected'}>
                                اختر اللون
                            </option>

                            ${colors.map(color => `
                                <option
                                    value="${escapeHtml(color)}"
                                    ${currentColor === color ? 'selected' : ''}>
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
                            style="width:90px">
                    </td>

                    <td>
                        <select
                            aria-label="حالة الخيار"
                            data-vactive="${index}">
                            <option value="true"
                                ${variant.is_active !== false ? 'selected' : ''}>
                                نشط
                            </option>

                            <option value="false"
                                ${variant.is_active === false ? 'selected' : ''}>
                                متوقف
                            </option>
                        </select>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="btn danger"
                            data-vremove="${index}">
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
                    'تعذر قراءة صف المقاس واللون رقم ' +
                    (index + 1) +
                    '. حدّث الصفحة وحاول مجددًا.'
                );
            }

            updatedRows.push({
                ...variantRows[index],
                size: size.value.trim(),
                color: color.value.trim(),
                stock_quantity: stock.value === ''
                    ? NaN
                    : Number(stock.value),
                is_active: active.value === 'true'
            });
        }

        variantRows = updatedRows;
    }

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

    $('variants-body').addEventListener('click', event => {
        const button = event.target.closest('[data-vremove]');

        if (!button) return;

        try {
            readVariantInputs();

            const index = Number(button.dataset.vremove);

            if (!Number.isInteger(index) || index < 0 ||
                index >= variantRows.length) {
                throw new Error('تعذر تحديد الخيار المطلوب حذفه.');
            }

            variantRows.splice(index, 1);
            renderVariants();

        } catch (error) {
            say(error.message, true);
        }
    });

    // =========================================================
    // حفظ جميع الخيارات والتحقق من تكرار المقاسات والألوان
    // =========================================================

    async function saveVariants(productId) {
        readVariantInputs();

        if (!variantRows.length) {
            throw new Error(
                'أضف مقاسًا ولونًا واحدًا على الأقل قبل حفظ المنتج.'
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
                    `الكمية في الصف رقم ${index + 1} يجب أن تكون عددًا صحيحًا غير سالب.`
                );
            }

            const combinationKey =
                `${variant.size.trim().toLowerCase()}::` +
                `${variant.color.trim().toLowerCase()}`;

            if (combinations.has(combinationKey)) {
                throw new Error(
                    `المقاس ${variant.size} واللون ${variant.color} مكرران. ` +
                    'كل تركيبة مقاس ولون يجب أن تكون فريدة.'
                );
            }

            combinations.add(combinationKey);
        }

        const oldVariants =
            products.find(product =>
                String(product.id) === String(productId)
            )?.variants || [];

        const currentIds = new Set(
            variantRows
                .filter(variant => variant.id)
                .map(variant => String(variant.id))
        );

        // أولًا: تحديث الخيارات الموجودة.
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
                    `فشل تحديث المقاس ${variant.size} واللون ${variant.color}: ` +
                    error.message
                );
            }
        }

        // ثانيًا: إدراج كل الخيارات الجديدة في طلب واحد.
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
                    'فشل حفظ الخيارات الجديدة: ' + error.message
                );
            }
        }

        // ثالثًا: تعطيل الخيارات التي أزيلت من النموذج.
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
                    'تعذر إيقاف الخيار المحذوف ' +
                    `${variant.size}/${variant.color}: ${error.message}`
                );
            }
        }
    }

    // =========================================================
    // نموذج المنتج
    // =========================================================

    function resetForm() {
        $('product-form').reset();

        variantRows = [];
        renderVariants();

        $('product-id').value = '';
        $('category').value = 'medical-shoes';
        $('is_published').value = 'false';
        $('form-heading').textContent = 'إضافة منتج';
        $('save-product').textContent = 'حفظ المنتج';
        $('image-file').value = '';
    }

    $('reset-form').addEventListener('click', event => {
        event.preventDefault();
        resetForm();
    });

    $('refresh-products').addEventListener('click', loadProducts);

    $('name').addEventListener('input', () => {
        if (!$('product-id').value) {
            $('slug').value = $('name').value
                .trim()
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]+/gu, '-')
                .replace(/^-|-$/g, '');
        }
    });

    async function uploadImage(file) {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.type)) {
            throw new Error('اختر صورة JPG أو PNG أو WebP.');
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
            throw new Error('فشل رفع الصورة: ' + error.message);
        }

        const { data } = db
            .storage
            .from('orthiva-products')
            .getPublicUrl(path);

        return data.publicUrl;
    }

    $('product-form').addEventListener('submit', async event => {
        event.preventDefault();

        const button = $('save-product');

        if (button.disabled) return;

        button.disabled = true;

        try {
            // التحقق من الخيارات قبل إنشاء المنتج أو تحديثه.
            readVariantInputs();

            if (!variantRows.length) {
                throw new Error(
                    'أضف مقاسًا ولونًا واحدًا على الأقل.'
                );
            }

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
                        `تحقق من الكمية في الصف رقم ${index + 1}.`
                    );
                }
            }

            let imageUrl = $('image_url').value.trim() || null;

            const file = $('image-file').files[0];

            if (file) {
                say('جارٍ رفع الصورة...');
                imageUrl = await uploadImage(file);
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
                image_url: imageUrl,
                images: imageUrl ? [imageUrl] : [],
                is_published: $('is_published').value === 'true'
            };

            const id = $('product-id').value;

            say(
                id
                    ? 'جارٍ تحديث المنتج وخياراته...'
                    : 'جارٍ إنشاء المنتج وحفظ خياراته...'
            );

            const result = id
                ? await db
                    .from('products')
                    .update(payload)
                    .eq('id', id)
                    .select()
                    .single()
                : await db
                    .from('products')
                    .insert(payload)
                    .select()
                    .single();

            if (result.error) {
                throw new Error(
                    'فشل حفظ بيانات المنتج: ' + result.error.message
                );
            }

            const savedProduct = result.data;

            await saveVariants(savedProduct.id);

            say(
                id
                    ? 'تم تحديث المنتج وجميع المقاسات والألوان والمخزون بنجاح.'
                    : 'تمت إضافة المنتج وحفظ جميع المقاسات والألوان والمخزون بنجاح.'
            );

            resetForm();
            await loadProducts();

        } catch (error) {
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
            $('image_url').value = product.image_url || '';
            $('is_published').value =
                String(!!product.is_published);

            variantRows = (product.variants || []).map(variant => ({
                ...variant
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
                !confirm(`هل تريد حذف المنتج «${product.name}»؟`)
            ) {
                return;
            }

            const { error } = await db
                .from('products')
                .delete()
                .eq('id', product.id);

            if (error) {
                say('تعذر حذف المنتج: ' + error.message, true);
            } else {
                say('تم حذف المنتج.');
                await loadProducts();
            }
        }
    });

    // =========================================================
    // الطلبات
    // =========================================================

    $('refresh-orders').addEventListener('click', async () => {
        const body = $('orders-body');

        body.innerHTML =
            '<tr><td colspan="5">جارٍ تحميل الطلبات...</td></tr>';

        const { data, error } = await db
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            body.innerHTML =
                '<tr><td colspan="5">تعذر تحميل الطلبات.</td></tr>';

            say('تعذر قراءة الطلبات: ' + error.message, true);
            return;
        }

        body.innerHTML = (data || []).length
            ? data.map(order => `
                <tr>
                    <td>
                        ${escapeHtml(order.order_number ?? order.id ?? '—')}
                    </td>
                    <td>${escapeHtml(order.customer_name ?? '—')}</td>
                    <td>${escapeHtml(order.phone ?? '—')}</td>
                    <td>${escapeHtml(order.status ?? '—')}</td>
                    <td>${escapeHtml(order.created_at ?? '—')}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5">لا توجد طلبات.</td></tr>';
    });

    renderVariants();
    loadSession();

})();
