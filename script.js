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
let lastProcessedBroadcastId = null; // تعريف المتغير المفقود
let lastProcessedMsgText = null; // تعريف المتغير المفقود

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

document.addEventListener('DOMContentLoaded', () => {
    getMyLibraryData(); // جلب البيانات عند فتح الصفحة
    populateProvinces(); // ملء قائمة المحافظات عند تحميل الصفحة
    updateGlobalCartCount(); // تحديث عداد السلة عند تحميل الصفحة
    updateGlobalWishCount(); // تحديث عداد المفضلة
    
    // تفعيل المزامنة الخلفية للشات إذا كان المستخدم معروفاً
    const savedPhone = localStorage.getItem('user_chat_phone');
    updateGlobalSupportCount();
    if (savedPhone) startChatSync(savedPhone);
    
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
    
    // إغلاق كل النوافذ المفتوحة فوراً عند الرجوع
    document.querySelectorAll('.open, .active').forEach(el => {
        if (el.id === 'cart-drawer' || el.id === 'support-drawer' || el.id === 'drawer-overlay' || el.id === 'book-details-page') {
            el.classList.remove('open', 'active');
        }
    });
    document.body.classList.remove('lock-scroll');
    document.documentElement.classList.remove('lock-scroll');

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

    // تفعيل التحديث اللحظي للكتب (إضافة، تعديل، حذف)
    _supabase.channel('realtime-books').on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'books'
    }, payload => {
        console.log('تحديث في الكتب:', payload);
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
    
    if (data.length === 0) {
        if (currentView === 'wishlist') {
            container.innerHTML = `
                <div style="text-align:center; padding:80px 20px; color: var(--paper-light); grid-column: 1/-1;">
                    <i class="bi bi-bookmark-heart" style="font-size: 4rem; color: var(--accent-wood); opacity: 0.3; margin-bottom: 20px; display: block;"></i>
                    <h3 style="margin-bottom: 10px;">قائمة المفضلة فارغة</h3>
                    <p style="opacity: 0.7; margin-bottom: 30px;">لم تقم بإضافة أي كتب لمفضلتك بعد.</p>
                    <button class="shop-now-btn" onclick="shopNow()">اكتشف الآن <i class="bi bi-arrow-left-short"></i></button>
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

    let displayTitle = book.title;
    let displayAuthor = book.author;
    let displayDesc = book.description || '';

    if (lang === 'en' && t.bookData && t.bookData[book.id]) {
        displayTitle = t.bookData[book.id].title || displayTitle;
        displayAuthor = t.bookData[book.id].author || displayAuthor;
        displayDesc = t.bookData[book.id].desc || displayDesc;
    }

    return `
        <div class="book-card" style="animation: fadeInUp ${0.3 + (index * 0.1)}s ease-out;" onclick="showBookDetails('${book.id}')">
            <div class="image-box">
                ${has2nd ? `<div class="hover-trigger trigger-right"></div><div class="hover-trigger trigger-left"></div>` : ''}
                <img src="${img1}" class="main-img">
                ${has2nd ? `<img src="${img2}" class="hover-img">` : ''}
                <div class="image-indicators"><div class="dot active"></div>${has2nd ? `<div class="dot"></div>` : ''}</div>
            </div>
            <div class="book-actions">
                <span id="wish-btn-${book.id}" class="action-icon ${isInWishlist ? 'active' : ''}" title="المفضلة" 
                      onclick="event.stopPropagation(); toggleWishlist(${book.id})">
                    <i id="wish-icon-${book.id}" class="bi bi-bookmark-heart"></i>
                </span>
            </div>
            <h3>${displayTitle}</h3>
            <div class="star-rating" style="justify-content: center; font-size: 0.8rem;">
                <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-half"></i>
            </div>
            <p class="author-name">${t.by}: ${displayAuthor}</p>
            <p class="book-desc">${displayDesc}</p>
            <button class="cart-btn" id="add-btn-${book.id}" data-id="${book.id}" onclick="event.stopPropagation(); addItemToCart('${book.id}')"><i class="bi bi-cart-plus"></i></button>
            <div class="price-cart-container"><div class="price">${book.price} ${t.currency}</div></div>
        </div>`;
}

function getRandomBooks(count) {
    if (!window.fullData) return [];
    return [...window.fullData].sort(() => 0.5 - Math.random()).slice(0, count);
}

function getRelatedBooks(currentBook) {
    if (!window.fullData) return [];
    return window.fullData.filter(b => 
        b.category === currentBook.category && String(b.id) !== String(currentBook.id)
    ).slice(0, 4);
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
function showBookDetails(id, shouldPush = true) {
    const book = window.fullData.find(b => String(b.id) === String(id));
    if (!book) return;
    
    window.currentOpenedBookId = book.id; 
    currentDetailsQty = 1; 
    const detailsPage = document.getElementById('book-details-page');
    const content = document.getElementById('details-content');
    const isInWishlist = wishlist.includes(book.id);
    const isInCart = cart.find(i => String(i.id) === String(book.id));
    const img1 = getValidImageUrl(book.image_url);
    const img2 = getValidImageUrl(book.image_url2);
    const has2nd = book.image_url2 && book.image_url2 !== book.image_url;

    content.innerHTML = `
        <div class="details-image">
            <div class="details-image-container" id="details-img-container">
                <div class="details-slider" id="details-slider">
                    <img src="${img1}" alt="${book.title}">
                    ${has2nd ? `<img src="${img2}" alt="${book.title}">` : ''}
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
            <h1>${book.title}</h1>
            <p class="author">بواسطة: ${book.author}</p>
            <p class="full-desc">${book.description || 'لا يوجد وصف متاح لهذا الكتاب حالياً في يوتوبيا لاند.'}</p>
            <div style="font-size: 2rem; color: var(--paper-light); margin-bottom: 25px; font-weight: bold;">${book.price} ج.م</div>
            <div class="details-actions">
                <div class="details-qty-container">
                    <button class="qty-btn-det" onclick="updateDetQty(-1)"><i class="bi bi-dash"></i></button>
                    <span id="det-qty-val" style="font-size: 1.6rem; font-weight: bold; color: var(--paper-light); min-width: 30px; text-align: center;">1</span>
                    <button class="qty-btn-det" onclick="updateDetQty(1)"><i class="bi bi-plus"></i></button>
                </div>
                <button id="details-add-btn" class="shop-now-btn ${isInCart ? 'success' : ''}" style="flex: 1; min-width: 200px;" onclick="addItemToCart('${book.id}', currentDetailsQty)">
                    ${isInCart ? '<i class="bi bi-check-lg"></i> تم الإضافة' : '<i class="bi bi-cart-plus"></i> إضافة للسلة'}
                </button>
                <button id="details-wish-btn" class="wish-btn-large ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(${book.id}); updateDetailsWishBtn(${book.id})">
                    <i id="details-wish-icon" class="bi bi-bookmark-heart"></i>
                </button>
            </div>
        </div>
        <div class="extra-sections-wrapper" style="grid-column: 1 / -1;">
            <div class="section-header"><i class="bi bi-fire"></i><span>الأكثر مبيعاً في يوتوبيا</span></div>
            <div class="books-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 40px;">
                ${getRandomBooks(4).map(b => renderSmallCard(b)).join('')}
            </div>
            <div class="section-header"><i class="bi bi-lightbulb-fill"></i><span>كتب قد تهمك</span></div>
            <div class="books-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
                ${getRelatedBooks(book).map(b => renderSmallCard(b)).join('')}
            </div>
        </div>
    `;

    if (window.innerWidth >= 1024) {
        const grids = content.querySelectorAll('.extra-sections-wrapper .books-grid');
        grids.forEach(g => g.style.gridTemplateColumns = 'repeat(4, 1fr)');
    }

    detailsPage.style.display = 'flex'; 
    setTimeout(() => detailsPage.classList.add('active'), 10);
    document.body.classList.add('lock-scroll');
    document.documentElement.classList.add('lock-scroll');
    if (shouldPush) pushNavigationState('details', { id: book.id });
    detailsPage.scrollTo(0,0);
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
    }, 500);
    document.body.classList.remove('lock-scroll');
    document.documentElement.classList.remove('lock-scroll');
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
        dedicationText: "لكل من يجد ضالته بين الأسطر، لكل من يسافر دون أن يتحرك، ولكل عشاق الكتب.. هذا المكان لكم.",
        bookData: {}
    },
    en: {
        logo: "Utopia Land", search: "Search for title or author...", quickSearch: "Quick search...",
        categories: ["All", "Offers", "Novels", "Fantasy", "Self-Dev", "Religious", "Horror"],
        home: "Home", cart: "Cart", wishlist: "Wishlist", support: "Support",
        dedication: "Special Dedication", categoriesBottomBar: "Categories", by: "By", currency: "EGP",
        dedicationText: "For those who find themselves between the lines, for those who travel without moving, and for all book lovers.. this place is for you.",
        bookData: {
            1: { title: "Psychological Fragility", author: "Ismail Arafa", desc: "Discusses the phenomenon of psychological fragility." },
            2: { title: "Stockholm", author: "Ahmed Al-Hamdan", desc: "A mysterious journey between love and obsession." },
            3: { title: "Arses 1", author: "Ahmed Al-Hamdan", desc: "A fantasy epic blending magic and adventure." }
        }
    }
};

function toggleLanguage() {
    const html = document.documentElement;
    const langBtn = document.getElementById('lang-toggle');
    const isAr = html.dir === "rtl";
    const newLang = isAr ? "en" : "ar";
    const t = translations[newLang];
    html.dir = isAr ? "ltr" : "rtl";
    html.lang = newLang;
    langBtn.innerText = isAr ? "AR" : "EN";
    document.querySelectorAll('.logo, .sticky-logo').forEach(el => el.innerText = t.logo);
    document.getElementById('main-search').placeholder = t.search;
    document.getElementById('sticky-search').placeholder = t.quickSearch;
    const topCatItems = document.querySelectorAll('.category-item');
    const bottomCatItems = document.querySelectorAll('.dropdown-item');
    t.categories.forEach((name, i) => {
        if(topCatItems[i]) topCatItems[i].innerText = name;
        if(bottomCatItems[i]) bottomCatItems[i].innerText = name;
    });
    const barItems = document.querySelectorAll('.bottom-bar-item span:last-child');
    const barTexts = [t.categoriesBottomBar, t.cart, t.wishlist, t.support];
    barTexts.forEach((text, i) => { if(barItems[i]) barItems[i].innerText = text; });
    const dedicationH3 = document.querySelector('.dedication-box h3');
    if(dedicationH3) dedicationH3.innerHTML = `${t.dedication} <i class="bi bi-feather"></i>`;
    const dedicationP = document.querySelector('.dedication-box p');
    if(dedicationP) dedicationP.innerText = t.dedicationText;
    const currentData = (currentView === 'wishlist') ? window.fullData.filter(b => wishlist.includes(b.id)) : window.fullData;
    renderBooksList(currentData);
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
        container.innerHTML = `<div style="text-align:center; padding:80px 20px; color: var(--paper-light); display: flex; flex-direction: column; align-items: center; justify-content: center;"><i class="bi bi-cart-x" style="font-size: 4.5rem; color: var(--accent-wood); opacity: 0.4; margin-bottom: 20px;"></i><h3 style="font-size: 1.4rem; font-weight: bold; margin-bottom: 10px;">سلتك خالية من الكنوز..</h3><p style="font-size: 0.95rem; opacity: 0.7; margin-bottom: 25px;">رحلتك بين صفحات الكتب لم تبدأ بعد</p><button class="shop-now-btn" onclick="shopNow()">ابدأ التسوق الآن <i class="bi bi-bag-check-fill"></i></button></div>`;
        orderUI.style.display = 'none'; return;
    }
    orderUI.style.display = 'flex';
    shippingSec.style.display = provinceSelect.value ? 'block' : 'none';
    grandTotalSec.style.display = provinceSelect.value ? 'block' : 'none';
    container.innerHTML = cart.map((item, idx) => `<div class="cart-item"><img src="${item.image_url}" alt="${item.title}"><div class="cart-item-details"><h4>${item.title}</h4><p>${item.price} ج.م</p></div><div class="cart-controls"><button class="qty-btn" onclick="changeQty(${idx}, -1)"><i class="bi bi-dash-circle-fill"></i></button><span class="qty-val">${item.qty}</span><button class="qty-btn" onclick="changeQty(${idx}, 1)"><i class="bi bi-plus-circle-fill"></i></button></div><i class="bi bi-trash3 remove-item-btn" onclick="deleteFromCart(${idx})"></i></div>`).join('');
    const booksTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    totalVal.innerText = booksTotal;
    const totalBooksQty = cart.reduce((acc, item) => acc + item.qty, 0); 
    booksCountVal.innerText = totalBooksQty; 
    const selectedProvinceName = provinceSelect.value;
    shippingCost = shippingPrices[selectedProvinceName] || 0;
    if (selectedProvinceName && shippingCost > 0) {
        shippingMessageCostSpan.innerText = shippingCost;
        shippingInfoMessageDiv.style.display = 'block'; shippingSec.style.display = 'block'; grandTotalSec.style.display = 'block';
    } else {
        shippingInfoMessageDiv.style.display = 'none'; shippingSec.style.display = 'none'; grandTotalSec.style.display = 'none';
    }
    shippingVal.innerText = shippingCost; grandTotalVal.innerText = booksTotal + shippingCost;
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
    document.body.classList.add('lock-scroll'); document.documentElement.classList.add('lock-scroll');
    if (shouldPush) pushNavigationState('cart'); updateCartUI();
}

function closeCart(shouldGoBack = true) {
    if (!document.getElementById('cart-drawer').classList.contains('open')) return;
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
    document.body.classList.remove('lock-scroll'); document.documentElement.classList.remove('lock-scroll');
    if (shouldGoBack && window.history.state?.view === 'cart') window.history.back();
}

function shopNow() { showCategoriesAndHome(); }

function populateProvinces() {
    const provinceSelect = document.getElementById('customer-province');
    for (const [provinceName, cost] of Object.entries(shippingPrices)) {
        const option = document.createElement('option'); option.value = provinceName; option.innerText = provinceName;
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
    const provinceError = document.getElementById('province-error'); const confirmBtn = document.querySelector('.confirm-order-btn');
    nameError.style.display = 'none'; phoneError.style.display = 'none'; whatsappError.style.display = 'none'; provinceError.style.display = 'none'; addressError.style.display = 'none';
    let isValid = true;
    if (nameInput.value.trim().split(/\s+/).length < 2) { nameError.innerText = "الاسم يجب أن يتكون من كلمتين على الأقل."; nameError.style.display = 'block'; isValid = false; }
    const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
    if (!egyptianPhoneRegex.test(phoneInput.value.trim())) { phoneError.innerText = "أدخل رقم موبايل مصري صحيح (11 رقم)."; phoneError.style.display = 'block'; isValid = false; }
    if (!egyptianPhoneRegex.test(whatsappInput.value.trim())) { whatsappError.innerText = "أدخل رقم واتساب مصري صحيح (11 رقم)."; whatsappError.style.display = 'block'; isValid = false; }
    if (provinceSelect.value === "") { provinceError.innerText = "من فضلك اختر المحافظة."; provinceError.style.display = 'block'; isValid = false; }
    if (addressTextarea.value.trim().length < 5) { addressError.innerText = "من فضلك أدخلي العنوان بالتفصيل لضمان وصول الشحن."; addressError.style.display = 'block'; isValid = false; }
    if (!isValid) return;
    const booksTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalAmount = booksTotal + shippingCost;
    const orderData = { customer_name: nameInput.value.trim(), customer_phone: phoneInput.value.trim(), customer_whatsapp: whatsappInput.value.trim(), province: provinceSelect.value, address: addressTextarea.value.trim(), notes: notesTextarea ? notesTextarea.value.trim() : "", items: cart, total_amount: totalAmount, shipping_cost: shippingCost, status: 'pending' };
    try {
        confirmBtn.disabled = true; confirmBtn.innerHTML = 'جاري إرسال الطلب... <i class="bi bi-hourglass-split"></i>';
        const { error } = await _supabase.from('orders').insert([orderData]);
        if (error) throw new Error(`خطأ من سوبابيز: ${error.message}`);
        alert("تم استلام طلبك بنجاح! 🎉 سيتم التواصل معك قريباً.");
        cart = []; updateCartUI(); saveCartToLocalStorage();
        nameInput.value = ''; phoneInput.value = ''; whatsappInput.value = ''; provinceSelect.value = ''; addressTextarea.value = ''; if(notesTextarea) notesTextarea.value = '';
        closeCart();
    } catch (err) { alert("عذراً، حدث خطأ أثناء إرسال الطلب: " + err.message); }
    finally { confirmBtn.disabled = false; confirmBtn.innerHTML = 'تأكيد الطلب <i class="bi bi-bag-check-fill"></i>'; }
}

let chatSubscription = null;
let typingTimer;
function showSupport() {
    document.getElementById('support-drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('open');
    document.body.classList.add('lock-scroll'); document.documentElement.classList.add('lock-scroll');
    supportNewCount = 0; localStorage.setItem('supportNewCount', 0); updateGlobalSupportCount();

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
    document.body.classList.remove('lock-scroll'); document.documentElement.classList.remove('lock-scroll');
    if (shouldGoBack && window.history.state?.view === 'support') window.history.back();
}

function identifyChatUser() {
    const phoneInput = document.getElementById('chat-phone-input').value.trim();
    const phone = phoneInput.replace(/\D/g, ''); // تنظيف الرقم
    if (/^(010|011|012|015)[0-9]{8}$/.test(phone)) { localStorage.setItem('user_chat_phone', phone); showSupport(); }
    else alert("من فضلكِ أدخلي رقم موبايل مصري صحيح.");
}

async function startChatSync(phone) {
    if (chatSubscription) return;
    primeChatAudio(); // تأكيد تفعيل الصوت عند بدء المزامنة
    phone = phone.replace(/\D/g, '');
    const chatBody = document.getElementById('chat-body');

    // 1. تحميل تاريخ الرسائل
    const { data, error } = await _supabase.from('messages').select('*').eq('customer_phone', phone).order('created_at', { ascending: true });
    if (error) console.error("Error loading history:", error);

    // مسح الرسالة الترحيبية الافتراضية فور التأكد من هوية المستخدم
    chatBody.innerHTML = ''; 
    
    if (data && data.length > 0) { 
        data.forEach(m => appendMessage(m.text, m.sender)); 
        // سكرول لآخر رسالة بعد تحميل التاريخ
        setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 100);
    } else {
        // إذا لم يكن هناك تاريخ، نعيد الرسالة الترحيبية أو نتركها فارغة
        chatBody.innerHTML = '<div class="msg msg-admin">أهلاً بكِ مجدداً! ✨ كيف يمكننا مساعدتكِ؟</div>';
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
                if (document.visibilityState !== 'visible') {
                    new Notification("يوتوبيا لاند", { body: "لديكِ رسالة جديدة من الدعم الفني ✨", icon: "https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/55555.png" });
                }
            } 
        })
        .on('broadcast', { event: 'typing' }, payload => {
            if (payload.payload.sender === 'admin') {
                const indicator = document.getElementById('typing-indicator');
                if (!indicator) {
                    const div = document.createElement('div');
                    div.id = 'typing-indicator';
                    div.className = 'typing-indicator';
                    div.innerHTML = `الأدمن يكتب الآن <div class="typing-dots"><span></span><span></span><span></span></div>`;
                    document.getElementById('chat-body').appendChild(div);
                }
                const ind = document.getElementById('typing-indicator');
                ind.style.display = 'flex';
                document.getElementById('chat-body').scrollTop = document.getElementById('chat-body').scrollHeight;
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => { ind.style.display = 'none'; }, 2000);
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
    if (!phone) { alert("من فضلكِ أدخلي رقم الموبايل أولاً."); showSupport(); return; }
    if (!chatSubscription) await startChatSync(phone);

    // إرسال إشارة إيقاف الكتابة
    chatSubscription.send({ type: 'broadcast', event: 'typing', payload: { typing: false, sender: 'user' } });

    appendMessage(text, 'user'); input.value = '';
    await _supabase.from('messages').insert([{ customer_phone: phone, sender: 'user', text: text }]);
}

function appendMessage(text, side) {
    const chatBody = document.getElementById('chat-body'); const msgDiv = document.createElement('div');
    msgDiv.className = `msg msg-${side}`; msgDiv.innerText = text; chatBody.appendChild(msgDiv); chatBody.scrollTop = chatBody.scrollHeight;
}