# BUSL-1.1 · Copyright (c) 2026 SilverVine Labs
# Tier-0 isolated verification — zero host Node/pnpm required
#   docker build -t slivervine-sanctuary .
#   docker run --rm slivervine-sanctuary
# Full bar override:
#   docker run --rm slivervine-sanctuary pnpm test

FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

CMD ["sh", "-c", "echo '[tier0] demo:delta-neutral start' && pnpm run demo:delta-neutral && echo '[tier0] demo:delta-neutral PASS'"]
