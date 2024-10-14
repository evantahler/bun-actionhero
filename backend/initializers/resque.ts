import {
  logger,
  api,
  config,
  Action,
  Connection,
  type ActionParams,
  RUN_MODE,
} from "../api";
import {
  Queue,
  Scheduler,
  type ParsedJob,
  type Job,
  Worker,
} from "node-resque";
import { randomUUID } from "crypto";
import { Initializer } from "../classes/Initializer";
import { TypedError } from "../classes/TypedError";

const namespace = "resque";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Resque["initialize"]>>;
  }
}

export class Resque extends Initializer {
  constructor() {
    super(namespace);

    this.loadPriority = 250;
    this.startPriority = 150;
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

  stopQueue = () => {
    if (api.resque.queue) return api.resque.queue.end();
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
    if (api.resque.scheduler) return api.resque.scheduler.end();
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
          name: `worker-${id}`,
        },
        api.resque.jobs,
      );

      // normal worker emitters
      worker.on("start", () => {
        logger.info(`[resque:worker:${id}] started`);
      });
      worker.on("end", () => {
        logger.info(`[resque:worker:${id}] ended`);
      });
      worker.on("cleaning_worker", () => {
        logger.debug(`[resque:worker:${id}] cleaning worker`);
      });
      worker.on("poll", (queue) => {
        logger.debug(`[resque:worker:${id}] polling, ${queue}`);
      });
      worker.on("job", (queue, job: ParsedJob) => {
        logger.debug(
          `[resque:worker:${id}] job acquired, ${queue}, ${job.class}, ${JSON.stringify(job.args[0])}`,
        );
      });
      worker.on("reEnqueue", (queue, job: ParsedJob, plugin) => {
        logger.debug(
          `[resque:worker:${id}] job reEnqueue, ${queue}, ${job.class}, ${JSON.stringify(job.args[0])}`,
        );
      });
      worker.on("pause", () => {
        logger.debug(`[resque:worker:${id}] paused`);
      });

      worker.on("failure", (queue, job, failure, duration) => {
        logger.warn(
          `[resque:worker:${id}] job failed, ${queue}, ${job.class}, ${JSON.stringify(job?.args[0] ?? {})}: ${failure} (${duration}ms)`,
        );
      });
      worker.on("error", (error, queue, job) => {
        logger.warn(
          `[resque:worker:${id}] job error, ${queue}, ${job?.class}, ${JSON.stringify(job?.args[0] ?? {})}: ${error}`,
        );
      });

      worker.on("success", (queue, job: ParsedJob, result, duration) => {
        logger.info(
          `[resque:worker:${id}] job success ${queue}, ${job.class}, ${JSON.stringify(job.args[0])} | ${JSON.stringify(result)} (${duration}ms)`,
        );
      });

      api.resque.workers.push(worker);
      id++;
    }

    for (const worker of api.resque.workers) {
      await worker.connect();
      await worker.start();
    }
  };

  stopWorkers = async () => {
    for (const worker of api.resque.workers) {
      await worker.end();
    }
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
        const connection = new Connection("resque", `job:${randomUUID()}}`);
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
    } as {
      queue: Queue;
      scheduler: Scheduler;
      workers: Worker[];
      jobs: Awaited<ReturnType<Resque["loadJobs"]>>;
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
    await this.stopQueue();

    if (api.runMode === RUN_MODE.SERVER) {
      await this.stopWorkers();
      await this.stopScheduler();
    }
  }
}
