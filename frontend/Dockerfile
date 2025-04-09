FROM oven/bun:1 AS base

ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /frontend

COPY . /frontend

# RUN bun install --production --frozen-lockfile
RUN bun install
RUN bun compileNext

EXPOSE $PORT/tcp
ENTRYPOINT [ "bun", "start" ]
