FROM oven/bun:1 as base
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY . .
# RUN bun install --production --frozen-lockfile
RUN bun install

RUN bun next build

EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "actionhero.ts", "start" ]
