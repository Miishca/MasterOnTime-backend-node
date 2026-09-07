# MasterOnTime Backend (Node.js)

Node.js/TypeScript заміна старого Java (Spring) бекенду для [MasterOnTime](https://github.com/) фронтенду.

## Стек

- Express + TypeScript
- PostgreSQL + Prisma
- JWT-автентифікація (сумісна з `Authorization: Bearer <token>`, який очікує фронтенд)

## Порядок розробки (core-flow)

1. Auth (`/auth/registration`, `/auth/login`, `/api/users/me`)
2. Search (`/api/specialists/search`)
3. Booking (`/api/bookings/*`)
4. Reviews (`/api/reviews/*`)

Решта модулів зі старого бекенду (favorites, notifications, payments, admin, Google Calendar) — після core-flow.

## Локальний запуск

```bash
cp .env.example .env      # заповнити DATABASE_URL і JWT_SECRET
npm install
npm run prisma:migrate    # створити БД за схемою prisma/schema.prisma
npm run dev                # http://localhost:8080
```

Фронтенд (`MasterOnTime`, Vite) проксує `/auth` і `/api` на `http://localhost:8080` у dev-режимі — додаткових налаштувань на фронтенді не потрібно.
