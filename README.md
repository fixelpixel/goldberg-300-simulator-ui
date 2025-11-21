# Virtual Goldberg 300 (demo)

Набор прототипов: React SPA для оператора, ядро симуляции и заготовка backend-gateway.  
Стартовая точка для презентации UI и обсуждения архитектуры.

## Быстрый старт (UI)
1. `cd apps/web-ui`
2. `npm install`
3. `npm run dev` и открыть указанный Vite-порт (обычно http://localhost:5173)
4. Рекомендуемая версия Node: 20 LTS (Vite 5 требует >=18.0.0 или >=20).

## Tailwind
- Добавлен Tailwind + PostCSS. Файл стилей: `apps/web-ui/src/index.css`, конфиги: `apps/web-ui/tailwind.config.js`, `apps/web-ui/postcss.config.js`.

## Backend-gateway (черновик)
- Исходники в `server-gateway/src`. Для запуска потребуется оформить отдельный `package.json` с `ws`, `typescript/tsx` и линком на `packages/*`.

## Что ещё сделать
- Оформить корневой workspace (pnpm/npm workspaces) и общий lint/format.
- Доработать state machine и логи в `packages/core-sterilizer`, оформить модбас-адаптер.

## Docker/Compose
- Собрать и запустить локально:
  ```
  docker compose up --build
  ```
  После сборки UI доступен на `http://localhost:5173`, gateway — `ws://localhost:8090`.
  (В sandbox порты не открываются, запускать на своей машине.)
