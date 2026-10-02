#!/usr/bin/env bash
# Writes .env.e2e: an isolated stack (project "lke2e", loopback only, ports 481xx) for end-to-end tests.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.e2e ] && exit 0
cat > .env.e2e <<EOF
LK_PUBLIC_URL=http://localhost:48100
LK_WEB_HOST=127.0.0.1
LK_WEB_PORT=48100
LK_POSTGRES_PORT=48102
LK_POSTGRES_PASSWORD=$(openssl rand -hex 12)
LK_SMTP_PORT=48104
LK_MAILPIT_UI_PORT=48105
LK_MAILPIT_UI_AUTH=e2e:$(openssl rand -hex 6)
LK_COOKIE_SECURE=false
LK_SECRET_KEY=$(openssl rand -base64 48)
LK_ENCRYPTION_KEY=$(openssl rand -base64 32)
LK_SMTP_FROM="LecodeKanban <no-reply@e2e.local>"
EOF
chmod 600 .env.e2e
