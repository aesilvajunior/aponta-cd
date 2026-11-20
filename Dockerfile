# ==============================================================================
# Aponta CD — Dockerfile multi-stage (Node build -> Nginx não-root)
# Uso:
#   docker build \
#     --build-arg VITE_SUPABASE_URL=https://seu-projeto.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=sua-chave-anon \
#     -t aponta-cd:latest .
#   docker run -p 8080:8080 aponta-cd:latest
# ==============================================================================

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copia apenas manifestos primeiro para aproveitar cache de camadas
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copia o código-fonte
COPY . .

# Variáveis públicas injetadas em tempo de build pelo Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_ENV=production

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    VITE_APP_ENV=${VITE_APP_ENV}

RUN npm run build

# ---------- Stage 2: Runtime (Nginx sem privilégios de root) ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Remove configuração padrão e aplica config endurecida para SPA + PWA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia apenas os artefatos estáticos compilados
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
