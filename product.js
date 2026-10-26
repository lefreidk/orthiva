(() => {
'use strict';
const cfg = window.ORTHIVA_CONFIG || {};
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase;
const db = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
const money = n => `${Number(n || 0).toLocaleString('ar-DZ')} ${cfg.CURRENCY || 'دج'}`;
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
const productId = params.get('id');
let product = null, images = [], available = [];
const wilayas = [
[1,'أدرار',1100,600],[2,'الشلف',700,400],[3,'الأغواط',900,500],[4,'أم البواقي',800,400],[5,'باتنة',800,400],[6,'بجاية',700,400],[7,'بسكرة',900,500],[8,'بشار',1100,600],[9,'البليدة',500,250],[10,'البويرة',650,400],[11,'تمنراست',1300,800],[12,'تبسة',800,500],[13,'تلمسان',800,400],[14,'تيارت',800,400],[15,'تيزي وزو',650,400],[16,'الجزائر',400,200],[17,'الجلفة',900,500],[18,'جيجل',700,400],[19,'سطيف',700,400],[20,'سعيدة',800,400],[21,'سكيكدة',700,400],[22,'سيدي بلعباس',700,400],[23,'عنابة',700,400],[24,'قالمة',800,400],[25,'قسنطينة',700,400],[26,'المدية',600,400],[27,'مستغانم',700,400],[28,'المسيلة',800,500],[29,'معسكر',700,400],[30,'ورقلة',900,500],[31,'وهران',700,400],[32,'البيض',1000,500],[33,'إليزي',1300,600],[34,'برج بوعريريج',700,400],[35,'بومرداس',600,350],[36,'الطارف',800,400],[37,'تندوف',1300,600],[38,'تيسمسيلت',800,400],[39,'الوادي',900,500],[40,'خنشلة',800,500],[41,'سوق أهراس',800,500],[42,'تيبازة',600,350],[43,'ميلة',700,400],[44,'عين الدفلى',600,400],[45,'النعامة',1000,500],[46,'عين تموشنت',700,400],[47,'غرداية',900,500],[48,'غليزان',700,400],[49,'تيميمون',1300,600],[51,'أولاد جلال',900,500],[52,'بني عباس',1300,0],[53,'عين صالح',1300,600],[55,'تقرت',900,500],[57,'المغير',900,0],[58,'المنيعة',1000,500]
].map(([code,label,homeFee,deskFee])=>({code,label,homeFee,deskFee}));
function parseImages(p) {
 let list = [];
 if (Array.isArray(p.images)) list = p.images;
 else if (typeof p.images === 'string' && p.images.trim()) {
   try { const v=JSON.parse(p.images); list=Array.isArray(v)?v:[v]; } catch { if(p.images.startsWith('http')) list=[p.images]; }
 }
 list=list.map(v=>typeof v==='string'?v:(v?.url||v?.image_url||'')).filter(Boolean);
 if(p.image_url && !list.includes(p.image_url)) list.unshift(p.image_url);
 return [...new Set(list)];
}
function setImage(index) {
 const url=images[index]; if(!url) return;
 $('product-main-image').innerHTML='<img src="'+safe(url)+'" alt="'+safe(product.name)+'">';
 document.querySelectorAll('.product-page-thumb').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',i===index?'true':'false');});
}
function selectedVariant(){return available.find(v=>String(v.id)===$('product-variant').value)||null;}
function selectedDelivery(){
 const w=wilayas.find(x=>x.label===$('product-wilaya').value), method=$('product-delivery-method').value;
 if(!w||!method) return {valid:false,fee:0,w};
 const fee=method==='home'?w.homeFee:w.deskFee;
 return {valid:fee>0,fee,w,method};
}
function updateSummary(){
 const v=selectedVariant(), qty=Math.max(1,Math.min(Number($('product-quantity').value)||1,20));
 $('product-quantity').value=qty;
 $('summary-product-name').textContent=product?.name||'—';
 $('summary-variant').textContent=v?`${v.size} — ${v.color}`:'—';
 $('summary-quantity').textContent=qty;
 const subtotal=Number(product?.price||0)*qty, d=selectedDelivery();
 $('summary-subtotal').textContent=money(subtotal);
 $('summary-delivery').textContent=d.valid?money(d.fee):($('product-wilaya').value?'اختر طريقة متاحة':'—');
 $('summary-total').textContent=money(subtotal+(d.valid?d.fee:0));
 $('stock-note').textContent=v?`المتوفر: ${v.stock_quantity}`:'';
 $('product-submit').disabled=!v||!d.valid;
}
function updateDeliveryOptions(){
 const select=$('product-delivery-method'), w=wilayas.find(x=>x.label===$('product-wilaya').value);
 select.innerHTML=''; select.disabled=!w;
 if(!w){select.add(new Option('اختر الولاية أولًا',''));$('product-delivery-summary').textContent='اختر الولاية وطريقة التوصيل لمعرفة التكلفة.';updateSummary();return;}
 const opts=[];
 if(w.homeFee>0)opts.push({value:'home',label:`للمنزل — ${money(w.homeFee)}`});
 if(w.deskFee>0)opts.push({value:'desk',label:`للمكتب — ${money(w.deskFee)}`});
 if(opts.length===1){select.add(new Option(opts[0].label,opts[0].value,true,true));$('product-delivery-summary').textContent='تم اختيار طريقة التوصيل الوحيدة المتاحة تلقائيًا.';}
 else if(opts.length>1){select.add(new Option('اختر طريقة التوصيل',''));opts.forEach(o=>select.add(new Option(o.label,o.value)));$('product-delivery-summary').textContent='اختر التوصيل للمنزل أو للمكتب.';}
 else {select.add(new Option('التوصيل غير متاح',''));select.disabled=true;$('product-delivery-summary').textContent='عذرًا، التوصيل غير متاح لهذه الولاية.';}
 updateSummary();
}
function renderProduct(){
 $('product-loading').hidden=true; $('product-content').hidden=false;
 document.title=product.name+' | ORTHIVA'; $('breadcrumb-name').textContent=product.name;
 $('product-name').textContent=product.name; $('product-category').textContent=product.category||'ORTHIVA';
 $('product-price').textContent=money(product.price);
 if(Number(product.compare_at_price)>Number(product.price)){ $('product-old-price').textContent=money(product.compare_at_price);$('product-old-price').hidden=false;$('product-discount').textContent='وفر '+money(product.compare_at_price-product.price);$('product-discount').hidden=false; }
 $('product-description').textContent=product.description||'حذاء مختار لراحة يومية. اختر المقاس واللون المناسبين ثم أكمل معلومات التوصيل.';
 $('product-availability').textContent=available.length?'متوفر للطلب':'غير متوفر حاليًا';
 images=parseImages(product);
 $('product-main-image').innerHTML=images.length?'<img src="'+safe(images[0])+'" alt="'+safe(product.name)+'">':'<span class="image-fallback">◌</span>';
 $('product-page-thumbnails').innerHTML=images.length>1?images.map((url,i)=>'<button type="button" class="product-page-thumb '+(!i?'active':'')+'" data-image="'+i+'" aria-label="عرض الصورة '+(i+1)+'" aria-pressed="'+(!i?'true':'false')+'"><img src="'+safe(url)+'" alt="'+safe(product.name)+' '+(i+1)+'" loading="lazy"></button>').join(''):'';
 $('product-variant').innerHTML=available.length?available.map(v=>'<option value="'+safe(v.id)+'">'+safe(v.size)+' — '+safe(v.color)+' (متوفر '+Number(v.stock_quantity)+')</option>').join(''):'<option value="">لا توجد مقاسات أو ألوان متاحة</option>';
 $('product-variant').disabled=!available.length;
 $('product-quantity').max=available.length?Math.min(20,Math.max(...available.map(v=>Number(v.stock_quantity)||1))):1;
 $('product-quantity').disabled=!available.length;
 $('product-submit').disabled=!available.length;
 $('product-availability').classList.toggle('out-of-stock',!available.length);
 if(!available.length) $('product-order-message').textContent='هذا المنتج غير متوفر حاليًا. يمكنك التواصل معنا عبر واتساب.';
 updateSummary();
}
async function loadProduct(){
 if(!productId){$('product-loading').hidden=true;$('product-error').hidden=false;$('product-error').textContent='رابط المنتج غير مكتمل. ارجع إلى المتجر واختر المنتج من جديد.';return;}
 if(!db){$('product-loading').hidden=true;$('product-error').hidden=false;$('product-error').textContent='تعذر الاتصال بالمتجر. تحقق من إعدادات الاتصال ثم أعد المحاولة.';return;}
 const {data,error}=await db.from('products').select('id,name,slug,description,category,price,compare_at_price,image_url,images,is_published,product_variants(id,size,color,stock_quantity,is_active)').eq('id',productId).eq('is_published',true).maybeSingle();
 if(error||!data){console.error(error);$('product-loading').hidden=true;$('product-error').hidden=false;$('product-error').textContent='لم نتمكن من العثور على هذا المنتج. قد يكون غير متاح أو لم يعد منشورًا.';return;}
 product=data;available=(data.product_variants||[]).filter(v=>v.is_active&&Number(v.stock_quantity)>0);
 renderProduct();
}
$('product-page-thumbnails').addEventListener('click',e=>{const b=e.target.closest('[data-image]');if(b)setImage(Number(b.dataset.image));});
$('product-variant').addEventListener('change',updateSummary);
$('product-quantity').addEventListener('input',updateSummary);
$('quantity-minus').addEventListener('click',()=>{$('product-quantity').value=Math.max(1,(Number($('product-quantity').value)||1)-1);updateSummary();});
$('quantity-plus').addEventListener('click',()=>{const v=selectedVariant();$('product-quantity').value=Math.min(20,v?Number(v.stock_quantity):20,(Number($('product-quantity').value)||1)+1);updateSummary();});
wilayas.forEach(w=>$('product-wilaya').add(new Option(w.label,w.label)));
$('product-wilaya').addEventListener('change',updateDeliveryOptions);
$('product-delivery-method').addEventListener('change',updateSummary);
$('product-checkout-form').addEventListener('submit',async e=>{
 e.preventDefault(); const msg=$('product-order-message'),v=selectedVariant(),qty=Number($('product-quantity').value),d=selectedDelivery();
 if(!v||!Number.isInteger(qty)||qty<1||qty>Number(v.stock_quantity)){msg.textContent='اختر المقاس واللون والكمية المتاحة في المخزون.';return;}
 if(!d.valid){msg.textContent='يرجى اختيار ولاية وطريقة توصيل متاحة.';return;}
 if(!db){msg.textContent='تعذر الاتصال بالمتجر. لم يتم إرسال الطلب.';return;}
 const f=new FormData(e.currentTarget);
 const payload={customer_name:String(f.get('customer_name')||'').trim(),phone:String(f.get('phone')||'').trim(),wilaya:d.w.label,delivery_method:d.method,municipality:String(f.get('municipality')||'').trim(),address:String(f.get('address')||'').trim(),customer_note:String(f.get('customer_note')||'').trim(),items:[{variant_id:v.id,quantity:qty}]};
 let pending=null;try{pending=JSON.parse(localStorage.getItem('orthiva_pending_order')||'null');}catch{}
 const fingerprint=JSON.stringify(payload);
 if(!pending||pending.fingerprint!==fingerprint){const key=crypto.randomUUID?crypto.randomUUID():'orthiva-'+Date.now()+'-'+Math.random().toString(16).slice(2);pending={fingerprint,key};try{localStorage.setItem('orthiva_pending_order',JSON.stringify(pending));}catch{}}
 payload.request_id=pending.key;
 const button=$('product-submit');button.disabled=true;button.textContent='جارٍ إرسال الطلب…';msg.textContent='نرسل طلبك الآن، يرجى الانتظار.';
 try{
  const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(result.error||'تعذر إرسال الطلب');
  try{localStorage.removeItem('orthiva_pending_order');}catch{}
  msg.textContent='تم تسجيل طلبك بنجاح! رقم الطلب: '+(result.order_number||result.order_id||'—')+'. الدفع عند الاستلام.';
  button.textContent='تم إرسال الطلب بنجاح ✓';$('product-checkout-form').reset();$('product-quantity').value=1;updateDeliveryOptions();
 }catch(err){msg.textContent=(err.message||'تعذر إرسال الطلب')+' — لم نؤكد تسجيل الطلب. يمكنك إعادة المحاولة أو التواصل معنا.';button.textContent='إعادة المحاولة';}
 finally{if(button.textContent!=='تم إرسال الطلب بنجاح ✓')button.disabled=false;}
});
$('year').textContent=new Date().getFullYear();
loadProduct();
})();