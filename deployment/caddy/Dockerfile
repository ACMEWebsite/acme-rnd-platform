FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
COPY deployment/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /frontend/dist /srv
