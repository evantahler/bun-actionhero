---
layout: home
description: A modern TypeScript API framework built on Bun — the spiritual successor to ActionHero.
hero:
  name: bun-actionhero
  text: The Modern TypeScript API Framework
  tagline: Write one action. It handles HTTP, WebSocket, CLI, and background tasks. Built on Bun, powered by Zod, backed by Redis and Postgres.
  image:
    src: /images/flying-man.svg
    alt: ActionHero mascot
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/evantahler/bun-actionhero
features:
  - icon: "\U0001F500"
    title: One Action, Every Transport
    details: Write your controller once — it works as an HTTP endpoint, WebSocket handler, CLI command, and background task simultaneously.
  - icon: "\u26A1"
    title: Built on Bun
    details: Native TypeScript, fast startup, built-in test runner, no compilation step. Bun handles bundling, testing, and module resolution out of the box.
  - icon: "\U0001F6E1\uFE0F"
    title: Zod Validation
    details: Type-safe inputs with automatic validation. Your Zod schemas generate OpenAPI docs, power CLI --help, and validate WebSocket params — all from one definition.
  - icon: "\U0001F4E1"
    title: Real-Time Channels
    details: PubSub over Redis with middleware-based authorization. Define channel patterns, control who can subscribe, and broadcast to WebSocket clients.
  - icon: "\u2699\uFE0F"
    title: Background Tasks & Fan-Out
    details: Built-in Resque workers with a fan-out pattern for distributing work across child jobs. Track progress and collect results automatically.
  - icon: "\U0001F5C4\uFE0F"
    title: Drizzle ORM
    details: First-class database support with auto-migrations and type-safe schemas. No separate ORM plugin needed — it's part of the stack.
---

<!--@include: ../README.md-->
