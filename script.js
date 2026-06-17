let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').style.display = 'flex';
});

async function triggerInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-banner').style.display = 'none';
        }
        deferredPrompt = null;
    }
}

// تسجيل الـ Service Worker لتفعيل خاصية تثبيت "يوتوبيا لاند" كتطبيق
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Utopia Worker Registered'))
            .catch(err => console.log('Registration failed'));
    });
}

// إعدادات الربط مع Supabase
const supabaseUrl = 'https://ywbmamklqyrahwqifqdj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Ym1hbWtscXlyYWh3cWlmcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODAzOTksImV4cCI6MjA5MTA1NjM5OX0.Dw3-6ZwoADEN6H0eaG_XhwM01t6v5mpXzst19LDf9es'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// متغيرات الحالة العامة للموقع
let cart = []; // مصفوفة لتخزين عناصر السلة
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || []; // قائمة المفضلة من التخزين المحلي
let wishlistNewCount = parseInt(localStorage.getItem('wishlistNewCount')) || 0; // عداد المفضلة الجديد
let supportNewCount = parseInt(localStorage.getItem('supportNewCount')) || 0; // عداد رسائل الدعم الجديدة مع حفظ الحالة
let currentView = 'home'; // العرض الحالي (الرئيسية أو المفضلة)
let currentPage = 0;
const itemsPerPage = 8;
let hasMore = true;
let lastProcessedBroadcastId = null; // تعريف المتغير المفقود
let lastProcessedMsgText = null; // تعريف المتغير المفقود

// عداد لتتبع عدد العناصر التي تمنع السكرول
let lockScrollCount = 0;
function addLockScroll() {
    lockScrollCount++;
    document.body.classList.add('lock-scroll');
    document.documentElement.classList.add('lock-scroll');
}
function removeLockScroll() {
    lockScrollCount--;
    if (lockScrollCount <= 0) { // فقط إذا لم يعد هناك أي عنصر يمنع السكرول
        document.body.classList.remove('lock-scroll');
        document.documentElement.classList.remove('lock-scroll');
        lockScrollCount = 0; // التأكد من عدم النزول تحت الصفر
    }
}

// وظيفة ذكية للتحكم في سكرول الطبقات: تمنع سكرول صفحة التفاصيل إذا كانت السلة أو الدعم مفتوحين فوقها
function updateLayersScroll() {
    const detailsPage = document.getElementById('book-details-page');
    const isCartOpen = document.getElementById('cart-drawer').classList.contains('open');
    const isSupportOpen = document.getElementById('support-drawer').classList.contains('open');

    if (detailsPage) {
        // إذا كانت السلة أو الدعم مفتوحين، نغلق سكرول صفحة التفاصيل تماماً
        detailsPage.style.overflowY = (isCartOpen || isSupportOpen) ? 'hidden' : 'auto';
    }
}

// مخزن لترجمات المحافظات لتجنب تكرار الطلبات
let provinceTranslationCache = JSON.parse(localStorage.getItem('provinceTranslationCache')) || {};

// مخزن للترجمات الآلية لتجنب تكرار الطلبات
let autoTranslationCache = JSON.parse(localStorage.getItem('autoTranslationCache')) || {};

// تعريف وتحميل صوت الشات مسبقاً
const chatSound = new Audio('https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/iphone-notification-ringtone-838.mp3');

// تفعيل الصوت عند أول نقرة (متطلبات الأمان للمتصفح)
function primeChatAudio() {
    chatSound.muted = true;
    chatSound.play().then(() => {
        chatSound.pause();
        chatSound.muted = false;
    }).catch(() => {});
}
document.addEventListener('click', primeChatAudio, { once: true });
document.addEventListener('touchstart', primeChatAudio, { once: true });

// حاول تحميل السلة من LocalStorage عند بدء التشغيل
try {
    const storedCart = localStorage.getItem('cart');
    if (storedCart) {
        cart = JSON.parse(storedCart);
    }
} catch (e) {
    console.error("Failed to load cart from localStorage:", e);
    cart = []; // في حالة وجود خطأ، ابدأ بسلة فارغة
}
let shippingCost = 0; // تكلفة الشحن الافتراضية

// قائمة المحافظات وأسعار الشحن
const shippingPrices = {
    "مترو": 50,
    "القاهرة": 65,
    "الجيزة": 65,
    "اكتوبر": 65,
    "التجمع": 65,
    "المقطم": 65,
    "البدرشين": 65,
    "الحوامدية": 65,
    "العبور": 65,
    "مدينتي": 65,
    "الشروق": 80,
    "العاشر": 80,
    "اسكندرية": 80,
    "السويس": 80,
    "بورسعيد": 80,
    "اسماعلية": 80,
    "الشرقية": 80,
    "الغربية": 80,
    "الدقهلية": 80,
    "المنوفية": 80,
    "كفر الشيخ": 80,
    "البحيرة": 80,
    "دمياط": 80,
    "بني سويف": 85,
    "الفيوم": 85,
    "المنيا": 85,
    "اسيوط": 85,
    "سوهاج": 85,
    "قنا": 85,
    "الاقصر": 85,
    "اسوان": 85,
    "الغردقة": 100,
    "راس غارب": 120,
    "القصير": 120,
    "مرسي علم": 120,
    "سفاجة": 120
};

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    getMyLibraryData(); // جلب البيانات عند فتح الصفحة
    populateProvinces(); // ملء قائمة المحافظات عند تحميل الصفحة
    updateGlobalCartCount(); // تحديث عداد السلة عند تحميل الصفحة
    updateGlobalWishCount(); // تحديث عداد المفضلة
    
    // تفعيل المزامنة الخلفية للشات إذا كان المستخدم معروفاً
    const savedPhone = localStorage.getItem('user_chat_phone');
    updateGlobalSupportCount();
    if (savedPhone) startChatSync(savedPhone);
    
    // فحص إذا كان المستخدم قادماً من إشعار (والموقع كان مغلقاً)
    if (urlParams.get('openSupport') === 'true') {
        setTimeout(() => showSupport(true), 1000); // تأكد من تمرير true لـ shouldPush
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // الاستماع للرسائل القادمة من Service Worker (والموقع كان مفتوحاً)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.action === 'open-support') showSupport();
        });
    }

    // ضمان وجود حالة "الرئيسية" في التاريخ فور فتح الموقع لمنع الخروج المفاجئ
    if (!window.history.state || window.history.state.view !== 'home') {
        window.history.replaceState({ view: 'home' }, "");
    }

    // مراقب السكرول لإظهار الشريط العلوي الثابت وزر العودة للأعلى
    window.addEventListener('scroll', () => {
        const stickyHeader = document.getElementById('sticky-header');
        const scrollBtn = document.getElementById('scroll-top-btn');
        const triggerArea = document.querySelector('.categories-container');
        if (!triggerArea || !stickyHeader) return;

        // إظهار زر العودة للأعلى بعد نزول 400 بيكسل
        if (window.scrollY > 400) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
        
        const rect = triggerArea.getBoundingClientRect();
        if (window.scrollY > 150 || rect.top <= 0) {
            stickyHeader.classList.add('visible');
        } else {
            stickyHeader.classList.remove('visible');
        }
    });

    // إغلاق القائمة عند النقر في أي مكان آخر
    document.addEventListener('click', () => {
        const dropdown = document.getElementById('cat-dropdown-menu');
        if(dropdown) dropdown.classList.remove('open');
    });

    // إرسال الرسالة في الشات عند الضغط على Enter
    document.getElementById('chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
});

// وظيفة العودة للقمة بانسيابية
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- نظام الملاحة الذكي (الرجوع للخلف) ---
// هذه الوظيفة تراقب ضغط زر الرجوع في المتصفح أو الهاتف
window.addEventListener('popstate', function(event) {
    const state = event.state || { view: 'home' };
    
    // إغلاق النوافذ فقط إذا لم تكن هي الوجهة المطلوبة في الحالة الجديدة
    // هذا يضمن بقاء صفحة التفاصيل مفتوحة عند إغلاق السلة أو الدعم
    if (state.view !== 'cart') closeCart(false);
    if (state.view !== 'support') closeSupport(false);
    if (state.view !== 'details') closeBookDetails(false);

    // فتح الحالة المطلوبة بناءً على التاريخ (الرجوع أو التقديم)
    if (state.view === 'cart') openCart(false);
    else if (state.view === 'support') showSupport(false);
    else if (state.view === 'wishlist') showWishlist(false);
    else if (state.view === 'details' && state.id) showBookDetails(state.id, false);
    else if (state.view === 'home') {
        // العودة للرئيسية وإعادة ضبط شكل الفوتر والبحث
        showCategoriesAndHome(false);
    }
});

// تثبيت الحالة الأولية عند تحميل الصفحة
window.addEventListener('load', () => {
    if (!window.history.state) {
        window.history.replaceState({ view: 'home' }, "");
    }
});

// وظيفة مساعدة لإضافة حالة في تاريخ المتصفح عند فتح أي نافذة
function pushNavigationState(stateName, extraData = {}) {
    const state = { view: stateName, ...extraData };
    const currentState = window.history.state;
    
    // منع تكرار نفس الحالة في التاريخ
    if (!currentState || currentState.view !== stateName || (stateName === 'details' && currentState.id !== extraData.id)) {
        window.history.pushState(state, "");
        // تحديث الرابط في المتصفح ليصبح قابلاً للمشاركة
        if (stateName === 'details') {
            window.history.replaceState(state, "", `?id=${extraData.id}`);
        }
    }
}

