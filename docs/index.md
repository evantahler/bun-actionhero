---
layout: home
description: A modern TypeScript API framework built on Bun — the spiritual successor to ActionHero.
hero:
  name: Keryx
  text: The Modern TypeScript API Framework
  tagline: Write one action. It handles HTTP, WebSocket, CLI, background tasks, and MCP tool calls. Built on Bun, powered by Zod, backed by Redis and Postgres.
  image:
    src: /images/hearald.svg
    alt: Keryx herald
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/evantahler/keryx
features:
  - icon: "\U0001F500"
    title: One Action, Every Transport
    details: Write your controller once — it works as an HTTP endpoint, WebSocket handler, CLI command, background task, and MCP tool simultaneously.
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
  - icon: "\U0001F916"
    title: MCP & llms.txt
    details: Expose every action as an MCP tool for AI agents with OAuth 2.1 auth. This site also serves llms.txt and llms-full.txt so agents can read the full docs.
  - icon: "\U0001F5C4\uFE0F"
    title: Drizzle ORM
    details: First-class database support with auto-migrations and type-safe schemas. No separate ORM plugin needed — it's part of the stack.
---

<div class="tip custom-block" style="margin: 2rem auto; max-width: 688px;">
  <p class="custom-block-title">llms.txt available for coding agents</p>
  <p>This site provides <a href="/llms.txt">llms.txt</a> and <a href="/llms-full.txt">llms-full.txt</a> so AI coding agents can read the full documentation.</p>
</div>

<!--@include: ../README.md-->
