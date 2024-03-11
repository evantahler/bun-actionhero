# bun-api-template

[![Test](https://github.com/evantahler/bun-api-template/actions/workflows/test.yaml/badge.svg)](https://github.com/evantahler/bun-api-template/actions/workflows/test.yaml)

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