// تثبيت الحالة الأولية عند تحميل الموقع
window.addEventListener('load', () => {
    if (!window.history.state) window.history.replaceState({ view: 'home' }, "");
});

// وظيفة فتح/إغلاق المربع الصغير من الشريط السفلي
function toggleBottomCats(e) {
    e.stopPropagation();
    document.getElementById('cat-dropdown-menu').classList.toggle('open');
}

// وظيفة موحدة لاختيار القسم (تعمل مع الشريط العلوي والمربع السفلي)
function handleCategorySelect(category, element) {
    // 1. إخفاء المربع السفلي فوراً
    const dropdown = document.getElementById('cat-dropdown-menu');
    if(dropdown) dropdown.classList.remove('open');

    const topItems = document.querySelectorAll('.category-item');
    const bottomItems = document.querySelectorAll('.dropdown-item');

    // 2. إزالة حالة النشاط من جميع العناصر في الموقع
    topItems.forEach(i => i.classList.remove('active'));
    bottomItems.forEach(i => i.classList.remove('active'));

    // 3. تحديد الـ Index للمزامنة بين القائمتين
    let targetIdx = -1;
    if (element.classList.contains('category-item')) {
        targetIdx = Array.from(topItems).indexOf(element);
    } else {
        targetIdx = Array.from(bottomItems).indexOf(element);
    }

    // 4. تفعيل (إنارة) العناصر المقابلة في كلا الشريطين
    if (targetIdx !== -1) {
        if (topItems[targetIdx]) {
            topItems[targetIdx].classList.add('active');
            // سحر الحركة: جعل الشريط العلوي يتحرك ليظهر القسم المختار في المنتصف
            topItems[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        if (bottomItems[targetIdx]) bottomItems[targetIdx].classList.add('active');
    }

    filterByCategory(category);
}

// وظيفة فلترة الكتب حسب القسم
function filterByCategory(category) {
    let filtered;
    if (category === 'الكل') {
        filtered = window.fullData;
    } else {
        filtered = window.fullData.filter(book => {
            if (!book.category) return false;
            // تقسيم التصنيفات والتأكد من وجود القسم المختار
            return book.category.split(',').map(c => c.trim()).includes(category);
        });
    }
    // ترتيب عشوائي في كل مرة
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    renderBooksList(shuffled);
}

// وظيفة جلب البيانات من Supabase
async function getMyLibraryData() {
    window.fullData = [];
    const container = document.getElementById('books-list');
    const { data, error } = await _supabase.from('books').select('*');

    if (error) {
        console.error("Error connecting:", error.message);
        container.innerHTML = `<div class="error-msg">فشل الاتصال بسوبابيز. تأكدي من الـ URL والـ Key.</div>`;
        return;
    }

    // ترتيب الكتب عشوائياً في كل مرة يتم فيها تحميل الموقع
    const shuffledData = data.sort(() => Math.random() - 0.5);
    
    window.fullData = shuffledData;
    renderBooksList(shuffledData);

    // فحص الرابط عند التحميل لفتح كتاب معين مباشرة (Deep Linking) بعد جلب البيانات
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('id');
    if (bookId) showBookDetails(bookId, false);

    // تفعيل التحديث اللحظي للكتب (إضافة، تعديل، حذف)
    _supabase.channel('realtime-books', {
        config: {
            broadcast: { self: true } // السماح بالبث الذاتي لتحديث الكتب المضافة حديثاً
        }
    }).on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'books'
    }, payload => {
        console.log('تحديث في الكتب:', payload);
        // إذا كان التحديث من نفس العميل (مثلاً إضافة كتاب جديد)، لا نحدث القائمة بالكامل
        // هذا يمنع الـ flicker عند إضافة كتاب جديد من لوحة التحكم
        if (payload.new && payload.new.id && window.currentOpenedBookId === payload.new.id) return;

        if (payload.eventType === 'INSERT') {
            window.fullData.unshift(payload.new);
        } else if (payload.eventType === 'UPDATE') {
            const idx = window.fullData.findIndex(b => String(b.id) === String(payload.new.id));
            if (idx !== -1) window.fullData[idx] = payload.new;
        } else if (payload.eventType === 'DELETE') {
            window.fullData = window.fullData.filter(b => String(b.id) !== String(payload.old.id));
        }
        
        // إعادة عرض الكتب بناءً على القسم المختار حالياً
        if (currentView === 'home') {
            const activeCat = document.querySelector('.category-item.active')?.innerText || 'الكل';
            filterByCategory(activeCat);
        } else if (currentView === 'wishlist') {
            showWishlist();
        }
    }).subscribe();
}

// وظيفة عرض قائمة الكتب في الصفحة
function renderBooksList(data) {
    const container = document.getElementById('books-list');
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    
    if (data.length === 0) {
        if (currentView === 'wishlist') {
            container.innerHTML = `
                <div style="text-align:center; padding:0 20px; margin-top:-20px; color: var(--paper-light); grid-column: 1/-1;">
                    <i class="bi bi-bookmark-heart" style="font-size: 2.5rem; color: var(--accent-wood); opacity: 0.3; margin-bottom: 5px; display: block;"></i>
                    <h3 style="margin-bottom: 0px;">${t.wishlistEmptyTitle}</h3>
                    <p style="opacity: 0.7; margin-bottom: 15px; font-size: 0.9rem;">${t.wishlistEmptyDesc}</p>
                    <button class="shop-now-btn" onclick="shopNow()">${t.discoverNow} <i class="bi ${lang === 'ar' ? 'bi-arrow-left-short' : 'bi-arrow-right-short'}"></i></button>
                </div>`;
        } else {
            const activeCat = document.querySelector('.category-item.active')?.innerText || 'الكل';
            const isOffers = activeCat === 'العروض' || activeCat === 'Offers';
            if (isOffers) {
                 const msg = document.documentElement.lang === 'en' ? 'No offers available currently.. stay tuned! ✨' : 'لا توجد عروض حالياً.. انتظرونا قريباً! ✨';
                 container.innerHTML = `<div class="error-msg" style="padding: 100px 20px;">
                    <i class="bi bi-percent" style="font-size: 3.5rem; display: block; margin-bottom: 15px; color: var(--accent-wood);"></i>
                    ${msg}
                 </div>`;
            } else {
                 container.innerHTML = `<div class="error-msg">الأرفف خالية! ضيفي كتب في سوبابيز أولاً.</div>`;
            }
        }
        return;
    }

    container.innerHTML = data.map((book, index) => renderBookCard(book, index)).join('');
    
    updateCartUI(); // لضمان ظهور علامات الصح
}

// وظيفة بناء HTML لكارت الكتاب الواحد
function getValidImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/300x450?text=No+Image';
    if (url.startsWith('http')) return url;
    return `https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/${url}`;
}

function renderBookCard(book, index) {
    const img1 = getValidImageUrl(book.image_url);
    const img2 = getValidImageUrl(book.image_url2);
    const has2nd = book.image_url2 && book.image_url2 !== book.image_url;
    const isInWishlist = wishlist.includes(book.id);
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    const isSoldOut = book.stock_quantity <= 0;

    // نظام الترجمة الذكي: يستخدم الكاش أولاً، ثم البيانات اليدوية إن وجدت، ثم الأصل
    let displayTitle = book.title;
    let displayAuthor = book.author;
    let displayDesc = book.description || '';

    if (lang === 'en') {
        const cache = autoTranslationCache[book.id];
        displayTitle = cache?.title || (book.title_en || (t.bookData[book.id]?.title || book.title));
        displayAuthor = cache?.author || (book.author_en || (t.bookData[book.id]?.author || book.author));
        displayDesc = cache?.desc || (book.description_en || (t.bookData[book.id]?.desc || displayDesc));
        
        // إذا لم تكن الترجمة موجودة في أي مكان، نطلق عملية الترجمة الآلية في الخلفية
        if (!cache && !book.title_en && !t.bookData[book.id]) {
            triggerAutoTranslate(book);
        }
    }

    return `
       <div class="book-card" style="animation: fadeInUp ${0.3 + (index * 0.1)}s ease-out;" onclick="showBookDetails('${book.id}')" itemscope itemtype="http://schema.org/Book">
            <div class="image-box">
                ${has2nd ? `<div class="hover-trigger trigger-right"></div><div class="hover-trigger trigger-left"></div>` : ''}
                <img src="${img1}" class="main-img" loading="lazy" alt="كتاب ${displayTitle} - ${displayAuthor}" itemprop="image"> <!-- تحميل ذكي حسب الصف -->
                ${has2nd ? `<img src="${img2}" class="hover-img" alt="غلاف إضافي لكتاب ${displayTitle}">` : ''}
                <div class="image-indicators"><div class="dot active"></div>${has2nd ? `<div class="dot"></div>` : ''}</div>
            </div>
            <div class="book-actions">
                <span id="wish-btn-${book.id}" class="action-icon ${isInWishlist ? 'active' : ''}" title="المفضلة" 
                      onclick="event.stopPropagation(); toggleWishlist(${book.id})">
                    <i id="wish-icon-${book.id}" class="bi bi-bookmark-heart"></i>
                </span>
            </div>
            <h3 itemprop="name">${displayTitle}</h3>
            <div class="star-rating" style="justify-content: center; font-size: 0.8rem;">
                <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-half"></i>
            </div>
            <p class="author-name" itemprop="author">${t.by}: ${displayAuthor}</p>
            <p class="book-desc" itemprop="description">${displayDesc}</p>
            ${isSoldOut ? 
                `<div class="out-of-stock-badge">نفذت الكمية</div>` : 
                `<button class="cart-btn" id="add-btn-${book.id}" data-id="${book.id}" onclick="event.stopPropagation(); addItemToCart('${book.id}')">
                    <i class="bi bi-cart-plus"></i>
                </button>`
            }
            <div class="price-cart-container" itemprop="offers" itemscope itemtype="http://schema.org/Offer"><div class="price"><span itemprop="price">${book.price}</span> <span itemprop="priceCurrency" content="EGP">${t.currency}</span></div></div>
        </div>`;
}

