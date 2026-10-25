(() => {
  const cfg = window.ORTHIVA_CONFIG || {};

  const configured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes('YOUR_PROJECT') &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

  const db =
    configured && window.supabase
      ? window.supabase.createClient(
          cfg.SUPABASE_URL,
          cfg.SUPABASE_ANON_KEY
        )
      : null;

  const $ = (s) => document.querySelector(s);

  const money = (n) =>
    `${Number(n || 0).toLocaleString('ar-DZ')} ${cfg.CURRENCY || 'دج'}`;

  let products = [];
  let variants = [];
  let cart = [];
  let category = 'all';
  let selectedProduct = null;

  // استعادة السلة من التخزين المحلي
  try {
    const saved = JSON.parse(
      localStorage.getItem('orthiva_cart') || '[]'
    );

    if (Array.isArray(saved)) {
      cart = saved
        .filter(
          (x) =>
            x &&
            typeof x.variant_id === 'string' &&
            Number.isInteger(x.quantity) &&
            x.quantity > 0 &&
            x.quantity <= 20
        )
        .slice(0, 20);
    }
  } catch {
    cart = [];
  }

  $('#year').textContent = new Date().getFullYear();

  // إشعارات المتجر
  function toast(msg) {
    const el = $('#toast');

    el.textContent = msg;
    el.classList.add('show');

    setTimeout(() => {
      el.classList.remove('show');
    }, 2600);
  }

  // حماية النصوص عند عرضها في HTML
  function safe(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }

  // ==================================================
  // استخراج جميع صور المنتج
  // يدعم:
  // 1. مصفوفة روابط
  // 2. نص JSON يحتوي على مصفوفة
  // 3. مصفوفة كائنات تحتوي على url أو image_url
  // 4. استخدام image_url كصورة رئيسية احتياطية
  // ==================================================

  function getProductImages(product) {
    let source = product?.images;
    let images = [];

    if (Array.isArray(source)) {
      images = source;
    } else if (typeof source === 'string' && source.trim()) {
      try {
        const parsed = JSON.parse(source);

        if (Array.isArray(parsed)) {
          images = parsed;
        } else if (typeof parsed === 'string') {
          images = [parsed];
        }
      } catch {
        // إذا كانت قيمة images رابطًا مباشرًا
        images = source.trim().startsWith('http')
          ? [source.trim()]
          : [];
      }
    }

    images = images
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }

        if (item && typeof item.url === 'string') {
          return item.url.trim();
        }

        if (item && typeof item.image_url === 'string') {
          return item.image_url.trim();
        }

        return '';
      })
      .filter(Boolean);

    // إضافة الصورة الرئيسية إذا لم تكن موجودة
    if (
      product?.image_url &&
      !images.includes(product.image_url)
    ) {
      images.unshift(product.image_url);
    }

    // إزالة الروابط المكررة
    return [...new Set(images)];
  }

  // ==================================================
  // تحميل المنتجات من Supabase
  // ==================================================

  async function loadProducts() {
    if (!db) {
      $('#product-grid').innerHTML = `
        <div class="empty-state">
          أضف إعدادات Supabase في ملف
          <b>config.js</b>
          لعرض المنتجات الحقيقية.
        </div>
      `;
      return;
    }

    const { data, error } = await db
      .from('products')
      .select(
        'id,name,slug,description,category,price,compare_at_price,image_url,images,is_published,product_variants(id,size,color,stock_quantity,is_active)'
      )
      .eq('is_published', true)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      $('#product-grid').innerHTML = `
        <div class="empty-state">
          تعذر تحميل المنتجات. تحقق من إعدادات
          Supabase وسياسات القراءة.
        </div>
      `;

      console.error(error);
      return;
    }

    products = (data || []).map((p) => ({
      ...p,
      variants: (p.product_variants || []).filter(
        (v) => v.is_active
      )
    }));

    renderProducts();
  }

  // ==================================================
  // عرض المنتجات في الصفحة الرئيسية
  // ==================================================

  function renderProducts() {
    const q = ($('#search').value || '')
      .trim()
      .toLowerCase();

    const list = products.filter((p) => {
      const matchesCategory =
        category === 'all' ||
        String(p.category || '')
          .trim()
          .toLocaleLowerCase('ar') ===
          category.toLocaleLowerCase('ar') ||
        String(p.category || '').includes(category);

      const matchesSearch =
        `${p.name} ${p.category} ${p.description || ''}`
          .toLowerCase()
          .includes(q);

      return matchesCategory && matchesSearch;
    });

    $('#product-grid').innerHTML = list.length
      ? list
          .map((p) => {
            const images = getProductImages(p);
            const mainImage = images[0];

            return `
              <article class="product-card">

                <div
                  class="product-image"
                  data-view="${safe(p.id)}"
                >
                  ${
                    mainImage
                      ? `
                        <img
                          src="${safe(mainImage)}"
                          alt="${safe(p.name)}"
                          loading="lazy"
                        >
                      `
                      : `
                        <span class="image-fallback">◌</span>
                      `
                  }
                </div>

                <div class="product-info">

                  <span class="product-category">
                    ${safe(p.category || 'ORTHIVA')}
                  </span>

                  <h3>${safe(p.name)}</h3>

                  <div class="product-price">
                    ${money(p.price)}

                    ${
                      p.compare_at_price
                        ? `
                          <span class="old-price">
                            ${money(p.compare_at_price)}
                          </span>
                        `
                        : ''
                    }
                  </div>

                  <div class="card-actions">

                    <button
                      type="button"
                      data-view="${safe(p.id)}"
                    >
                      التفاصيل
                    </button>

                    <button
                      type="button"
                      data-quick="${safe(p.id)}"
                    >
                      أضف للسلة
                    </button>

                  </div>

                </div>
              </article>
            `;
          })
          .join('')
      : `
        <div class="empty-state">
          لا توجد منتجات مطابقة حاليًا.
        </div>
      `;
  }

  // ==================================================
  // فتح وإغلاق النوافذ
  // ==================================================

  function showModal(id) {
    $('#' + id).hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function hideModal(id) {
    $('#' + id).hidden = true;
    document.body.style.overflow = '';
  }

  // ==================================================
  // تفاصيل المنتج ومعرض الصور
  // ==================================================

  function openProduct(id, quick = false) {
    const p = products.find(
      (x) => String(x.id) === String(id)
    );

    if (!p) return;

    selectedProduct = p;

    // جميع الصور الخاصة بهذا المنتج
    const images = getProductImages(p);

    // المقاسات والألوان المتوفرة في المخزون
    const available = p.variants.filter(
      (v) => Number(v.stock_quantity) > 0
    );

    $('#product-detail').innerHTML = `
      <div class="product-detail-layout">

        <!-- معرض صور المنتج -->

        <div class="detail-gallery">

          <div class="detail-image">

            ${
              images.length
                ? `
                  <img
                    id="main-product-image"
                    src="${safe(images[0])}"
                    alt="${safe(p.name)}"
                  >
                `
                : `
                  <span class="image-fallback">◌</span>
                `
            }

          </div>

          ${
            images.length > 1
              ? `
                <div
                  class="detail-thumbnails"
                  aria-label="صور المنتج"
                >

                  ${images
                    .map(
                      (url, index) => `
                        <button
                          type="button"
                          class="detail-thumbnail ${
                            index === 0 ? 'active' : ''
                          }"
                          data-image-index="${index}"
                          aria-label="عرض الصورة ${index + 1}"
                          aria-pressed="${
                            index === 0 ? 'true' : 'false'
                          }"
                        >

                          <img
                            src="${safe(url)}"
                            alt="${safe(p.name)} - ${index + 1}"
                            loading="lazy"
                          >

                        </button>
                      `
                    )
                    .join('')}

                </div>
              `
              : ''
          }

        </div>

        <!-- معلومات المنتج -->

        <div class="detail-copy">

          <span class="eyebrow">
            ${safe(p.category || 'ORTHIVA')}
          </span>

          <h2>${safe(p.name)}</h2>

          <strong class="product-price">
            ${money(p.price)}
          </strong>

          <p>
            ${safe(
              p.description ||
              'حذاء مختار لراحة يومية.'
            )}
          </p>

          <label
            class="field-label"
            for="variant-select"
          >
            اختر المقاس واللون
          </label>

          <select
            class="option-select"
            id="variant-select"
            ${available.length ? '' : 'disabled'}
          >

            ${
              available
                .map(
                  (v) => `
                    <option value="${safe(v.id)}">
                      ${safe(v.size)} — ${safe(v.color)}
                      (متوفر: ${v.stock_quantity})
                    </option>
                  `
                )
                .join('')
            }

          </select>

          <p>
            ${
              available.length
                ? 'اختر الخيار المناسب قبل الإضافة.'
                : `
                  لا توجد خيارات متاحة لهذا المنتج حاليًا.
                  يرجى التواصل مع المتجر أو مراجعة المقاسات
                  والألوان من لوحة الإدارة.
                `
            }
          </p>

          <button
            id="add-selected"
            class="primary-btn full-btn"
            ${available.length ? '' : 'disabled'}
          >
            أضف إلى السلة
          </button>

        </div>

      </div>
    `;

    // ================================================
    // تغيير الصورة الكبيرة عند الضغط على صورة مصغرة
    // ================================================

    const detail = $('#product-detail');
    const mainImage = $('#main-product-image');

    detail
      .querySelectorAll('[data-image-index]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number(
            button.dataset.imageIndex
          );

          if (!mainImage || !images[index]) {
            return;
          }

          // تغيير الصورة الرئيسية
          mainImage.src = images[index];

          // تحديث الصورة المصغرة النشطة
          detail
            .querySelectorAll('.detail-thumbnail')
            .forEach((thumbnail) => {
              const active = thumbnail === button;

              thumbnail.classList.toggle(
                'active',
                active
              );

              thumbnail.setAttribute(
                'aria-pressed',
                active ? 'true' : 'false'
              );
            });
        });
      });

    // ================================================
    // إضافة المنتج إلى السلة
    // ================================================

    $('#add-selected').addEventListener(
      'click',
      () => {
        const variant = available.find(
          (v) =>
            String(v.id) ===
            $('#variant-select').value
        );

        if (variant) {
          addToCart(p, variant);
        }
      }
    );

    showModal('product-modal');

    if (quick && available.length === 0) {
      toast('هذا المنتج غير متوفر حاليًا');
    }
  }

  // ==================================================
  // إضافة منتج إلى السلة
  // ==================================================

  function addToCart(p, v) {
    const existing = cart.find(
      (x) =>
        String(x.variant_id) === String(v.id)
    );

    if (existing) {
      if (
        existing.quantity >= v.stock_quantity
      ) {
        toast('الكمية المطلوبة تتجاوز المخزون');
        return;
      }

      existing.quantity++;
    } else {
      cart.push({
        product_id: p.id,
        variant_id: v.id,
        name: p.name,
        size: v.size,
        color: v.color,
        price: Number(p.price),
        quantity: 1,
        max_stock: Number(v.stock_quantity)
      });
    }

    updateCart();

    hideModal('product-modal');
    showModal('cart-modal');

    toast(
      'تمت إضافة المنتج إلى السلة — أكمل معلوماتك لإرسال الطلب'
    );
  }

  // ==================================================
  // تحديث السلة
  // ==================================================

  function updateCart() {
    try {
      localStorage.setItem(
        'orthiva_cart',
        JSON.stringify(cart)
      );
    } catch {}

    const count = cart.reduce(
      (n, x) => n + x.quantity,
      0
    );

    $('#cart-count').textContent = count;

    $('#cart-lines').innerHTML = cart.length
      ? cart
          .map(
            (x, i) => `
              <div class="cart-line">

                <span>
                  ${safe(x.name)} —
                  ${safe(x.size)} /
                  ${safe(x.color)}

                  <br>

                  <small>
                    ${money(x.price)} × ${x.quantity}
                  </small>
                </span>

                <span>
                  ${money(x.price * x.quantity)}

                  <br>

                  <button
                    type="button"
                    data-remove="${i}"
                  >
                    حذف
                  </button>
                </span>

              </div>
            `
          )
          .join('')
      : `
        <div class="empty-state">
          السلة فارغة. اختر منتجًا للمتابعة.
        </div>
      `;

    $('#cart-total').textContent = money(
      cart.reduce(
        (n, x) => n + x.price * x.quantity,
        0
      ) + Number(cfg.DELIVERY_FEE || 0)
    );
  }

  // ==================================================
  // أحداث المنتجات
  // ==================================================

  $('#product-grid').addEventListener(
    'click',
    (e) => {
      const view = e.target.closest('[data-view]');
      const quick = e.target.closest('[data-quick]');

      if (view) {
        openProduct(view.dataset.view);
      } else if (quick) {
        openProduct(
          quick.dataset.quick,
          true
        );
      }
    }
  );

  // تصفية المنتجات حسب الفئة
  $('#category-filters').addEventListener(
    'click',
    (e) => {
      const button = e.target.closest(
        '[data-category]'
      );

      if (!button) return;

      category = button.dataset.category;

      document
        .querySelectorAll('.filter')
        .forEach((item) => {
          item.classList.toggle(
            'active',
            item === button
          );
        });

      renderProducts();
    }
  );

  // البحث
  $('#search').addEventListener(
    'input',
    renderProducts
  );

  // إغلاق النوافذ وحذف المنتجات من السلة
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]');

    if (close) {
      hideModal(close.dataset.close);
    }

    const remove = e.target.closest('[data-remove]');

    if (remove) {
      cart.splice(
        Number(remove.dataset.remove),
        1
      );

      updateCart();
    }
  });

  // فتح السلة
  $('#open-cart').addEventListener(
    'click',
    () => {
      updateCart();
      showModal('cart-modal');
    }
  );

  // إغلاق النافذة عند الضغط على الخلفية
  document
    .querySelectorAll('.modal-backdrop')
    .forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          hideModal(el.id);
        }
      });
    });

  // ==================================================
  // إرسال الطلب
  // ==================================================

  $('#checkout-form').addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();

      const msg = $('#checkout-message');

      if (!cart.length) {
        msg.textContent = 'السلة فارغة.';
        return;
      }

      if (!db) {
        msg.textContent =
          'يجب إعداد Supabase أولًا قبل إرسال الطلب.';
        return;
      }

      const f = new FormData(e.currentTarget);

      const payload = {
        customer_name: f
          .get('customer_name')
          .trim(),

        phone: f
          .get('phone')
          .trim(),

        wilaya: f
          .get('wilaya')
          .trim(),

        municipality: f
          .get('municipality')
          .trim(),

        address: f
          .get('address')
          .trim(),

        customer_note: f
          .get('customer_note')
          .trim(),

        items: cart.map((x) => ({
          variant_id: x.variant_id,
          quantity: x.quantity
        }))
      };

      // منع تكرار الطلب عند إعادة المحاولة
      const fingerprint = JSON.stringify(payload);

      let pending = null;

      try {
        pending = JSON.parse(
          localStorage.getItem(
            'orthiva_pending_order'
          ) || 'null'
        );
      } catch {}

      if (
        !pending ||
        pending.fingerprint !== fingerprint
      ) {
        const key = window.crypto?.randomUUID
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
              .replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;

                return (
                  c === 'x'
                    ? r
                    : (r & 3 | 8)
                ).toString(16);
              });

        pending = {
          fingerprint,
          key
        };

        try {
          localStorage.setItem(
            'orthiva_pending_order',
            JSON.stringify(pending)
          );
        } catch {}
      }

      payload.request_id = pending.key;

      const button = e.currentTarget.querySelector(
        'button[type="submit"]'
      );

      button.disabled = true;
      msg.textContent = 'جارٍ إرسال الطلب…';

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify(payload)
        });

        const result = await res
          .json()
          .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            result.error || 'تعذر إرسال الطلب'
          );
        }

        msg.textContent =
          `تم تسجيل طلبك بنجاح. رقم الطلب: ${
            result.order_number ||
            result.order_id ||
            '—'
          }`;

        try {
          localStorage.removeItem(
            'orthiva_pending_order'
          );
        } catch {}

        cart = [];

        updateCart();

        e.currentTarget.reset();
      } catch (err) {
        msg.textContent =
          err.message +
          ' — تحقق من إعداد وظيفة الخادم قبل استقبال طلبات حقيقية.';
      } finally {
        button.disabled = false;
      }
    }
  );

  // بدء تشغيل المتجر
  loadProducts();
  updateCart();
})();
