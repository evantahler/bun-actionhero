/**
 * Create a new Initializer. The required properties of an initializer. These can be defined statically (this.name) or as methods which return a value.
 */
export abstract class Initializer {
  /**The name of the Initializer. */
  name: string;
  /**What order should this Initializer load at (Default: 1000, core methods are < 1000) */
  loadPriority: number;
  /**What order should this Initializer start at (Default: 1000, core methods are < 1000) */
  startPriority: number;
  /**What order should this Initializer stop at (Default: 1000, core methods are < 1000) */
  stopPriority: number;

  constructor(name: string) {
    this.name = name;
    this.loadPriority = 1000;
    this.startPriority = 1000;
    this.stopPriority = 1000;
  }

  /**
   * Method run as part of the `initialize` lifecycle of your process.  Usually sets api['YourNamespace']
   */
  async initialize?(): Promise<any>;

  /**
   * Method run as part of the `start` lifecycle of your process.  Usually connects to remote servers or processes.
   */
  async start?(): Promise<any>;

  /**
   * Method run as part of the `initialize` lifecycle of your process.  Usually disconnects from remote servers or processes.
   */
  async stop?(): Promise<any>;
}

export type InitializerSortKeys =
  | "loadPriority"
  | "startPriority"
  | "stopPriority";