function getRandomBooks(count) {
    if (!window.fullData) return [];
    return [...window.fullData].sort(() => 0.5 - Math.random()).slice(0, count);
}

function getRelatedBooks(currentBook) {
    if (!window.fullData || !currentBook || !currentBook.category) return [];
    
    return window.fullData.filter(b => {
        // كتب قد تهمك تكون من نفس تصنيف الكتاب المفتوح (مطابقة تامة لسلسلة التصنيف)
        return b.category === currentBook.category && String(b.id) !== String(currentBook.id);
    }).slice(0, 4);
}

function renderSmallCard(book) {
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    const img = getValidImageUrl(book.image_url);
    const isInCart = cart.find(i => String(i.id) === String(book.id));
    return `
        <div class="book-card" style="padding: 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); showBookDetails('${book.id}')">
            <div class="image-box" style="height: 120px;">
                <img src="${img}" style="object-fit: cover;">
            </div>
            <h3 style="font-size: 0.8rem; height: 35px; overflow: hidden;">${book.title}</h3>
            <div class="price" style="font-size: 0.9rem;">${book.price} ${t.currency}</div>
            <button class="cart-btn ${isInCart ? 'success' : ''}" data-id="${book.id}" style="width: 25px; height: 25px; font-size: 0.8rem; bottom: 8px; left: 8px;" onclick="event.stopPropagation(); addItemToCart('${book.id}')">
                <i class="bi ${isInCart ? 'bi-check-lg' : 'bi-cart-plus'}"></i>
            </button>
        </div>
    `;
}

let currentDetailsQty = 1;
async function showBookDetails(id, shouldPush = true) {
    const detailsPage = document.getElementById('book-details-page');
    const isAlreadyOpen = detailsPage.classList.contains('active');
    const isSameBook = String(window.currentOpenedBookId) === String(id);

    // إذا كانت صفحة التفاصيل مفتوحة بالفعل لنفس الكتاب، نكتفي بالتأكد من الحالة ولا نعيد بناء المحتوى
    if (isAlreadyOpen && isSameBook) {
        if (shouldPush) pushNavigationState('details', { id });
        return;
    }

    const book = window.fullData.find(b => String(b.id) === String(id));
    if (!book) return;

    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    
    window.currentOpenedBookId = book.id; 
    currentDetailsQty = 1; 
    const content = document.getElementById('details-content');

    // تطبيق الترجمة الذكية داخل صفحة التفاصيل
    let displayTitle = book.title;
    let displayAuthor = book.author;
    let displayDesc = book.description || (lang === 'ar' ? 'لا يوجد وصف متاح.' : 'No description available.');

    if (lang === 'en') {
        const cache = autoTranslationCache[book.id];
        displayTitle = cache?.title || (book.title_en || (t.bookData[book.id]?.title || book.title));
        displayAuthor = cache?.author || (book.author_en || (t.bookData[book.id]?.author || book.author));
        displayDesc = cache?.desc || (book.description_en || (t.bookData[book.id]?.desc || displayDesc));
    }

    const isInWishlist = wishlist.includes(book.id);
    const isInCart = cart.find(i => String(i.id) === String(book.id));
    const isSoldOut = book.stock_quantity <= 0;
    const img1 = getValidImageUrl(book.image_url);
    const img2 = getValidImageUrl(book.image_url2);
    const has2nd = book.image_url2 && book.image_url2 !== book.image_url;

    // تحسين SEO: تغيير عنوان الصفحة عند فتح تفاصيل الكتاب
    const originalTitle = document.title;
    document.title = `${book.title} | يوتوبيا لاند`;
    // تتبع في جوجل أن الزائر شاهد هذا الكتاب
    if (typeof gtag === 'function') gtag('event', 'view_item', { items: [{ item_name: book.title, price: book.price }] });

    content.innerHTML = `
        <div class="details-image">
            <div class="details-image-container" id="details-img-container">
                <div class="details-slider" id="details-slider">
                    <img src="${img1}" alt="كتاب ${book.title} - ${book.author}">
                    ${has2nd ? `<img src="${img2}" alt="عرض إضافي لكتاب ${book.title}">` : ''}
                </div>
                ${has2nd ? `
                <button class="slider-arrow arrow-prev" onclick="event.stopPropagation(); slideDetails(0)"><i class="bi bi-chevron-right"></i></button>
                <button class="slider-arrow arrow-next" onclick="event.stopPropagation(); slideDetails(1)"><i class="bi bi-chevron-left"></i></button>
                <div class="slider-dots">
                    <div class="slider-dot active" onclick="slideDetails(0)"></div>
                    <div class="slider-dot" onclick="slideDetails(1)"></div>
                </div>` : ''}
            </div>
        </div>
        <div class="details-info">
            <div class="star-rating">
                <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i>
                <span style="color: var(--desc-color); font-size: 0.9rem; margin-right: 10px;">(5.0)</span>
            </div>
            <h1>${displayTitle}</h1>
            <p class="author">${t.by}: ${displayAuthor}</p>
            <p class="full-desc">${displayDesc}</p>
            <div style="font-size: 2rem; color: var(--paper-light); margin-bottom: 25px; font-weight: bold;">${book.price} ${t.currency}</div>
            <div class="details-actions">
                ${isSoldOut ? 
                    `<div class="out-of-stock-badge" style="font-size: 1.3rem; padding: 15px 40px; flex: 1; text-align: center;">نفذت الكمية من يوتوبيا 🌸</div>` :
                    `<div class="details-qty-container">
                        <button class="qty-btn-det" onclick="updateDetQty(-1)"><i class="bi bi-dash"></i></button>
                        <span id="det-qty-val" style="font-size: 1.6rem; font-weight: bold; color: var(--paper-light); min-width: 30px; text-align: center;">1</span>
                        <button class="qty-btn-det" onclick="updateDetQty(1)"><i class="bi bi-plus"></i></button>
                    </div>
                    <button id="details-add-btn" class="shop-now-btn ${isInCart ? 'success' : ''}" style="flex: 1; min-width: 200px;" onclick="addItemToCart('${book.id}', currentDetailsQty)">
                        ${isInCart ? '<i class="bi bi-check-lg"></i> تم الإضافة' : '<i class="bi bi-cart-plus"></i> إضافة للسلة'}
                    </button>`
                }
                <button id="details-wish-btn" class="wish-btn-large ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(${book.id}); updateDetailsWishBtn(${book.id})">
                    <i id="details-wish-icon" class="bi bi-bookmark-heart"></i>
                </button>
            </div>
        </div>
        <div class="extra-sections-wrapper" style="grid-column: 1 / -1;">
            <div class="section-header"><i class="bi bi-fire"></i><span>${t.mostSelling}</span></div>
            <div class="books-grid" style="gap: 15px; margin-bottom: 40px;">
                ${getRandomBooks(4).map((b, i) => renderBookCard(b, i)).join('')}
            </div>
            <div class="section-header"><i class="bi bi-lightbulb-fill"></i><span>${t.relatedBooks}</span></div>
            <div class="books-grid" style="gap: 15px;">
                ${getRelatedBooks(book).map((b, i) => renderBookCard(b, i)).join('')}
            </div>
        </div>
    `;

    if (window.innerWidth >= 1024) {
        const grids = content.querySelectorAll('.extra-sections-wrapper .books-grid');
        grids.forEach(g => g.style.gridTemplateColumns = 'repeat(4, 1fr)');
    }

    detailsPage.style.display = 'flex'; 
    setTimeout(() => detailsPage.classList.add('active'), 10);
    if (!isAlreadyOpen) addLockScroll();
    
    updateLayersScroll(); // التأكد من حالة السكرول عند فتح الصفحة

    if (shouldPush) pushNavigationState('details', { id: book.id });
    detailsPage.scrollTo(0,0);
    setTimeout(observeBookCards, 300); // تفعيل ظهور الكروت الصغيرة في صفحة التفاصيل
}

function slideDetails(index) {
    const slider = document.getElementById('details-slider');
    const dots = document.querySelectorAll('.slider-dot');
    if (slider) {
        slider.style.transform = `translateX(${index * 100}%)`; 
        if (document.documentElement.dir === 'ltr') slider.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }
}

