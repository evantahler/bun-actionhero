export abstract class Server<T> {
  name: string;

  /**A place to store the actually server object you create */
  server?: T;

  constructor(name: string) {
    this.name = name;
  }

  abstract initialize(): Promise<void>;

  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;
}
