FROM oven/bun:1 AS base
WORKDIR /app

# Install Caddy
RUN apt update && apt install curl gnupg2 -y
RUN curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
RUN curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
RUN apt update && apt install caddy -y

ENV NODE_ENV=production

COPY . /app
# we want to the host ENV for caddy
RUN rm /app/.env

# RUN bun install --production --frozen-lockfile
RUN cd /app && bun install
RUN cd /app && bun compile

EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "start" ]
