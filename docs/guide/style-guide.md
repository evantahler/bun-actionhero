---
description: Editorial style guide for Keryx documentation — voice, tone, capitalization, and formatting conventions.
---

# Docs Style Guide

This page is for anyone writing or editing Keryx documentation. Follow these conventions to keep the docs consistent.

## Naming & Capitalization

- **Keryx** — Always capitalized, used as a bare proper noun (like "Rails" or "Bun"), never "the Keryx" or "the Keryx framework" in prose
- **action / initializer / channel / middleware** — Lowercase in prose when referring to the concept or an instance ("write an action," "each initializer runs in order"). Capitalize only when referring to the class name directly, and use backticks: "the `Action` class," "extends `Initializer`"
- **MCP** — "an MCP tool" (not "a MCP" — the M is pronounced "em"). Spell out "Model Context Protocol" on first mention per page, then use "MCP" thereafter
- **WebSocket** — Capital W, capital S, one word. Never "Websocket," "websocket," or "web socket"
- **Bun, Zod, Drizzle, Redis, PostgreSQL** — Always capitalized as proper nouns
- **OAuth** — Capital O, capital A. "OAuth 2.1" with a space before the version

## Transport Lists

When listing all transports, use this canonical order: **HTTP, WebSocket, CLI, background tasks, and MCP**. Always include the Oxford comma.

## Code Terms in Prose

Use backticks for:

- Class names (`Action`, `Initializer`)
- Type names (`ActionParams<T>`, `ActionResponse<T>`)
- Property names (`web`, `inputs`, `task`)
- Method names (`run()`, `initialize()`)
- Config paths (`config.server.web.port`)
- File names (`keryx.ts`)

Don't use backticks for:

- General concepts (action, initializer, middleware)
- Transport names (HTTP, WebSocket)
- Tool names (Bun, Zod, Redis)

## Voice & Tone

**The voice:** An opinionated practitioner. You've built enough projects to know what works and what doesn't, and you're not shy about saying so. The tone is confident and prescriptive — earned through experience, not arrogance. Think: a senior engineer who's shipped real systems explaining things at a whiteboard. Knowledgeable but never lecturing.

**Earned snark is welcome.** If there's a common anti-pattern or a "don't do this" moment, say it plainly. The reader respects directness because the opinion is backed by real scars. But snark should punch at bad ideas, never at the reader.

Good examples:

- "You don't need a separate routes file. The route lives on the action — where you'll actually look for it six months from now."
- "Most frameworks make you write the same handler five times for five transports. That's not DRY, that's a staffing plan."
- "Middleware is powerful. It's also the first place people over-engineer. A simple `if` check in your action is fine — save middleware for cross-cutting concerns."

Bad examples (avoid):

- "Obviously, you should..." (condescending)
- "As any experienced developer knows..." (gatekeeping)
- "Simply do X" (nothing is simple if you're reading the docs)

**Perspective:** Strictly "you" (the reader). Avoid "we" — the focus is on what you're building, not on what the framework authors decided over lunch. The exception is the [About](/guide/about) page, which can use "we" when referring to the project and community.

## Grammar

- **Tense:** Present tense for describing what things do ("Keryx routes the request," not "Keryx will route the request")
- **Voice:** Active voice preferred ("the framework loads initializers" not "initializers are loaded by the framework")
- **Oxford comma:** Always ("HTTP, WebSocket, CLI, background tasks, and MCP")
- **Abbreviations:** Use `e.g.,` (with comma) in parenthetical examples. Spell out "for example" in running prose
- **Contractions:** Use freely — "it's," "you'll," "doesn't." The docs should read like conversation, not a textbook
- **"Simply" / "just" / "easy":** Avoid. If you need the docs, it's not simple yet. Describe what to do without editorializing the difficulty
- **Links:** External links use absolute URLs. Internal links use relative paths (`/guide/actions`). Link text should be descriptive (not "click here")

## Page Structure

- Every guide page should have a YAML frontmatter `description` field
- First mention of another Keryx concept should link to its guide page
- Code examples should be practical and runnable, not toy examples
- Lead with the "what" and "why," then show the code. Don't dump a code block without context
