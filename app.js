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

  const wilayaDeliveryData = [
    { code: 1, name: "Adrar", label: "01 - أدرار", homeFee: 1100, deskFee: 600 },
    { code: 2, name: "Chlef", label: "02 - الشلف", homeFee: 700, deskFee: 400 },
    { code: 3, name: "Laghouat", label: "03 - الأغواط", homeFee: 900, deskFee: 500 },
    { code: 4, name: "Oum El Bouaghi", label: "04 - أم البواقي", homeFee: 800, deskFee: 400 },
    { code: 5, name: "Batna", label: "05 - باتنة", homeFee: 800, deskFee: 400 },
    { code: 6, name: "Béjaïa", label: "06 - بجاية", homeFee: 700, deskFee: 400 },
    { code: 7, name: "Biskra", label: "07 - بسكرة", homeFee: 900, deskFee: 500 },
    { code: 8, name: "Béchar", label: "08 - بشار", homeFee: 1100, deskFee: 600 },
    { code: 9, name: "Blida", label: "09 - البليدة", homeFee: 500, deskFee: 250 },
    { code: 10, name: "Bouira", label: "10 - البويرة", homeFee: 650, deskFee: 400 },
    { code: 11, name: "Tamanrasset", label: "11 - تمنراست", homeFee: 1300, deskFee: 800 },
    { code: 12, name: "Tébessa", label: "12 - تبسة", homeFee: 800, deskFee: 500 },
    { code: 13, name: "Tlemcen", label: "13 - تلمسان", homeFee: 800, deskFee: 400 },
    { code: 14, name: "Tiaret", label: "14 - تيارت", homeFee: 800, deskFee: 400 },
    { code: 15, name: "Tizi Ouzou", label: "15 - تيزي وزو", homeFee: 650, deskFee: 400 },
    { code: 16, name: "Alger", label: "16 - الجزائر", homeFee: 400, deskFee: 200 },
    { code: 17, name: "Djelfa", label: "17 - الجلفة", homeFee: 900, deskFee: 500 },
    { code: 18, name: "Jijel", label: "18 - جيجل", homeFee: 700, deskFee: 400 },
    { code: 19, name: "Sétif", label: "19 - سطيف", homeFee: 700, deskFee: 400 },
    { code: 20, name: "Saïda", label: "20 - سعيدة", homeFee: 800, deskFee: 400 },
    { code: 21, name: "Skikda", label: "21 - سكيكدة", homeFee: 700, deskFee: 400 },
    { code: 22, name: "Sidi Bel Abbès", label: "22 - سيدي بلعباس", homeFee: 700, deskFee: 400 },
    { code: 23, name: "Annaba", label: "23 - عنابة", homeFee: 700, deskFee: 400 },
    { code: 24, name: "Guelma", label: "24 - قالمة", homeFee: 800, deskFee: 400 },
    { code: 25, name: "Constantine", label: "25 - قسنطينة", homeFee: 700, deskFee: 400 },
    { code: 26, name: "Médéa", label: "26 - المدية", homeFee: 600, deskFee: 400 },
    { code: 27, name: "Mostaganem", label: "27 - مستغانم", homeFee: 700, deskFee: 400 },
    { code: 28, name: "M'Sila", label: "28 - المسيلة", homeFee: 800, deskFee: 500 },
    { code: 29, name: "Mascara", label: "29 - معسكر", homeFee: 700, deskFee: 400 },
    { code: 30, name: "Ouargla", label: "30 - ورقلة", homeFee: 900, deskFee: 500 },
    { code: 31, name: "Oran", label: "31 - وهران", homeFee: 700, deskFee: 400 },
    { code: 32, name: "El Bayadh", label: "32 - البيض", homeFee: 1000, deskFee: 500 },
    { code: 33, name: "Illizi", label: "33 - إليزي", homeFee: 1300, deskFee: 600 },
    { code: 34, name: "Bordj Bou Arreridj", label: "34 - برج بوعريريج", homeFee: 700, deskFee: 400 },
    { code: 35, name: "Boumerdès", label: "35 - بومرداس", homeFee: 600, deskFee: 350 },
    { code: 36, name: "El Tarf", label: "36 - الطارف", homeFee: 800, deskFee: 400 },
    { code: 37, name: "Tindouf", label: "37 - تندوف", homeFee: 1300, deskFee: 600 },
    { code: 38, name: "Tissemsilt", label: "38 - تيسمسيلت", homeFee: 800, deskFee: 400 },
    { code: 39, name: "El Oued", label: "39 - الوادي", homeFee: 900, deskFee: 500 },
    { code: 40, name: "Khenchela", label: "40 - خنشلة", homeFee: 800, deskFee: 500 },
    { code: 41, name: "Souk Ahras", label: "41 - سوق أهراس", homeFee: 800, deskFee: 500 },
    { code: 42, name: "Tipaza", label: "42 - تيبازة", homeFee: 600, deskFee: 350 },
    { code: 43, name: "Mila", label: "43 - ميلة", homeFee: 700, deskFee: 400 },
    { code: 44, name: "Aïn Defla", label: "44 - عين الدفلى", homeFee: 600, deskFee: 400 },
    { code: 45, name: "Naâma", label: "45 - النعامة", homeFee: 1000, deskFee: 500 },
    { code: 46, name: "Aïn Témouchent", label: "46 - عين تموشنت", homeFee: 700, deskFee: 400 },
    { code: 47, name: "Ghardaïa", label: "47 - غرداية", homeFee: 900, deskFee: 500 },
    { code: 48, name: "Relizane", label: "48 - غليزان", homeFee: 700, deskFee: 400 },
    { code: 49, name: "Timimoun", label: "49 - تيميمون", homeFee: 1300, deskFee: 600 },
    { code: 51, name: "Ouled Djellal", label: "51 - أولاد جلال", homeFee: 900, deskFee: 500 },
    { code: 52, name: "Beni Abbes", label: "52 - بني عباس", homeFee: 1300, deskFee: 0 },
    { code: 53, name: "In Salah", label: "53 - عين صالح", homeFee: 1300, deskFee: 600 },
    { code: 55, name: "Touggourt", label: "55 - تقرت", homeFee: 900, deskFee: 500 },
    { code: 57, name: "El M'Ghair", label: "57 - المغير", homeFee: 900, deskFee: 0 },
    { code: 58, name: "El Meniaa", label: "58 - المنيعة", homeFee: 1000, deskFee: 500 }
  ];
  const wilayaSelect = $('#wilaya-select');
  const deliveryMethodSelect = $('#delivery-method');

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

  // Populate only serviced wilayas. A zero desk fee means unavailable.
  if (wilayaSelect) wilayaDeliveryData.forEach((w) => wilayaSelect.add(new Option(w.label, w.name)));

  function selectedDelivery() {
    const wilaya = wilayaDeliveryData.find((w) => w.name === wilayaSelect?.value);
    const method = deliveryMethodSelect?.value;
    if (!wilaya || !method) return { wilaya, method: '', fee: 0, valid: false };
    const fee = method === 'home' ? wilaya.homeFee : method === 'desk' ? wilaya.deskFee : 0;
    return { wilaya, method, fee, valid: (method === 'home' && wilaya.homeFee > 0) || (method === 'desk' && wilaya.deskFee > 0) };
  }

  function updateDeliveryOptions() {
    if (!wilayaSelect || !deliveryMethodSelect) return;
    const wilaya = wilayaDeliveryData.find((w) => w.name === wilayaSelect.value);
    deliveryMethodSelect.innerHTML = '';
    deliveryMethodSelect.disabled = !wilaya;
    if (!wilaya) {
      deliveryMethodSelect.add(new Option('اختر الولاية أولًا', ''));
      $('#delivery-summary').textContent = 'اختر الولاية وطريقة التوصيل لمعرفة التكلفة.';
      updateCart(); return;
    }
    const available = [];
    if (wilaya.homeFee > 0) available.push({ value: 'home', label: `توصيل للمنزل — ${money(wilaya.homeFee)}` });
    if (wilaya.deskFee > 0) available.push({ value: 'desk', label: `توصيل للمكتب — ${money(wilaya.deskFee)}` });
    if (!available.length) {
      deliveryMethodSelect.add(new Option('التوصيل غير متاح', ''));
      deliveryMethodSelect.disabled = true;
      $('#delivery-summary').textContent = 'عذرًا، لا تتوفر أي طريقة توصيل لهذه الولاية.';
    } else if (available.length === 1) {
      deliveryMethodSelect.add(new Option(available[0].label, available[0].value, true, true));
      $('#delivery-summary').textContent = 'طريقة التوصيل الوحيدة المتاحة تم اختيارها تلقائيًا.';
    } else {
      deliveryMethodSelect.add(new Option('اختر طريقة التوصيل', ''));
      available.forEach((x) => deliveryMethodSelect.add(new Option(x.label, x.value)));
      $('#delivery-summary').textContent = 'يمكنك الاختيار بين التوصيل للمنزل أو للمكتب.';
    }
    updateCart();
  }
  wilayaSelect?.addEventListener('change', updateDeliveryOptions);
  deliveryMethodSelect?.addEventListener('change', updateCart);

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

    const subtotal = cart.reduce((n, x) => n + x.price * x.quantity, 0);
    const delivery = selectedDelivery();
    $('#products-subtotal').textContent = money(subtotal);
    $('#delivery-total').textContent = delivery.valid ? money(delivery.fee) : (wilayaSelect?.value ? 'اختر الطريقة' : '—');
    $('#cart-total').textContent = money(subtotal + (delivery.valid ? delivery.fee : 0));
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

      const delivery = selectedDelivery();
      if (!delivery.valid) {
        msg.textContent = 'يرجى اختيار ولاية وطريقة توصيل متاحة قبل تأكيد الطلب.';
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

        delivery_method: f.get('delivery_method'),

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
