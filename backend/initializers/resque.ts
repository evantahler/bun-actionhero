import {
  Queue,
  Scheduler,
  Worker,
  type Job,
  type ParsedJob,
} from "node-resque";
import {
  Action,
  api,
  config,
  Connection,
  logger,
  RUN_MODE,
  type ActionParams,
} from "../api";
import { Initializer } from "../classes/Initializer";
import { TypedError } from "../classes/TypedError";

const namespace = "resque";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Resque["initialize"]>>;
  }
}

let SERVER_JOB_COUNTER = 1;

export class Resque extends Initializer {
  constructor() {
    super(namespace);

    this.loadPriority = 250;
    this.startPriority = 10000;
    this.stopPriority = 900;
  }

  startQueue = async () => {
    api.resque.queue = new Queue(
      { connection: { redis: api.redis.redis } },
      api.resque.jobs,
    );

    api.resque.queue.on("error", (error) => {
      logger.error(`[resque:queue] ${error}`);
    });

    await api.resque.queue.connect();
  };

  stopQueue = async () => {
    if (api.resque.queue) {
      return api.resque.queue.end();
    }
  };

  startScheduler = async () => {
    if (config.tasks.enabled === true) {
      api.resque.scheduler = new Scheduler({
        connection: { redis: api.redis.redis },
        timeout: config.tasks.timeout,
        stuckWorkerTimeout: config.tasks.stuckWorkerTimeout,
        retryStuckJobs: config.tasks.retryStuckJobs,
      });

      api.resque.scheduler.on("error", (error) => {
        logger.error(`[resque:scheduler] ${error}`);
      });

      await api.resque.scheduler.connect();

      api.resque.scheduler.on("start", () => {
        logger.info(`[resque:scheduler] started`);
      });
      api.resque.scheduler.on("end", () => {
        logger.info(`[resque:scheduler] ended`);
      });
      api.resque.scheduler.on("poll", () => {
        logger.debug(`[resque:scheduler] polling`);
      });
      api.resque.scheduler.on("leader", () => {
        logger.info(`[resque:scheduler] leader elected`);
      });
      api.resque.scheduler.on(
        "cleanStuckWorker",
        (workerName, errorPayload, delta) => {
          logger.warn(
            `[resque:scheduler] cleaning stuck worker: ${workerName}, ${errorPayload}, ${delta}`,
          );
        },
      );

      api.resque.scheduler.start();
      await api.actions.enqueueAllRecurrent();
    }
  };

  stopScheduler = async () => {
    if (api.resque.scheduler && api.resque.scheduler.connection.connected) {
      await api.resque.scheduler.end();
    }
  };

  startWorkers = async () => {
    let id = 0;

    while (id < config.tasks.taskProcessors) {
      const worker = new Worker(
        {
          connection: { redis: api.redis.redis },
          queues: Array.isArray(config.tasks.queues)
            ? config.tasks.queues
            : await config.tasks.queues(),
          timeout: config.tasks.timeout,
          name: `worker:${id}`,
        },
        api.resque.jobs,
      );

      // normal worker emitters
      worker.on("start", () => {
        logger.info(`[resque:${worker.name}] started`);
      });
      worker.on("end", () => {
        logger.info(`[resque:${worker.name}] ended`);
      });
      worker.on("cleaning_worker", () => {
        logger.debug(`[resque:${worker.name}] cleaning worker`);
      });
      worker.on("poll", (queue) => {
        logger.debug(`[resque:${worker.name}] polling, ${queue}`);
      });
      worker.on("job", (queue, job: ParsedJob) => {
        logger.debug(
          `[resque:${worker.name}] job acquired, ${queue}, ${job.class}, ${JSON.stringify(job.args[0])}`,
        );
      });
      worker.on("reEnqueue", (queue, job: ParsedJob, plugin) => {
        logger.debug(
          `[resque:${worker.name}] job reEnqueue, ${queue}, ${job.class}, ${JSON.stringify(job.args[0])}`,
        );
      });
      worker.on("pause", () => {
        logger.debug(`[resque:${worker.name}] paused`);
      });

      worker.on("failure", (queue, job, failure, duration) => {
        logger.warn(
          `[resque:${worker.name}] job failed, ${queue}, ${job.class}, ${JSON.stringify(job?.args[0] ?? {})}: ${failure} (${duration}ms)`,
        );
      });
      worker.on("error", (error, queue, job) => {
        logger.warn(
          `[resque:${worker.name}] job error, ${queue}, ${job?.class}, ${JSON.stringify(job?.args[0] ?? {})}: ${error}`,
        );
      });

      worker.on("success", (queue, job: ParsedJob, result, duration) => {
        logger.info(
          `[resque:${worker.name}] job success ${queue}, ${job.class}, ${JSON.stringify(job.args[0])} | ${JSON.stringify(result)} (${duration}ms)`,
        );
      });

      api.resque.workers.push(worker);
      id++;
    }

    for (const worker of api.resque.workers) {
      try {
        await worker.connect();
        await worker.start();
      } catch (error) {
        logger.fatal(`[resque:${worker.name}] ${error}`);
        throw error;
      }
    }
  };

