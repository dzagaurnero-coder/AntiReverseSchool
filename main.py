# Сервер FastAPI + База данных заказов + Проверка оплаты

import os
import json
import random
import sqlite3
from datetime import datetime
from typing import List, Optional
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from dotenv import load_dotenv

from courses_data import COURSES_DB, PROMO_CODES

load_dotenv()

app = FastAPI(title="AntiReverseSchool Platform")

# Подключаем папку static и шаблоны templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Настройки из .env (для уведомлений в ТГ и секретного ключа админа)
TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN", "")
TG_ADMIN_ID = os.getenv("TG_ADMIN_ID", "")
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "my_super_secret_123")


# --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ SQLITE ---
def init_db():
    conn = sqlite3.connect("antireverse.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            client_name TEXT,
            client_tg TEXT,
            courses_ids TEXT,
            amount INTEGER,
            method TEXT,
            status TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()


# --- МОДЕЛИ ДАННЫХ ---
class CreateOrderRequest(BaseModel):
    client_name: str
    client_tg: str
    cart_ids: List[int]
    promo_code: Optional[str] = ""
    pay_method: str


# --- МАРШРУТЫ САЙТА ---
@app.get("/")
async def home_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/payment/create")
async def create_payment(data: CreateOrderRequest):
    if not data.cart_ids:
        raise HTTPException(status_code=400, detail="Корзина пуста")

    # 1. Считаем сумму строго на сервере по базе COURSES_DB
    subtotal = 0
    bought_titles = []
    valid_ids = []

    for cid in data.cart_ids:
        if cid in COURSES_DB:
            subtotal += COURSES_DB[cid]["price"]
            bought_titles.append(COURSES_DB[cid]["title"])
            valid_ids.append(cid)

    # 2. Проверяем промокод на сервере
    promo = (data.promo_code or "").strip().upper()
    discount_pct = PROMO_CODES.get(promo, 0.0)
    total_amount = round(subtotal * (1.0 - discount_pct))

    # 3. Генерируем уникальный номер заказа
    order_id = f"AR-{random.randint(10000, 99999)}"
    now_str = datetime.now().strftime("%d.%m.%Y %H:%M")

    # 4. Сохраняем заказ в базу данных со статусом 'pending' (ожидает проверки)
    # Если хочешь оставить мгновенную автовыдачу для теста — поменяй 'pending' на 'paid'
    initial_status = "paid" 

    conn = sqlite3.connect("antireverse.db")
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO orders (order_id, client_name, client_tg, courses_ids, amount, method, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_id,
        data.client_name.strip(),
        data.client_tg.strip(),
        json.dumps(valid_ids),
        total_amount,
        data.pay_method,
        initial_status,
        now_str
    ))
    conn.commit()
    conn.close()

    # 5. Отправляем уведомление тебе в Telegram (если указан TG_BOT_TOKEN в .env)
    if TG_BOT_TOKEN and TG_ADMIN_ID:
        msg = (
            f"💸 <b>Новый заказ #{order_id}</b>\n"
            f"👤 Имя: {data.client_name}\n"
            f"📱 TG: {data.client_tg}\n"
            f"📚 Курсы: {', '.join(bought_titles)}\n"
            f"💰 Сумма: <b>{total_amount} ₽</b> ({data.pay_method})"
        )
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage",
                    json={"chat_id": TG_ADMIN_ID, "text": msg, "parse_mode": "HTML"}
                )
        except Exception as e:
            print("Ошибка отправки в ТГ:", e)

    return {
        "success": True,
        "order_id": order_id,
        "amount": total_amount,
        "status": initial_status,
        "bought_titles": bought_titles,
        "unlocked_ids": valid_ids,
        "date": now_str
    }


@app.get("/api/user/orders/{tg_username}")
async def get_user_orders(tg_username: str):
    """Возвращает все оплаченные курсы и чеки ученика из базы данных сервера"""
    clean_tg = tg_username if tg_username.startswith("@") else f"@{tg_username}"
    conn = sqlite3.connect("antireverse.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT order_id, courses_ids, amount, method, created_at FROM orders WHERE client_tg = ? AND status = 'paid'",
        (clean_tg,)
    )
    rows = cursor.fetchall()
    conn.close()

    unlocked_courses = [100]
    orders_list = []
    for r in rows:
        c_ids = json.loads(r[1])
        for cid in c_ids:
            if cid not in unlocked_courses:
                unlocked_courses.append(cid)
        orders_list.append({
            "id": r[0],
            "date": r[4],
            "title": " + ".join([COURSES_DB[i]["title"] for i in c_ids if i in COURSES_DB]),
            "amount": r[2],
            "method": r[3]
        })

    return {"unlocked_courses": unlocked_courses, "orders": orders_list}