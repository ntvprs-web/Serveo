# Stage 1: Build Vite React frontend
FROM node:22-alpine AS client-builder
WORKDIR /app

COPY client/package*.json ./client/
RUN npm ci --prefix client

COPY client ./client

ARG VITE_MAPBOX_TOKEN=""
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build --prefix client

# Stage 2: Production Node.js backend serving API + client/dist
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3002

COPY backend/package*.json ./backend/
RUN cd backend && npm install --workspaces=false --omit=dev --no-audit --no-fund

COPY backend ./backend
COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /app/backend/data && chown -R node:node /app
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/api/health >/dev/null || exit 1

CMD ["node", "backend/server.js"]
