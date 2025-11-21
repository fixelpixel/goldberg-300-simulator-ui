# Node 20 на Debian (без musl), чтобы rollup подтянул правильные бинарники.
FROM node:20-slim AS base
WORKDIR /app

# Установка зависимостей по workspace package.json
COPY package.json ./
COPY apps/web-ui/package.json apps/web-ui/package.json
COPY packages/core-sterilizer/package.json packages/core-sterilizer/package.json
COPY packages/io-simulation/package.json packages/io-simulation/package.json
COPY packages/io-modbus/package.json packages/io-modbus/package.json
COPY server-gateway/package.json server-gateway/package.json

RUN npm install

FROM base AS build
WORKDIR /app
COPY . .
# Удаляем lock-файлы, чтобы избежать проблемы npm с optional deps (rollup native)
RUN rm -f package-lock.json apps/web-ui/package-lock.json && npm install
RUN cd apps/web-ui && npm install --no-package-lock && npm run build
RUN cd server-gateway && npm install --no-package-lock && npm run build

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app /app
RUN npm install -g serve tsx

ENV UI_PORT=5173
ENV GATEWAY_PORT=8090

EXPOSE 5173
EXPOSE 8090

CMD sh -c "serve -s apps/web-ui/dist -l $UI_PORT & tsx server-gateway/src/index.ts"
