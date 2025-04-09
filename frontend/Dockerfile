FROM oven/bun:1 AS base

ENV PORT=8080

WORKDIR /frontend

ENV NODE_ENV=production

COPY . /frontend

# RUN bun install --production --frozen-lockfile
RUN bun install
RUN bun compile

EXPOSE $PORT/tcp
ENTRYPOINT [ "bun", "start" ]
