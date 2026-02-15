import { api, Connection } from "../index";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";

const namespace = "session";
const prefix = `${namespace}` as const;

export interface SessionData<
  T extends Record<string, any> = Record<string, any>,
> {
  id: string;
  cookieName: typeof config.session.cookieName;
  createdAt: number;
  data: T;
}

function getKey(connectionId: Connection["id"]) {
  return `${prefix}:${connectionId}`;
}

async function load<T extends Record<string, any>>(connection: Connection) {
  const key = getKey(connection.id);
  const data = await api.redis.redis.get(key);
  if (!data) return null;
  await api.redis.redis.expire(key, config.session.ttl);
  return JSON.parse(data) as SessionData<T>;
}

async function create<T extends Record<string, any>>(
  connection: Connection,
  data = {} as T,
) {
  const key = getKey(connection.id);

  const sessionData: SessionData<T> = {
    id: connection.id,
    cookieName: config.session.cookieName,
    createdAt: new Date().getTime(),
    data,
  };

  await api.redis.redis.set(key, JSON.stringify(sessionData));
  await api.redis.redis.expire(key, config.session.ttl);
  return sessionData;
}

async function update<T extends Record<string, any>>(
  session: SessionData<T>,
  data: Record<string, any>,
) {
  const key = getKey(session.id);
  session.data = { ...session.data, ...data };
  await api.redis.redis.set(key, JSON.stringify(session));
  await api.redis.redis.expire(key, config.session.ttl);
  return session.data;
}

async function destroy(connection: Connection) {
  const key = getKey(connection.id);
  const response = await api.redis.redis.del(key);
  return response > 0;
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

  async initialize() {
    return {
      load,
      create,
      update,
      destroy,
    };
  }
}