function updateDetQty(delta) {
    currentDetailsQty += delta;
    if (currentDetailsQty < 1) currentDetailsQty = 1;
    const qtyDisplay = document.getElementById('det-qty-val');
    if (qtyDisplay) qtyDisplay.innerText = currentDetailsQty;
}

function closeBookDetails(shouldGoBack = true) {
    const detailsPage = document.getElementById('book-details-page');
    if (!detailsPage.classList.contains('active')) return;
    detailsPage.classList.remove('active');
    setTimeout(() => {
        detailsPage.style.display = 'none';
        window.currentOpenedBookId = null;
        document.title = "يوتوبيا لاند - عالم عشاق الكتب"; // إعادة العنوان الأصلي
        window.history.replaceState({ view: 'home' }, "", window.location.pathname); // تنظيف الرابط
    }, 500);
    removeLockScroll();
    
    // لا حاجة لاستدعاء updateLayersScroll هنا لأن الصفحة ستختفي تماماً

    if (shouldGoBack && window.history.state?.view === 'details') window.history.back();
}

function updateDetailsWishBtn(id) {
    const btn = document.getElementById('details-wish-btn');
    const icon = document.getElementById('details-wish-icon');
    const isActive = wishlist.includes(id);
    if (btn) btn.classList.toggle('active', isActive);
    if (icon) icon.className = 'bi bi-bookmark-heart';
}

function normalizeArabic(text) {
    if (!text) return "";
    return text.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").trim();
}

