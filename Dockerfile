FROM oven/bun:1 as base
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY . .
RUN ls -la
RUN bun install --production --frozen-lockfile



RUN bun run next build

EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
