FROM oven/bun:1 AS base

ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=http://localhost:8080

WORKDIR /frontend

COPY package.json .
COPY bun.lockb .
# RUN bun install --production --frozen-lockfile
RUN bun install

COPY . /frontend

RUN bun compileNext

ENTRYPOINT [ "bun", "start" ]