function syncSearch(val) {
    document.getElementById('main-search').value = val;
    document.getElementById('sticky-search').value = val;
    const term = val.trim();
    if (!term) {
        renderBooksList(window.fullData);
        return;
    }
    const normTerm = normalizeArabic(term).toLowerCase();
    const escapedTerm = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escapedTerm}(\\s|$)`, 'i');
    const filtered = window.fullData.filter(book => {
        const normTitle = normalizeArabic(book.title).toLowerCase();
        const normAuthor = normalizeArabic(book.author).toLowerCase();
        return regex.test(normTitle) || regex.test(normAuthor);
    });
    renderBooksList(filtered);
}

const translations = {
    ar: {
        logo: "يوتوبيا لاند", search: "ابحث عن عنوان أو كاتب...", quickSearch: "بحث سريع...",
        categories: ["الكل", "العروض", "روايات", "فانتازيا", "تنمية ذاتية", "ديني", "رعب"],
        home: "الرئيسية", cart: "السلة", wishlist: "المفضلة", support: "الدعم",
        dedication: "إهداء خاص", categoriesBottomBar: "تصنيفات", by: "تأليف", currency: "ج.م",
        dedicationText: "لكل من يجد ضالته بين الأسطر، لكل من يسافر دون أن يتحرك، ولكل عشاق الكتب.. هذا المكان ليس مجرد متجر، بل هو يوتوبيا خاصة تجمعنا على حب الكلمة والمعرفة. نحن هنا لنرتقي بشغفكم ونبني معاً عالماً يجمع بين سحر الخيال وواقع الحكمة.",
        backToLibrary: "العودة للمكتبة",
        supportHeader: "مركز الدعم",
        developedBy: "تمت البرمجة والتطوير بواسطة حنين ✨",
        wishlistEmptyTitle: "قائمة المفضلة فارغة",
        wishlistEmptyDesc: "لم تقم بإضافة أي كتب لمفضلتك بعد.",
        discoverNow: "اكتشف الآن",
        mostSelling: "الأكثر مبيعاً في يوتوبيا", relatedBooks: "كتب قد تهمك",
        booksCount: "عدد الكتب", book: "كتاب", totalOrder: "إجمالي الطلب", 
        shippingCostLabel: "تكلفة الشحن", grandTotalLabel: "الإجمالي الكلي",
        shippingNote: "ملحوظة: سعر الشحن", shippingDays: "الشحن يستغرق من 3 إلى 5 أيام عمل.",
        confirmOrderHeader: "تأكيد طلبك", confirmOrderBtn: "تأكيد الطلب",
        processingOrder: "جاري إرسال الطلب...", orderSuccess: "تم استلام طلبك بنجاح! 🎉 سيتم التواصل معك قريباً.",
        orderError: "عذراً، حدث خطأ أثناء إرسال الطلب:", startShopping: "ابدأ التسوق الآن",
        cartEmptyTitle: "سلتك خالية من الكنوز..", cartEmptyDesc: "رحلتك بين صفحات الكتب لم تبدأ بعد",
        nameErrorMsg: "الاسم يجب أن يتكون من كلمتين على الأقل.",
        phoneErrorMsg: "أدخل رقم موبايل مصري صحيح (11 رقم).",
        whatsappErrorMsg: "أدخل رقم واتساب مصري صحيح (11 رقم).",
        provinceErrorMsg: "من فضلك اختر المحافظة.",
        addressErrorMsg: "من فضلك أدخلي العنوان بالتفصيل لضمان وصول الشحن.",
        phoneRequiredAlert: "من فضلكِ أدخلي رقم الموبايل أولاً.",
        botWelcomeMsg: "أهلاً بكِ مجدداً! ✨ كيف يمكننا مساعدتكِ؟",
        placeholders: {
            name: "الاسم الثنائي على الأقل", phone: "رقم الموبايل المصري (11 رقم)", whatsapp: "رقم الواتساب (إجباري)", 
            province: "اختر المحافظة", address: "العنوان بالتفصيل", notes: "ملاحظات العميل (اختياري)", chat: "اكتبي استفسارك هنا..."
        },
        bookData: {}
    },
    en: {
        logo: "Utopia Land", search: "Search for title or author...", quickSearch: "Quick search...",
        categories: ["All", "Offers", "Novels", "Fantasy", "Self-Dev", "Religious", "Horror"],
        home: "Home", cart: "Cart", wishlist: "Wishlist", support: "Support",
        dedication: "A Royal Dedication", categoriesBottomBar: "Categories", by: "By", currency: "EGP",
        dedicationText: "To those who find sanctuary within the pages, to the wanderers who traverse universes without ever leaving their seats, and to all bibliophiles... this is not merely a bookstore. This is your personal Utopia—a sanctuary bound by the love of the written word and the pursuit of wisdom. We are here to nurture your passion and build a realm where the brilliance of imagination meets the depth of knowledge.",
        backToLibrary: "Back to Library",
        supportHeader: "Support Center",
        developedBy: "Designed & Developed with Excellence by Haneen ✨",
        mostSelling: "Best Sellers in Utopia",
        relatedBooks: "Books You May Like",
        placeholders: {
            name: "Full Name", phone: "Phone Number", whatsapp: "WhatsApp Number", 
            province: "Select Province", address: "Full Address Details", notes: "Order Notes (Optional)", chat: "Type your message here..."
        },
        bookData: {
            1: { title: "Psychological Fragility", author: "Ismail Arafa", desc: "Discusses the phenomenon of psychological fragility." },
            2: { title: "Stockholm", author: "Ahmed Al-Hamdan", desc: "A mysterious journey between love and obsession." },
            3: { title: "Arses 1", author: "Ahmed Al-Hamdan", desc: "A fantasy epic blending magic and adventure." },
            4: { title: "The Alchemist", author: "Paulo Coelho", desc: "An allegorical novel by Paulo Coelho about following one's dreams." },
            5: { title: "1984", author: "George Orwell", desc: "A dystopian social science fiction novel by George Orwell." },
            // أضيفي هنا باقي الكتب بنفس الطريقة باستخدام الـ ID الصحيح من Supabase
            6: { title: "English Title", author: "English Author", desc: "English Description" },
            7: { title: "Another Book", author: "Another Author", desc: "Another Description" }
        }
    }
};

// وظيفة الترجمة الآلية باستخدام محرك Google (بدون مفتاح API لسهولة الاستخدام)
async function translateText(text) {
    if (!text || !/[^\x00-\x7F]/.test(text)) return text; // إذا كان النص إنجليزي أصلاً لا نترجمه
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return data[0].map(s => s[0]).join('');
    } catch (e) {
        return text;
    }
}

async function triggerAutoTranslate(book) {
    // تجنب الطلبات المتكررة لنفس الكتاب في نفس الجلسة
    if (book._isTranslating) return;
    book._isTranslating = true;

    const translatedTitle = await translateText(book.title);
    const translatedAuthor = await translateText(book.author);
    const translatedDesc = await translateText(book.description);

    autoTranslationCache[book.id] = {
        title: translatedTitle,
        author: translatedAuthor,
        desc: translatedDesc
    };

    localStorage.setItem('autoTranslationCache', JSON.stringify(autoTranslationCache));
    
    // تحديث الواجهة فقط إذا كان المستخدم ما زال على اللغة الإنجليزية
    if (document.documentElement.lang === 'en') {
        renderBooksList(window.fullData);
    }
}

async function toggleLanguage() {
    const html = document.documentElement;
    const langBtn = document.getElementById('lang-toggle');
    const isAr = html.dir === "rtl";
    const newLang = isAr ? "en" : "ar";
    const t = translations[newLang];
    html.dir = isAr ? "ltr" : "rtl";
    html.lang = newLang;
    // تحديث زر اللغة نفسه
    langBtn.innerText = isAr ? "AR" : "EN";
    // تحديث اللوجو (تم تعديل الكلاس ليتطابق مع الـ HTML)
    document.querySelectorAll('.logo-text, .sticky-logo').forEach(el => el.innerText = t.logo);
    
    // ترجمة زر العودة للمكتبة
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) backBtn.innerHTML = `<i class="bi ${newLang === 'ar' ? 'bi-arrow-right' : 'bi-arrow-left'}"></i> ${t.backToLibrary}`;

    // ترجمة زر "ابدأ التسوق الآن" في السلة الفارغة
    const shopNowBtnInCart = document.querySelector('#cart-items-container .shop-now-btn');
    if (shopNowBtnInCart) shopNowBtnInCart.innerHTML = `${t.startShopping} <i class="bi bi-bag-check-fill"></i>`;

    document.getElementById('main-search').placeholder = t.search;
    document.getElementById('sticky-search').placeholder = t.quickSearch;
    
    // ترجمة النصوص الشبحية (Placeholders)
    document.getElementById('customer-name').placeholder = t.placeholders.name;
    document.getElementById('customer-phone').placeholder = t.placeholders.phone;
    document.getElementById('customer-whatsapp').placeholder = t.placeholders.whatsapp;
    document.getElementById('customer-address').placeholder = t.placeholders.address;
    document.getElementById('customer-notes').placeholder = t.placeholders.notes;
    document.getElementById('chat-input').placeholder = t.placeholders.chat;
    document.querySelector('#customer-province option[value=""]').innerText = t.placeholders.province;

    const topCatItems = document.querySelectorAll('.category-item');
    const bottomCatItems = document.querySelectorAll('.dropdown-item');
    t.categories.forEach((name, i) => {
        if(topCatItems[i]) topCatItems[i].innerText = name;
        if(bottomCatItems[i]) bottomCatItems[i].innerText = name;
    });
    // تحديث نصوص الشريط السفلي بدقة
    // تحديث نصوص الشريط السفلي بدقة (استهداف الـ span الثاني مباشرة)
    const barItems = document.querySelectorAll('.bottom-bar-item > span:nth-of-type(2)');
    const barTexts = [t.categoriesBottomBar, t.cart, t.wishlist, t.support];
    barTexts.forEach((text, i) => { if(barItems[i]) barItems[i].innerText = text; });
    
    // تحديث المحافظات في القائمة المنسدلة
    const provinceSelect = document.getElementById('customer-province');
    if (provinceSelect) {
        Array.from(provinceSelect.options).forEach(async (opt) => {
            const arName = opt.getAttribute('data-ar');
            if (arName) opt.innerText = (newLang === 'en') ? (await translateProvinceName(arName)) : arName;
        });
    }
    
    // تحديث عناوين النوافذ الجانبية (السلة والدعم)
    const cartHeader = document.querySelector('#cart-drawer .cart-header h3');
    if(cartHeader) cartHeader.innerHTML = `${t.confirmOrderHeader} <i class="bi bi-bag-check-fill"></i>`;
    
    const supportHeader = document.getElementById('client-chat-header');
    if(supportHeader) supportHeader.innerHTML = `${t.supportHeader} <i class="bi bi-headset"></i>`;

    // ترجمة نصوص السلة (إجمالي الطلب، عدد الكتب، تكلفة الشحن، الإجمالي الكلي) والقوالب الخاصة بها
    const booksCountLabel = document.querySelector('#total-sec p');
    if (booksCountLabel) booksCountLabel.innerHTML = `${t.booksCount}: <span id="books-count-val" style="font-weight: bold; color: var(--accent-wood);">0</span> ${t.book}`;
    const totalOrderLabel = document.querySelector('#total-sec h4');
    if (totalOrderLabel) totalOrderLabel.innerHTML = `${t.totalOrder}: <span id="total-val">0</span>`;
    const shippingSecLabel = document.querySelector('#shipping-sec h4');
    if (shippingSecLabel) shippingSecLabel.innerHTML = `${t.shippingCostLabel}: <span id="shipping-val">0</span>`;
    const grandTotalSecLabel = document.querySelector('#grand-total-sec h4');
    if (grandTotalSecLabel) grandTotalSecLabel.innerHTML = `${t.grandTotalLabel}: <span id="grand-total-val">0</span>`;
    const shippingInfoMessageP = document.querySelector('#shipping-info-message p:first-child');
    if (shippingInfoMessageP) shippingInfoMessageP.innerHTML = `${t.shippingNote} <span id="shipping-message-cost">0</span> ${t.currency}`;
    const shippingInfoMessageP2 = document.querySelector('#shipping-info-message p:last-child');
    if (shippingInfoMessageP2) shippingInfoMessageP2.innerText = t.shippingDays;
    
    // ترجمة جميع أزرار "تأكيد الطلب" (في السلة، مودال البطارية، والدعم) لضمان ترجمتها جميعاً فوراً
    document.querySelectorAll('.confirm-order-btn').forEach(btn => {
        btn.innerHTML = `${t.confirmOrderBtn} <i class="bi bi-bag-check-fill"></i>`;
    });

    // ترجمة الإهداء
    const dedicationH3 = document.querySelector('.dedication-box h3');
    if(dedicationH3) dedicationH3.innerHTML = `${t.dedication} <i class="bi bi-feather"></i>`;
    const dedicationP = document.querySelector('.dedication-box p');
    if(dedicationP) dedicationP.innerText = t.dedicationText;

    // ترجمة كارت المبرمج
    const devBadge = document.getElementById('dev-badge');
    if(devBadge) devBadge.innerText = t.developedBy;

    // تحديث السلة والكتب والواجهة فوراً
    if (window.currentOpenedBookId) showBookDetails(window.currentOpenedBookId, false);
    updateCartUI(); 

    const currentData = (currentView === 'wishlist') ? window.fullData.filter(b => wishlist.includes(b.id)) : window.fullData;
    renderBooksList(currentData);
}

// وظيفة لترجمة المحافظات ديناميكياً
async function translateProvinceName(provinceName) {
    if (provinceTranslationCache[provinceName]) return provinceTranslationCache[provinceName];
    const translated = await translateText(provinceName);
    provinceTranslationCache[provinceName] = translated;
    localStorage.setItem('provinceTranslationCache', JSON.stringify(provinceTranslationCache));
    return translated;
}

function addItemToCart(id, customQty = 1) {
    const book = window.fullData.find(b => String(b.id) === String(id));
    const inCart = cart.find(i => String(i.id) === String(id));
    if (inCart) inCart.qty += customQty;
    else cart.push({ ...book, qty: customQty });
    updateCartUI();
    saveCartToLocalStorage();
    setTimeout(openCart, 600);
}

function updateCartUI() {
    const container = document.getElementById('cart-items-container');
    const totalVal = document.getElementById('total-val');
    const booksCountVal = document.getElementById('books-count-val'); 
    const shippingSec = document.getElementById('shipping-sec');
    const shippingVal = document.getElementById('shipping-val');
    const grandTotalSec = document.getElementById('grand-total-sec');
    const grandTotalVal = document.getElementById('grand-total-val');
    const shippingInfoMessageDiv = document.getElementById('shipping-info-message');
    const shippingMessageCostSpan = document.getElementById('shipping-message-cost');
    const provinceSelect = document.getElementById('customer-province');
    const orderUI = document.getElementById('order-ui-wrapper');

    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];

    if (window.fullData) {
        window.fullData.forEach(book => {
            const isInCart = cart.find(i => String(i.id) === String(book.id));
            const btns = document.querySelectorAll(`[data-id="${book.id}"]`);
            btns.forEach(btn => {
                btn.classList.toggle('success', !!isInCart);
                btn.innerHTML = isInCart ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-cart-plus"></i>';
            });
        });
    }
    const detailsBtn = document.getElementById('details-add-btn');
    if (detailsBtn && window.currentOpenedBookId) {
        const isInCart = cart.find(i => String(i.id) === String(window.currentOpenedBookId));
        detailsBtn.classList.toggle('success', !!isInCart);
        detailsBtn.innerHTML = isInCart ? '<i class="bi bi-check-lg"></i> تم الإضافة' : '<i class="bi bi-cart-plus"></i> إضافة للسلة';
    }
    updateGlobalCartCount(); updateGlobalWishCount();
    if (cart.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:80px 20px; color: var(--paper-light); display: flex; flex-direction: column; align-items: center; justify-content: center;"><i class="bi bi-cart-x" style="font-size: 4.5rem; color: var(--accent-wood); opacity: 0.4; margin-bottom: 20px;"></i><h3 style="font-size: 1.4rem; font-weight: bold; margin-bottom: 10px;">${t.cartEmptyTitle}</h3><p style="font-size: 0.95rem; opacity: 0.7; margin-bottom: 25px;">${t.cartEmptyDesc}</p><button class="shop-now-btn" onclick="shopNow()">${t.startShopping} <i class="bi bi-bag-check-fill"></i></button></div>`;
        orderUI.style.display = 'none'; updateGlobalCartCount(); return;
    }
    orderUI.style.display = 'flex';

    container.innerHTML = cart.map((item, idx) => {
        // ترجمة اسم الكتاب داخل السلة تلقائياً
        let displayTitle = (lang === 'en' && autoTranslationCache[item.id]) ? autoTranslationCache[item.id].title : item.title;
        return `<div class="cart-item">
            <img src="${item.image_url}" alt="${displayTitle}">
            <div class="cart-item-details">
                <h4>${displayTitle}</h4>
                <p>${item.price} ${t.currency}</p>
            </div>
            <div class="cart-controls">
                <button class="qty-btn" onclick="changeQty(${idx}, -1)"><i class="bi bi-dash-circle-fill"></i></button>
                <span class="qty-val">${item.qty}</span>
                <button class="qty-btn" onclick="changeQty(${idx}, 1)"><i class="bi bi-plus-circle-fill"></i></button>
            </div>
            <i class="bi bi-trash3 remove-item-btn" onclick="deleteFromCart(${idx})"></i>
        </div>`;
    }).join('');

    const booksTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    totalVal.innerText = `${booksTotal} ${t.currency}`;
    const totalBooksQty = cart.reduce((acc, item) => acc + item.qty, 0); 
    booksCountVal.innerText = `${totalBooksQty}`; 
    const selectedProvinceName = provinceSelect.value;
    shippingCost = shippingPrices[selectedProvinceName] || 0;
    if (selectedProvinceName && shippingCost > 0) {
        shippingMessageCostSpan.innerText = shippingCost;
        shippingInfoMessageDiv.style.display = 'block'; shippingSec.style.display = 'block'; grandTotalSec.style.display = 'block';
    } else {
        shippingInfoMessageDiv.style.display = 'none'; shippingSec.style.display = 'none'; grandTotalSec.style.display = 'none';
    } 
    // تحديث الأرقام والعملة المترجمة داخل القوالب التي تم إنشاؤها في toggleLanguage
    if (shippingVal) shippingVal.innerText = `${shippingCost} ${t.currency}`; 
    if (grandTotalVal) grandTotalVal.innerText = `${booksTotal + shippingCost} ${t.currency}`;
}

