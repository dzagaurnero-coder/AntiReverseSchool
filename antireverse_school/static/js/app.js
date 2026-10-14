const coursesData = [
    {
        id: 100,
        title: "База Хаслера: Быстрый старт с 0 ₽",
        subtitle: "Вводный практический курс в ЛК",
        category: "РКО и Абуз",
        level: "Бесплатно",
        duration: "Сразу сегодня",
        lessons: "4 урока",
        rating: 5.0,
        reviewsCount: 2150,
        price: 0,
        oldPrice: 3990,
        gradient: "from-zinc-800 to-black",
        icon: "fa-solid fa-unlock-keyhole",
        isFreeStarter: true,
        skills: ["Безопасность", "Выбор связки"],
        syllabus: [{ title: "Урок 1. Введение", topics: "Обзор ниш." }]
    },
    {
        id: 101,
        title: "РКО & Фин-Офферы: Быстрый кэш на банках",
        subtitle: "Заработок от 3 000 до 18 000 ₽ за клиента",
        category: "РКО и Абуз",
        level: "Без вложений",
        duration: "Профит за 2 дня",
        lessons: "18 уроков",
        rating: 4.99,
        reviewsCount: 940,
        price: 4490,
        oldPrice: 8900,
        badge: "Хит",
        gradient: "from-lime-500/30 to-cyber-900",
        icon: "fa-solid fa-building-columns",
        skills: ["Выплаты до 18к", "Парсинг ИП"],
        syllabus: [{ title: "Модуль 1. Партнерки", topics: "Подключение." }]
    },
    {
        id: 102,
        title: "УБТ-Трафик Мафия: Reels, Shorts & TikTok",
        subtitle: "Условно-бесплатный трафик на миллионы просмотров",
        category: "Трафик и УБТ",
        level: "С телефона",
        duration: "Старт за 24 часа",
        lessons: "24 урока",
        rating: 4.98,
        reviewsCount: 1180,
        price: 4990,
        oldPrice: 9500,
        gradient: "from-violet-600/40 to-cyber-900",
        icon: "fa-solid fa-mobile-screen-button",
        skills: ["Прогрев", "CapCut"],
        syllabus: [{ title: "Модуль 1. Алгоритмы", topics: "Настройка." }]
    }
];

let cart = [];
let userState = {
    name: "Хаслер #1042",
    tg: "@antireverse_student",
    xp: 250,
    purchasedCourses: [100],
    orders: []
};

function formatPrice(num) {
    if (num === 0) return "БЕСПЛАТНО";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
}

function switchMainView(viewName) {
    const landing = document.getElementById('landing-view');
    const lk = document.getElementById('lk-view');
    if (viewName === 'lk') {
        landing.classList.add('hidden');
        lk.classList.remove('hidden');
        renderPersonalCabinet();
    } else {
        lk.classList.add('hidden');
        landing.classList.remove('hidden');
    }
}

function renderCourses() {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    
    let filtered = coursesData.filter(c => !c.isFreeStarter);
    grid.innerHTML = filtered.map(course => `
        <div class="card-cyber rounded-3xl border border-white/10 p-6 flex flex-col justify-between">
            <div>
                <span class="px-3 py-1 rounded-full bg-acid-400/20 text-acid-300 text-xs font-bold">${course.category}</span>
                <h3 class="font-display text-lg font-black text-white mt-3 mb-2">${course.title}</h3>
                <p class="text-zinc-400 text-sm mb-4">${course.subtitle}</p>
            </div>
            <div class="flex items-center justify-between pt-4 border-t border-white/10">
                <span class="font-display text-xl font-black text-white">${formatPrice(course.price)}</span>
                <button onclick="buyCourseNow(${course.id})" class="px-4 py-2.5 rounded-xl bg-acid-400 text-black font-extrabold text-xs uppercase">Забрать</button>
            </div>
        </div>
    `).join('');
}

function buyCourseNow(courseId) {
    if (!cart.includes(courseId)) cart.push(courseId);
    updateCartUI();
    openPaymentGateway();
}

function updateCalculator() {
    const perDeal = parseInt(document.getElementById('calc-niche').value, 10);
    const deals = parseInt(document.getElementById('calc-deals').value, 10);
    document.getElementById('calc-result').textContent = formatPrice(perDeal * deals);
}

function toggleCart(open) {
    const drawer = document.getElementById('cart-drawer');
    if (open) {
        updateCartUI();
        drawer.classList.remove('hidden');
    } else {
        drawer.classList.add('hidden');
    }
}

function updateCartUI() {
    const list = document.getElementById('cart-items-list');
    if (!list) return;
    list.innerHTML = cart.map(id => {
        const c = coursesData.find(item => item.id === id);
        return `<div class="p-3 bg-black/50 rounded-xl flex justify-between text-white text-sm"><span>${c.title}</span><span class="text-acid-400 font-bold">${formatPrice(c.price)}</span></div>`;
    }).join('');
}

function openPaymentGateway() {
    toggleCart(false);
    document.getElementById('payment-modal').classList.remove('hidden');
}

function closePaymentGateway() {
    document.getElementById('payment-modal').classList.add('hidden');
}

async function processIpPayment() {
    const clientName = document.getElementById('pay-client-name').value.trim();
    const clientTg = document.getElementById('pay-client-tg').value.trim();

    if (!clientName || !clientTg) {
        alert('Укажи Имя и Telegram!');
        return;
    }

    try {
        const response = await fetch('/api/payment/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name: clientName,
                client_tg: clientTg,
                cart_ids: cart,
                promo_code: '',
                pay_method: 'sbp'
            })
        });
        const data = await response.json();
        if (data.success) {
            userState.purchasedCourses.push(...data.unlocked_ids);
            cart = [];
            closePaymentGateway();
            switchMainView('lk');
            alert('Оплата прошла через сервер! Курсы открыты в ЛК.');
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка соединения с сервером.');
    }
}

function renderPersonalCabinet() {
    document.getElementById('lk-user-name').textContent = userState.name;
    document.getElementById('lk-user-tg').textContent = userState.tg;
    const myGrid = document.getElementById('lk-my-courses-grid');
    const myCourses = coursesData.filter(c => userState.purchasedCourses.includes(c.id));
    
    myGrid.innerHTML = myCourses.map(c => `
        <div class="card-cyber rounded-3xl p-5 border border-acid-400/40">
            <h4 class="font-display text-base font-black text-white mb-2">${c.title}</h4>
            <span class="text-acid-400 text-xs font-bold">▶ Доступ открыт в ЛК</span>
        </div>
    `).join('');
}

window.addEventListener('DOMContentLoaded', () => {
    renderCourses();
    updateCalculator();
});