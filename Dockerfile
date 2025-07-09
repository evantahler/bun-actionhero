FROM oven/bun:1 AS base

ENV NODE_ENV=production

WORKDIR /api

COPY package.json .
COPY bun.lockb .
RUN bun install --production --frozen-lockfile

COPY . /api

RUN bun buildExecutable

ENTRYPOINT [ "bun", "start" ]