function changeQty(idx, delta) {
    cart[idx].qty += delta;
    if (cart[idx].qty < 1) deleteFromCart(idx);
    else { updateCartUI(); saveCartToLocalStorage(); }
}

function deleteFromCart(idx) {
    cart.splice(idx, 1); updateCartUI(); saveCartToLocalStorage();
    if (cart.length === 0) closeCart();
}

function saveCartToLocalStorage() { localStorage.setItem('cart', JSON.stringify(cart)); }

function updateGlobalCartCount() {
    const globalCountElement = document.getElementById('global-cart-count');
    const stickyCountElement = document.getElementById('sticky-cart-count');
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    if (globalCountElement) { globalCountElement.innerText = totalQty; globalCountElement.style.display = totalQty > 0 ? 'flex' : 'none'; }
    if (stickyCountElement) { stickyCountElement.innerText = totalQty; stickyCountElement.style.display = totalQty > 0 ? 'flex' : 'none'; }
}

function toggleWishlist(id) {
    const idx = wishlist.indexOf(id);
    if (idx === -1) { wishlist.push(id); wishlistNewCount++; }
    else { wishlist.splice(idx, 1); if (wishlistNewCount > 0) wishlistNewCount--; }
    localStorage.setItem('wishlist', JSON.stringify(wishlist)); localStorage.setItem('wishlistNewCount', wishlistNewCount);
    updateGlobalWishCount();
    const icon = document.getElementById(`wish-icon-${id}`);
    const btn = document.getElementById(`wish-btn-${id}`);
    const isNowInWishlist = wishlist.includes(id);
    if (icon) icon.className = 'bi bi-bookmark-heart';
    if (btn) btn.classList.toggle('active', isNowInWishlist);
    updateDetailsWishBtn(id);
    if (currentView === 'wishlist') showWishlist();
}

function updateGlobalWishCount() {
    const el = document.getElementById('global-wish-count');
    const stickyEl = document.getElementById('sticky-wish-count');
    if (el) { el.innerText = wishlistNewCount; el.style.display = wishlistNewCount > 0 ? 'flex' : 'none'; }
    if (stickyEl) { stickyEl.innerText = wishlistNewCount; stickyEl.style.display = wishlistNewCount > 0 ? 'flex' : 'none'; }
}

function updateGlobalSupportCount() {
    const el = document.getElementById('global-support-count');
    if (!el) return;
    el.innerText = supportNewCount;
    el.style.display = (supportNewCount > 0) ? 'flex' : 'none';
    el.style.backgroundColor = "var(--accent-wood)"; el.style.color = "var(--wood-dark)";
}

function showWishlist(shouldPush = true) {
    currentView = 'wishlist'; wishlistNewCount = 0;
    localStorage.setItem('wishlistNewCount', 0); updateGlobalWishCount();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('.bottom-bar-item').forEach(i => i.classList.remove('active'));
    document.getElementById('wishlist-tab').classList.add('active');
    if (shouldPush) pushNavigationState('wishlist');
    const filtered = window.fullData.filter(b => wishlist.includes(b.id)); renderBooksList(filtered);
}

