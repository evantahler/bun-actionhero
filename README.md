# bun-api-template

[![Test](https://github.com/evantahler/bun-api-template/actions/workflows/test.yaml/badge.svg)](https://github.com/evantahler/bun-api-template/actions/workflows/test.yaml)

## What is this Project?

This project aims to be a "modern" rewrite of the "full" ActionHero stack. It is a template for a new project, and is not yet feature complete. It is a work in progress.

I still believe in many of the ideas of Actionhero, which itself was an attempt to take the "best" ideas from Rails and and Node.js and shove them together.

### The key components of this project remain:

- Transport-agnostic Actions (HTTP, WebSockets, CLI, etc)
- Built-in support for background tasks (node-resuqe)
- Built-in support for caches (redis/actionhero-cache)
- Built in, strongly-typed API support connecting the backend to the frontend
- (new) Built-in support for ORM/models/migrations (replacing the `ah-sequelize-plugin`, which adds Sequelize to the mix; optionally using SQLite locally)
- (new) Built-in support page rendering (replacing the `ah-next-plugin`, which adds Next.js to the mix)

### Why Bun?

- TS/JS is still the best language
- Bundling
- Testing
- Module Resolution
- Amazing Packager
- Great DX.

## Getting Started

To install dependencies:

```bash
bun install
```

To run:

```bash
# one-time env setup
cp .env.example .env

# run the app
bun run --watch index.ts
```

To test:

```bash
bun test
```

To lint:

```bash
# To test
bun run prettier --check .
# To Fix
bun run prettier --write .
```

This project was created using `bun init` in bun v1.0.29. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