  stopWorkers = async () => {
    while (true) {
      const worker = api.resque.workers.pop();
      if (!worker) break;
      await worker.end();
    }
    api.resque.workers = [];
  };

  /** Load all actions as tasks and wrap them for node-resque jobs */
  loadJobs = async () => {
    const jobs: Record<string, Job<any>> = {};

    for (const action of api.actions.actions) {
      const job = this.wrapActionAsJob(action);
      jobs[action.name] = job;
    }

    return jobs;
  };

  wrapActionAsJob = (
    action: Action,
  ): Job<Awaited<ReturnType<(typeof action)["run"]>>> => {
    const job: Job<ReturnType<Action["run"]>> = {
      plugins: [],
      pluginOptions: {},

      perform: async function (params: ActionParams<typeof action>) {
        const connection = new Connection(
          "resque",
          `job:${api.process.name}:${SERVER_JOB_COUNTER++}}`,
        );
        const paramsAsFormData = new FormData();

        if (typeof params.entries === "function") {
          for (const [key, value] of params.entries()) {
            paramsAsFormData.append(key, value);
          }
        }

        let response: Awaited<ReturnType<(typeof action)["run"]>>;
        let error: TypedError | undefined;
        try {
          const payload = await connection.act(action.name, paramsAsFormData);
          response = payload.response;
          error = payload.error;

          if (error) throw error;
        } finally {
          if (
            action.task &&
            action.task.frequency &&
            action.task.frequency > 0
          ) {
            await api.actions.enqueueRecurrent(action);
          }
        }
        return response;
      },
    };

    if (action.task && action.task.frequency && action.task.frequency > 0) {
      job.plugins!.push("JobLock");
      job.pluginOptions!.JobLock = { reEnqueue: false };
      job.plugins!.push("QueueLock");
      job.plugins!.push("DelayQueueLock");
    }

    return job;
  };

  async initialize() {
    const resqueContainer = {
      jobs: await this.loadJobs(),
      workers: [] as Worker[],
      startQueue: this.startQueue,
      stopQueue: this.stopQueue,
      startScheduler: this.startScheduler,
      stopScheduler: this.stopScheduler,
      startWorkers: this.startWorkers,
      stopWorkers: this.stopWorkers,
      wrapActionAsJob: this.wrapActionAsJob,
    } as {
      queue: Queue;
      scheduler: Scheduler;
      workers: Worker[];
      jobs: Awaited<ReturnType<Resque["loadJobs"]>>;
      startQueue: () => Promise<void>;
      stopQueue: () => Promise<void>;
      startScheduler: () => Promise<void>;
      stopScheduler: () => Promise<void>;
      startWorkers: () => Promise<void>;
      stopWorkers: () => Promise<void>;
      wrapActionAsJob: (action: Action) => Job<any>;
    };

    return resqueContainer;
  }

  async start() {
    await this.startQueue();

    if (api.runMode === RUN_MODE.SERVER) {
      await this.startScheduler();
      await this.startWorkers();
    }
  }

  async stop() {
    if (api.runMode === RUN_MODE.SERVER) {
      await this.stopWorkers();
      await this.stopScheduler();
    }

    await this.stopQueue();
  }
}