function showCategoriesAndHome(shouldPush = true) {
    currentView = 'home'; closeCart(); closeSupport();
    document.getElementById('main-search').value = ''; document.getElementById('sticky-search').value = '';
    const topItems = document.querySelectorAll('.category-item'); const bottomItems = document.querySelectorAll('.dropdown-item');
    topItems.forEach(i => i.classList.remove('active')); bottomItems.forEach(i => i.classList.remove('active'));
    if(topItems[0]) topItems[0].classList.add('active'); if(bottomItems[0]) bottomItems[0].classList.add('active');
    document.querySelectorAll('.bottom-bar-item').forEach(i => i.classList.remove('active'));
    document.getElementById('categories-bottom-tab').classList.add('active');
    if (shouldPush) pushNavigationState('home');
    renderBooksList(window.fullData); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCart(shouldPush = true) {
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
    addLockScroll();
    updateLayersScroll(); // تحديث السكرول فور فتح السلة
    if (shouldPush) pushNavigationState('cart'); updateCartUI();
}

function closeCart(shouldGoBack = true) {
    if (!document.getElementById('cart-drawer').classList.contains('open')) return;
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
    removeLockScroll();
    updateLayersScroll(); // إعادة السكرول لما تحته فور إغلاق السلة
    if (shouldGoBack && window.history.state?.view === 'cart') window.history.back();
}

function shopNow() { showCategoriesAndHome(); }

async function populateProvinces() {
    const provinceSelect = document.getElementById('customer-province');
    const lang = document.documentElement.lang || 'ar';
    for (const [provinceName, cost] of Object.entries(shippingPrices)) {
        const option = document.createElement('option'); 
        option.value = provinceName; 
        option.innerText = (lang === 'en') ? (await translateProvinceName(provinceName)) : provinceName;
        option.setAttribute('data-ar', provinceName); // حفظ الاسم العربي كـ Data Attribute
        provinceSelect.appendChild(option);
    }
    provinceSelect.addEventListener('change', updateCartUI);
}

async function confirmOrder() {
    if (cart.length === 0) { alert("السلة فارغة! لا يمكن تأكيد طلب بدون كتب."); return; }
    const nameInput = document.getElementById('customer-name'); const phoneInput = document.getElementById('customer-phone');
    const whatsappInput = document.getElementById('customer-whatsapp'); const provinceSelect = document.getElementById('customer-province');
    const addressTextarea = document.getElementById('customer-address'); const addressError = document.getElementById('address-error');
    const notesTextarea = document.getElementById('customer-notes'); const nameError = document.getElementById('name-error');
    const phoneError = document.getElementById('phone-error'); const whatsappError = document.getElementById('whatsapp-error');
    const provinceError = document.getElementById('province-error'); 
    const confirmBtn = document.querySelector('.confirm-order-btn');
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    nameError.style.display = 'none'; phoneError.style.display = 'none'; whatsappError.style.display = 'none'; provinceError.style.display = 'none'; addressError.style.display = 'none';
    let isValid = true;
    if (nameInput.value.trim().split(/\s+/).length < 2) { nameError.innerText = t.nameErrorMsg; nameError.style.display = 'block'; isValid = false; }
    const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
    if (!egyptianPhoneRegex.test(phoneInput.value.trim())) { phoneError.innerText = t.phoneErrorMsg; phoneError.style.display = 'block'; isValid = false; }
    if (!egyptianPhoneRegex.test(whatsappInput.value.trim())) { whatsappError.innerText = t.whatsappErrorMsg; whatsappError.style.display = 'block'; isValid = false; }
    if (provinceSelect.value === "") { provinceError.innerText = t.provinceErrorMsg; provinceError.style.display = 'block'; isValid = false; }
    if (addressTextarea.value.trim().length < 5) { addressError.innerText = t.addressErrorMsg; addressError.style.display = 'block'; isValid = false; }
    if (!isValid) return;
    const booksTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalAmount = booksTotal + shippingCost;
    const orderData = { customer_name: nameInput.value.trim(), customer_phone: phoneInput.value.trim(), customer_whatsapp: whatsappInput.value.trim(), province: provinceSelect.value, address: addressTextarea.value.trim(), notes: notesTextarea ? notesTextarea.value.trim() : "", items: cart, total_amount: totalAmount, shipping_cost: shippingCost, status: 'pending' };
    try {
        confirmBtn.disabled = true; confirmBtn.innerHTML = `${t.processingOrder} <i class="bi bi-hourglass-split"></i>`;
        const { error } = await _supabase.from('orders').insert([orderData]);
        if (error) throw new Error(`خطأ من سوبابيز: ${error.message}`);
        alert(t.orderSuccess);
        cart = []; updateCartUI(); saveCartToLocalStorage();
        nameInput.value = ''; phoneInput.value = ''; whatsappInput.value = ''; provinceSelect.value = ''; addressTextarea.value = ''; if(notesTextarea) notesTextarea.value = '';
        closeCart();
    } catch (err) { alert(`${t.orderError} ${err.message}`); }
    finally { confirmBtn.disabled = false; confirmBtn.innerHTML = `${t.confirmOrderBtn} <i class="bi bi-bag-check-fill"></i>`; }
}

let chatSubscription = null;
let typingTimer;
function showSupport() {
    document.getElementById('support-drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('open');
    addLockScroll();
    updateLayersScroll(); // تحديث السكرول فور فتح الدعم
    // لا نصفر العداد هنا، بل عند قراءة الرسائل
    // supportNewCount = 0; localStorage.setItem('supportNewCount', 0); updateGlobalSupportCount();
    // سيتم تصفير العداد عند تحميل الرسائل في startChatSync

    // سكرول لآخر المحادثة فور فتح الشات
    setTimeout(() => { const cb = document.getElementById('chat-body'); if(cb) cb.scrollTop = cb.scrollHeight; }, 100);

    document.querySelectorAll('.bottom-bar-item').forEach(i => i.classList.remove('active'));
    document.getElementById('support-tab').classList.add('active'); pushNavigationState('support');
    const savedPhone = localStorage.getItem('user_chat_phone'); const cartPhoneInput = document.getElementById('customer-phone');
    const cartPhone = cartPhoneInput ? cartPhoneInput.value.trim().replace(/\D/g, '') : ''; const phoneToUse = savedPhone || cartPhone;
    if (phoneToUse) {
        document.getElementById('chat-auth-section').style.display = 'none'; document.getElementById('end-chat-btn').style.display = 'block';
        document.getElementById('chat-body').style.display = 'flex'; startChatSync(phoneToUse);
    } else {
        document.getElementById('chat-auth-section').style.display = 'block'; document.getElementById('end-chat-btn').style.display = 'none';
        document.getElementById('chat-body').style.display = 'none';
    }

    // مراقبة الكتابة
    document.getElementById('chat-input').addEventListener('input', () => {
        if (!chatSubscription) return;
        chatSubscription.send({ type: 'broadcast', event: 'typing', payload: { typing: true, sender: 'user' } });
    });
}

function closeSupport(shouldGoBack = true) {
    if (!document.getElementById('support-drawer').classList.contains('open')) return;
    document.getElementById('support-drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('open');
    removeLockScroll();
    updateLayersScroll(); // إعادة السكرول لما تحته فور إغلاق الدعم
    if (shouldGoBack && window.history.state?.view === 'support') window.history.back();
}

async function identifyChatUser() {
    const phoneInput = document.getElementById('chat-phone-input');
    const errorDiv = document.getElementById('chat-auth-error'); 
    const btn = phoneInput.closest('#chat-auth-section').querySelector('.confirm-order-btn');
    const rawPhone = phoneInput.value.trim().replace(/\D/g, '');
    
    // إخفاء رسالة الخطأ فور بدء الكتابة مرة أخرى لتحسين التجربة
    phoneInput.addEventListener('input', () => {
        errorDiv.style.display = 'none';
        errorDiv.innerHTML = '';
    }, { once: true });

    // تنظيف الرقم من أي كود دولة للحصول على الـ 11 رقم الأساسية
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('20') && cleanPhone.length > 11) cleanPhone = cleanPhone.substring(2);
    if (!cleanPhone.startsWith('0') && cleanPhone.length === 10) cleanPhone = '0' + cleanPhone;

    errorDiv.style.display = 'none'; 
    errorDiv.innerHTML = '';

    if (!/^(010|011|012|015)[0-9]{8}$/.test(cleanPhone)) {
        errorDiv.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> يرجى إدخال رقم موبايل مصري صحيح (11 رقم) 📱'; 
        errorDiv.style.display = 'block';
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = 'جاري التحقق من بياناتك... <i class="bi bi-hourglass-split"></i>';
        
        // البحث عن الرقم بكل أشكاله الممكنة (بصفر، بدون صفر، أو جزء من الرقم)
        const searchPart = cleanPhone.substring(1); // الـ 10 أرقام بدون الصفر
        const { data: orders, error } = await _supabase
            .from('orders')
            .select('customer_phone, customer_whatsapp, id')
            .or(`customer_phone.ilike.%${searchPart}%,customer_whatsapp.ilike.%${searchPart}%`);

        if (error) throw error;

        if (!orders || orders.length === 0) {
            errorDiv.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                    <i class="bi bi-search-heart" style="color: #ffdada; font-size: 1.2rem;"></i>
                    <b style="font-size: 0.9rem;">الرقم (${cleanPhone}) غير مسجل لدينا.</b>
                </div>
                <p style="font-size: 0.8rem; opacity: 0.9; line-height: 1.6; margin: 0 5px;">هذا الرقم غير مرتبط بأي طلبات سابقة. يرجى إتمام طلبكِ الأول لتفعيل خدمات الدعم الفني وتتبع الشحنات، أو التأكد من صحة الرقم المدخل. ✨</p>
                <a href="https://wa.me/201551455490" target="_blank" style="color: #ffdada; text-decoration: none; font-weight: bold; border: 1.5px solid #ff4d4d; padding: 6px 18px; border-radius: 25px; display: inline-block; margin-top: 12px; font-size: 0.75rem; background: rgba(255,0,0,0.15); transition: 0.3s;">
                    <i class="bi bi-whatsapp"></i> مساعدة فورية عبر واتساب
                </a>
            `;
            errorDiv.style.display = 'block';
        } else {
            const primaryPhone = orders[0].customer_phone;
            localStorage.setItem('user_chat_phone', primaryPhone);
            showSupport(); 
        }
    } catch (err) {
        console.error(err);
        errorDiv.innerText = "حدث خطأ بسيط في الاتصال، حاولي مرة أخرى.";
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'بدء المحادثة';
    }
}

async function startChatSync(phone) {
    if (chatSubscription) return;
    primeChatAudio(); // تأكيد تفعيل الصوت عند بدء المزامنة
    phone = phone.replace(/\D/g, '');
    const chatBody = document.getElementById('chat-body');

    // 1. تحميل تاريخ الرسائل
    const { data, error } = await _supabase.from('messages').select('*').eq('customer_phone', phone).order('created_at', { ascending: true }); // فلترة الرسائل حسب رقم العميل
    
    // تصفير عداد الرسائل الجديدة عند فتح الشات وقراءة الرسائل
    supportNewCount = 0; localStorage.setItem('supportNewCount', 0); updateGlobalSupportCount();
    if (error) console.error("Error loading history:", error);

    // تنظيف الرسائل القديمة فقط مع الحفاظ على مؤشر الكتابة
    const oldMsgs = chatBody.querySelectorAll('.msg');
    oldMsgs.forEach(m => m.remove());
    
    if (data && data.length > 0) { 
        data.forEach(m => appendMessage(m.text, m.sender)); 
        // سكرول لآخر رسالة بعد تحميل التاريخ
        // إذا كانت آخر رسالة من الأدمن، لا نزيد العداد
        if (data[data.length - 1].sender === 'admin') supportNewCount = 0;
        setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 100);
    } else {
        appendMessage('أهلاً بكِ مجدداً! ✨ كيف يمكننا مساعدتكِ؟', 'admin');
    }

    // 2. الاشتراك في القناة الموحدة
    chatSubscription = _supabase.channel(`support_chat_${phone}`, { config: { broadcast: { self: false } } })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `customer_phone=eq.${phone}` }, payload => {
            if (payload.eventType === 'INSERT' && payload.new.sender === 'admin') {
                // منع التكرار: إذا كان نص الرسالة هو نفس آخر نص استلمناه عبر البث، نتجاهله
                if (payload.new.text === lastProcessedMsgText) return;
                lastProcessedMsgText = payload.new.text;

                if (!document.getElementById('support-drawer').classList.contains('open')) { supportNewCount++; localStorage.setItem('supportNewCount', supportNewCount); updateGlobalSupportCount(); }
                chatSound.currentTime = 0; chatSound.play().catch(()=>{}); appendMessage(payload.new.text, 'admin');
            }
        })
        .on('broadcast', { event: 'msg' }, payload => { 
            if (payload.payload.sender === 'admin') { 
                // منع التكرار بناءً على معرف فريد وليس النص
                if (payload.payload.msgId === lastProcessedBroadcastId) return;
                lastProcessedBroadcastId = payload.payload.msgId;

                // تحديث آخر نص استلمناه لمنع تكرار الرسالة القادمة من قاعدة البيانات
                lastProcessedMsgText = payload.payload.text;

                // تحديث عداد الإشعارات إذا كان الشات مغلقاً (زي نظام المفضلة)
                if (!document.getElementById('support-drawer').classList.contains('open')) {
                    supportNewCount++;
                    localStorage.setItem('supportNewCount', supportNewCount);
                    updateGlobalSupportCount();
                }

                chatSound.currentTime = 0; chatSound.play().catch(()=>{}); 
                appendMessage(payload.payload.text, 'admin'); // تم تعديل payload.new.text إلى payload.payload.text
                
                // إظهار إشعار لو الصفحة مقفولة أو في الخلفية
                triggerBrowserNotification(payload.payload.text);
            } 
        })
        .on('broadcast', { event: 'typing' }, payload => {
            if (payload.payload.sender === 'admin') {
                const indicator = document.getElementById('client-typing-indicator');
                if (indicator) {
                    const isTyping = payload.payload.typing;
                    if (isTyping) {
                        indicator.style.display = 'flex';
                        const cb = document.getElementById('chat-body');
                        cb.scrollTop = cb.scrollHeight;
                        clearTimeout(typingTimer);
                        typingTimer = setTimeout(() => { indicator.style.display = 'none'; }, 4000);
                    } else {
                        indicator.style.display = 'none';
                    }
                }
            }
        })
        .on('broadcast', { event: 'delete_chat' }, () => { 
            document.getElementById('chat-body').innerHTML = '<div class="msg msg-admin" style="opacity:0.6; align-self:center; text-align:center; width: 100%;">تم تنظيف المحادثة... ✨</div>'; 
        })
        .subscribe();
}

function endChat() {
    if(!confirm("هل أنتِ متأكدة من إنهاء الدردشة؟ سيتم مسح بيانات الدخول.")) return;
    localStorage.removeItem('user_chat_phone');
    if (chatSubscription) { _supabase.removeAllChannels(); chatSubscription = null; }
    document.getElementById('chat-body').innerHTML = ''; showSupport();
}

function sendQuickMsg(text) { const input = document.getElementById('chat-input'); input.value = text; sendMessage(); }

async function sendMessage() {
    const input = document.getElementById('chat-input'); const text = input.value.trim();
    const phone = localStorage.getItem('user_chat_phone') || (document.getElementById('customer-phone') ? document.getElementById('customer-phone').value.trim().replace(/\D/g, '') : '');
    
    if (!text) return;
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    if (!phone) { alert(t.phoneRequiredAlert); showSupport(); return; }
    if (!chatSubscription) await startChatSync(phone);

    // إرسال الرسالة عبر البث المباشر فوراً لسرعة الاستجابة عند الأدمن
    if (chatSubscription) {
        chatSubscription.send({ 
            type: 'broadcast', 
            event: 'msg', 
            payload: { text, sender: 'user', msgId: Date.now() } 
        });
    }

    appendMessage(text, 'user'); input.value = '';
    await _supabase.from('messages').insert([{ customer_phone: phone, sender: 'user', text: text }]);

    // --- نظام الرد التلقائي الذكي (Utopia Bot) ---
    if (text === 'الأوردر بتاعي لسه موصلش؟ 🚚') {
        setTimeout(() => handleAutoOrderInquiry(phone), 1000);
    } else if (/^\d+$/.test(text)) { // إذا كتب العميل أرقام فقط (يفترض أنها رقم طلب)
        setTimeout(() => handleSpecificOrderInquiry(phone, text), 1000);
    }
}

// وظيفة الرد التلقائي بقائمة الطلبات
async function handleAutoOrderInquiry(phone) {
    const { data: orders, error } = await _supabase
        .from('orders')
        .select('*')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false }); // فلترة الطلبات حسب رقم العميل
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];

    if (error || !orders || orders.length === 0) {
        await sendAdminAutoReply(phone, "لم نجد أي طلبات مسجلة لهذا الرقم حتى الآن. تأكدي من إدخال الرقم الصحيح الذي سجلتِ به الطلب ✨");
        return;
    }

    let reply = `أهلاً بكِ! لقد وجدتُ ${orders.length} طلبات مرتبطة برقمك:\n\n`;
    orders.forEach(o => {
        const itemsList = o.items.map(i => `${i.title} (x${i.qty})`).join('، ');
        reply += `📌 طلب رقم: ${o.id}\nمحتويات الطلب: ${itemsList}\n\n`;
    });
    reply += "عن أي طلب تودين الاستفسار؟ من فضلكِ أرسلي (رقم الطلب فقط) للمتابعة.";
    
    await sendAdminAutoReply(phone, reply);
}

// وظيفة الرد بحالة طلب معين
async function handleSpecificOrderInquiry(phone, orderId) {
    const lang = document.documentElement.lang || 'ar';
    const t = translations[lang];
    const { data: order, error } = await _supabase // فلترة الطلبات حسب رقم العميل ورقم الطلب
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('customer_phone', phone)
        .maybeSingle();

    if (error || !order) return; // لا نرد إذا لم يخص الرقم أو غير موجود لعدم الإزعاج

    const statusMap = { 
        'pending': 'جديد (جاري المراجعة والتجهيز) ⏳', 
        'shipping': 'جاري التنسيق مع شركة الشحن 🚚', 
        'shipped': 'تم الشحن وهو في الطريق إليكِ الآن 📦', 
        'completed': 'تم التوصيل بنجاح.. نتمنى أن تنال الكتب إعجابكِ ✅', 
        'returned': 'تم إرجاع الطلب 🛑' 
    };
    const statusText = statusMap[order.status] || order.status;

    let reply = `بخصوص طلبك رقم #${orderId}:\n`;
    reply += `الحالة الحالية: ${statusText}.\n\n`;
    reply += "إذا كان لديكِ أي استفسار آخر، اتركيه هنا وسنتواصل معكِ في أقرب وقت ممكن ✨";

    await sendAdminAutoReply(phone, reply);
}

// وظيفة مساعدة لإرسال رد من الأدمن برمجياً
async function sendAdminAutoReply(phone, text) {
    const msgId = Date.now();

    // تحديث معرّفات منع التكرار محلياً قبل الإرسال
    // هذا يمنع المستمع (Listener) من إضافة الرسالة مرة أخرى عند وصولها من قاعدة البيانات
    lastProcessedBroadcastId = msgId;
    lastProcessedMsgText = text;

    // 1. إرسال بث مباشر ليظهر عند العميل فوراً
    if (chatSubscription) {
        chatSubscription.send({ 
            type: 'broadcast', 
            event: 'msg', 
            payload: { text, sender: 'admin', msgId } 
        });
    }
    // 2. عرضه في الشات الحالي
    appendMessage(text, 'admin');
    // 3. حفظه في قاعدة البيانات ليظهر للأدمن
    await _supabase.from('messages').insert([{ customer_phone: phone, sender: 'admin', text }]);
}

// وظيفة إرسال إشعار للمتصفح مثل الواتساب
async function triggerBrowserNotification(messageText) {
    if (Notification.permission === 'granted') {
        const options = {
            body: messageText,
            icon: "https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/55555.jpg",
            badge: "", // حذف الرابط لمنع المربع الأبيض
            vibrate: [300, 100, 300, 100, 400], // نفس الاهتزاز المميز
            tag: 'new-message', // تجميع الإشعارات المتكررة
            renotify: true
        };

        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification("يوتوبيا لاند - رسالة جديدة", options);
        } else {
            new Notification("يوتوبيا لاند - رسالة جديدة", options);
        }
    }
}

// تحديث دالة toggleLanguage لتحديث خيارات المحافظات
const originalToggleLanguage = toggleLanguage;
toggleLanguage = async function() {
    await originalToggleLanguage(); // استدعاء الدالة الأصلية أولاً

    const lang = document.documentElement.lang || 'ar';
    const provinceSelect = document.getElementById('customer-province');
    if (provinceSelect) {
        for (let i = 0; i < provinceSelect.options.length; i++) {
            const option = provinceSelect.options[i];
            const arabicName = option.getAttribute('data-ar');
            if (arabicName) {
                if (lang === 'en') {
                    option.innerText = await translateProvinceName(arabicName);
                } else {
                    option.innerText = arabicName;
                }
            }
        }
    }
};

// وظيفة مراقبة الكروت لظهورها صف بصف عند السكرول
function observeBookCards() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.book-card').forEach(card => observer.observe(card));
}

// تعديل دالة renderBooksList لتشغيل المراقب
const originalRenderBooksList = renderBooksList;
renderBooksList = function(data) {
    originalRenderBooksList(data);
    observeBookCards();
};

function appendMessage(text, side) {
    const chatBody = document.getElementById('chat-body');
    const indicator = document.getElementById('client-typing-indicator');
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg msg-${side}`;
    msgDiv.innerText = text;

    // ضمان إضافة الرسالة قبل فقاعة "جاري الكتابة" لتبقى الفقاعة دائماً في الأسفل
    if (indicator) {
        chatBody.insertBefore(msgDiv, indicator);
    } else {
        chatBody.appendChild(msgDiv);
    }
    chatBody.scrollTop = chatBody.scrollHeight;
}

// وظيفة لإغلاق الدرج العلوي عند النقر على الـ overlay
function closeTopmostDrawer() {
    const supportDrawer = document.getElementById('support-drawer');
    const cartDrawer = document.getElementById('cart-drawer');

    if (supportDrawer && supportDrawer.classList.contains('open')) closeSupport();
    else if (cartDrawer && cartDrawer.classList.contains('open')) closeCart();
}