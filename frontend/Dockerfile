FROM oven/bun:1 AS base

ENV NODE_ENV=production
ARG VITE_API_URL=http://localhost:8080

WORKDIR /frontend

COPY package.json .
COPY bun.lockb .
RUN bun install

COPY . /frontend

RUN bun run build

EXPOSE 3000

ENTRYPOINT [ "bun", "start" ]
