# syntax=docker/dockerfile:1
# Builds the SPA and serves it with unprivileged nginx, which also proxies /api to the Go API.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
# Public, build-time values only (they end up in the bundle) — never secrets.
ARG VITE_TEAM_MEETING_URL=""
ARG VITE_GMAIL_INBOX_URL="https://mail.google.com/mail/u/0/#inbox"
ENV VITE_TEAM_MEETING_URL=$VITE_TEAM_MEETING_URL VITE_GMAIL_INBOX_URL=$VITE_GMAIL_INBOX_URL
RUN npx vite build && find dist -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/nginx-health || exit 1
