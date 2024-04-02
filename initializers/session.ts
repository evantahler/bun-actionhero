import { api, Connection } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";

const namespace = "session";

export interface SessionData {
  id: string;
  cookieName: typeof config.session.cookieName;
  createdAt: number;
  data: Record<string, any>;
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

  prefix = `${namespace}` as const;

  getKey = (connectionId: Connection["id"]) => {
    return `${this.prefix}:${connectionId}`;
  };

  load = async (connection: Connection) => {
    const key = this.getKey(connection.id);
    const data = await api.redis.redis.get(key);
    if (!data) return null;
    await api.redis.redis.expire(key, config.session.ttl);
    return JSON.parse(data) as SessionData;
  };

  create = async (connection: Connection, data: Record<string, any> = {}) => {
    const key = this.getKey(connection.id);

    const sessionData: SessionData = {
      id: connection.id,
      cookieName: config.session.cookieName,
      createdAt: new Date().getTime(),
      data,
    };

    await api.redis.redis.set(key, JSON.stringify(sessionData));
    await api.redis.redis.expire(key, config.session.ttl);
    return sessionData;
  };

  update = async (session: SessionData, data: Record<string, any>) => {
    const key = this.getKey(session.id);
    session.data = { ...session.data, ...data };
    await api.redis.redis.set(key, JSON.stringify(session));
    await api.redis.redis.expire(key, config.session.ttl);
    return session.data;
  };

  destroy = async (connection: Connection) => {
    const key = this.getKey(connection.id);
    const response = await api.redis.redis.del(key);
    return response > 0;
  };

  async initialize() {
    return {
      load: this.load,
      create: this.create,
      update: this.update,
      destroy: this.destroy,
    };
  }
}
