import { api, Connection } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";
import type { User } from "../schema/users";

const namespace = "session";

export interface SessionData {
  id: number;
  csrfToken: string;
  createdAt: number;
}

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Session["initialize"]>>;
  }
}

export class Session extends Initializer {
  constructor() {
    super(namespace);
    this.startPriority = 600;
  }

  prefix = `${namespace}:` as const;

  getKey = (connection: Connection) => {
    return `${this.prefix}:${connection.id}`;
  };

  load = async (connection: Connection) => {
    const key = this.getKey(connection);
    const data = await api.redis.redis.get(key);
    if (!data) return null;
    await api.redis.redis.expire(key, config.session.ttl);
    return JSON.parse(data) as SessionData;
  };

  create = async (connection: Connection, user: User) => {
    const key = this.getKey(connection);
    const csrfToken = crypto.randomUUID() + ":" + crypto.randomUUID();

    const sessionData: SessionData = {
      id: user.id,
      csrfToken: csrfToken,
      createdAt: new Date().getTime(),
    };

    await api.redis.redis.set(key, JSON.stringify(sessionData));
    await api.redis.redis.expire(key, config.session.ttl);
    return sessionData;
  };

  destroy = async (connection: Connection) => {
    const key = this.getKey(connection);
    const response = await api.redis.redis.del(key);
    return response > 0;
  };

  async initialize() {
    return {
      load: this.load,
      create: this.create,
      destroy: this.destroy,
    };
  }
}
