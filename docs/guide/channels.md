---
description: Channels define PubSub topics for real-time WebSocket messaging with middleware-based authorization.
---

# Channels

Every project I've worked on eventually needs real-time messaging — chat, live dashboards, notifications, presence indicators. Channels are how Keryx handles this. They define PubSub topics that WebSocket clients can subscribe to, with middleware for controlling who gets access.

Under the hood, channels use Redis PubSub, so messages are distributed across multiple server instances automatically. You don't need to think about sticky sessions or shared state.

## Defining a Channel

```ts
import { Channel } from "../classes/Channel";

export class MessagesChannel extends Channel {
  constructor() {
    super({
      name: "messages",
      description: "Public message stream",
    });
  }
}
```

That's a basic channel. Any WebSocket client can subscribe to `"messages"` and receive broadcasts.

## Pattern Matching

Channel names can be exact strings or RegExp patterns:

```ts
// Exact match — only "messages"
name: "messages";

// Pattern match — "room:123", "room:abc", etc.
name: /^room:.*$/;
```

This is useful when you have per-resource channels — chat rooms, user-specific feeds, document collaboration sessions. The `matches(channelName)` method handles the routing.

## Middleware

Channel middleware controls who can subscribe and handles cleanup on unsubscribe:

```ts
import type { ChannelMiddleware } from "../classes/Channel";

const AuthMiddleware: ChannelMiddleware = {
  runBefore: async (channel, connection) => {
    if (!connection.session) {
      throw new TypedError({
        message: "Must be logged in to subscribe",
        type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
      });
    }
  },
  runAfter: async (channel, connection) => {
    // cleanup on unsubscribe — presence tracking, etc.
  },
};
```

- **`runBefore`** runs before a connection subscribes. Throw a `TypedError` to deny the subscription.
- **`runAfter`** runs after a connection unsubscribes. Useful for cleanup or presence tracking.

## Custom Authorization

For more complex authorization logic, you can override the `authorize()` method directly on the channel class:

```ts
export class RoomChannel extends Channel {
  constructor() {
    super({ name: /^room:.*$/ });
  }

  async authorize(channelName: string, connection: Connection) {
    const roomId = channelName.split(":")[1];
    // check if the user has access to this room...
  }
}
```

This runs after middleware, so you can combine both approaches — middleware for common checks (is the user logged in?) and `authorize()` for channel-specific logic (does this user belong to this room?).

## Broadcasting

Use `api.pubsub.broadcast()` to send messages to all subscribers:

```ts
await api.pubsub.broadcast(
  "messages", // channel name
  { message: serializedMessage }, // payload
  `user:${userId}`, // sender identifier
);
```

Messages go through Redis PubSub, so they work across server instances. If you're running three backend processes behind a load balancer, a broadcast from one reaches subscribers on all three.

## WebSocket Security

Channels and WebSocket connections have several built-in protections. See the [Security guide](/guide/security) for the full picture.

### Channel Name Validation

Channel names must match `/^[a-zA-Z0-9:._-]{1,200}$/` — alphanumeric characters plus `:`, `.`, `_`, `-`, with a max length of 200. Invalid names are rejected before any subscription logic runs.

### Undefined Channels

If a client tries to subscribe to a channel name that doesn't match any registered channel, the subscription is denied with a `CHANNEL_NOT_FOUND` error. You must define a channel (exact or pattern) for every topic clients can subscribe to.

### Origin Validation

Before upgrading an HTTP connection to WebSocket, the server checks the `Origin` header against `config.server.web.allowedOrigins`. Requests from unrecognized origins are rejected, preventing Cross-Site WebSocket Hijacking (CSWSH).

### Connection Limits

Each WebSocket connection is subject to:

- **Message size** — messages larger than `websocketMaxPayloadSize` (default 64 KB) are rejected
- **Message rate** — clients sending more than `websocketMaxMessagesPerSecond` (default 20/s) are disconnected
- **Subscription count** — each connection can subscribe to at most `websocketMaxSubscriptions` (default 100) channels

All of these are configurable via environment variables. See [Configuration](/guide/config) for details.
