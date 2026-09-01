# ── Stage 1: 빌드 ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# 의존성 캐시 — package.json 변경 시에만 npm install 재실행
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: 실행 (정적 파일 서빙) ───────────────────────────
FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
