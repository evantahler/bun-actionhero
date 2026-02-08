import { Action, api } from "../../api";
import { HOOK_TIMEOUT } from "./../setup";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { z } from "zod";
import { DEFAULT_QUEUE } from "../../classes/Action";

beforeAll(async () => {
  await api.initialize();
  const redisInitializer = api.initializers.find((i) => i.name === "redis");
  // @ts-ignore
  await redisInitializer.start();

  const dbInitializer = api.initializers.find((i) => i.name === "db");
  // @ts-ignore
  await dbInitializer.start();

  const applicationInitializer = api.initializers.find(
    (i) => i.name === "application",
  );
  // @ts-ignore
  await applicationInitializer.start();

  await api.resque.startQueue();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

// --- Test actions ---

const processedItems: Array<{ id: string }> = [];

const childInputs = z.object({
  itemId: z.string(),
  _fanOutId: z.string().optional(),
});

class FanOutChildAction implements Action {
  name = "fanout:child";
  inputs = childInputs;
  task = { queue: "worker" };
  run = async (params: z.infer<typeof childInputs>) => {
    processedItems.push({ id: params.itemId });
    return { processed: params.itemId };
  };
}

const failingChildInputs = z.object({
  itemId: z.string(),
  _fanOutId: z.string().optional(),
});

class FailingFanOutChildAction implements Action {
  name = "fanout:failing-child";
  inputs = failingChildInputs;
  task = { queue: "worker" };
  run = async (params: z.infer<typeof failingChildInputs>) => {
    throw new Error(`failed processing ${params.itemId}`);
  };
}

beforeEach(async () => {
  await api.redis.redis.flushdb();
  processedItems.length = 0;

  // Register test actions
  const child = new FanOutChildAction();
  api.actions.actions.push(child);
  api.resque.jobs[child.name] = api.resque.wrapActionAsJob(child);

  const failingChild = new FailingFanOutChildAction();
  api.actions.actions.push(failingChild);
  api.resque.jobs[failingChild.name] =
    api.resque.wrapActionAsJob(failingChild);
});

afterEach(async () => {
  // Clean up test actions
  api.actions.actions = api.actions.actions.filter(
    (a) => a.name !== "fanout:child" && a.name !== "fanout:failing-child",
  );
  delete api.resque.jobs["fanout:child"];
  delete api.resque.jobs["fanout:failing-child"];
});

describe("fanOut", () => {
  test("enqueues all items and returns correct counts", async () => {
    const inputs = [{ itemId: "1" }, { itemId: "2" }, { itemId: "3" }];
    const result = await api.actions.fanOut("fanout:child", inputs);

    expect(result.enqueued).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(result.actionName).toBe("fanout:child");
    expect(result.fanOutId).toBeTruthy();
  });

  test("injects _fanOutId into each child job's inputs", async () => {
    const inputs = [{ itemId: "a" }, { itemId: "b" }];
    const result = await api.actions.fanOut("fanout:child", inputs);

    // Check the queued jobs have _fanOutId
    const jobs = await api.actions.queued("worker");
    expect(jobs.length).toBe(2);
    for (const job of jobs) {
      expect(job.args[0]._fanOutId).toBe(result.fanOutId);
    }
  });

  test("stores fan-out metadata in Redis with TTL", async () => {
    const inputs = [{ itemId: "1" }];
    const result = await api.actions.fanOut("fanout:child", inputs);

    const metaKey = `fanout:${result.fanOutId}`;
    const meta = await api.redis.redis.hgetall(metaKey);
    expect(meta.total).toBe("1");
    expect(meta.completed).toBe("0");
    expect(meta.failed).toBe("0");
    expect(meta.actionName).toBe("fanout:child");
    expect(meta.queue).toBe("worker");

    const ttl = await api.redis.redis.ttl(metaKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  test("falls back to action's task.queue when no queue specified", async () => {
    const inputs = [{ itemId: "1" }];
    const result = await api.actions.fanOut("fanout:child", inputs);

    expect(result.queue).toBe("worker"); // from FanOutChildAction.task.queue
    const jobs = await api.actions.queued("worker");
    expect(jobs.length).toBe(1);
  });

  test("explicit queue override works", async () => {
    const inputs = [{ itemId: "1" }];
    const result = await api.actions.fanOut(
      "fanout:child",
      inputs,
      "custom-queue",
    );

    expect(result.queue).toBe("custom-queue");
    const jobs = await api.actions.queued("custom-queue");
    expect(jobs.length).toBe(1);
  });

  test("throws on nonexistent action", async () => {
    expect(
      api.actions.fanOut("nonexistent:action", [{ itemId: "1" }]),
    ).rejects.toThrow("action nonexistent:action not found");
  });

  test("handles empty inputsArray", async () => {
    const result = await api.actions.fanOut("fanout:child", []);

    expect(result.enqueued).toBe(0);
    expect(result.errors).toHaveLength(0);

    const meta = await api.redis.redis.hgetall(
      `fanout:${result.fanOutId}`,
    );
    expect(meta.total).toBe("0");
  });

  test("large fan-outs with custom batchSize", async () => {
    const inputs = Array.from({ length: 25 }, (_, i) => ({
      itemId: String(i),
    }));
    const result = await api.actions.fanOut("fanout:child", inputs, undefined, {
      batchSize: 10,
    });

    expect(result.enqueued).toBe(25);
    expect(result.errors).toHaveLength(0);

    const jobs = await api.actions.queued("worker", 0, 100);
    expect(jobs.length).toBe(25);
  });

  test("custom resultTtl is applied to Redis keys", async () => {
    const inputs = [{ itemId: "1" }];
    const result = await api.actions.fanOut("fanout:child", inputs, undefined, {
      resultTtl: 30,
    });

    const ttl = await api.redis.redis.ttl(`fanout:${result.fanOutId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });
});

describe("fanOutStatus", () => {
  test("returns zeros for unknown fanOutId", async () => {
    const status = await api.actions.fanOutStatus("nonexistent-id");
    expect(status.total).toBe(0);
    expect(status.completed).toBe(0);
    expect(status.failed).toBe(0);
    expect(status.results).toHaveLength(0);
    expect(status.errors).toHaveLength(0);
  });

  test("returns correct totals after fan-out creation", async () => {
    const inputs = [{ itemId: "1" }, { itemId: "2" }];
    const result = await api.actions.fanOut("fanout:child", inputs);

    const status = await api.actions.fanOutStatus(result.fanOutId);
    expect(status.total).toBe(2);
    expect(status.completed).toBe(0);
    expect(status.failed).toBe(0);
  });
});

describe("enqueue queue-parameter fix", () => {
  test("explicit queue is respected", async () => {
    await api.actions.enqueue("fanout:child", { itemId: "1" }, "my-queue");
    const jobs = await api.actions.queued("my-queue");
    expect(jobs.length).toBe(1);
  });

  test("falls back to action's queue when no queue specified", async () => {
    await api.actions.enqueue("fanout:child", { itemId: "1" });
    const jobs = await api.actions.queued("worker");
    expect(jobs.length).toBe(1);
  });
});

describe("with workers", () => {
  afterEach(async () => {
    await api.resque.stopWorkers();
    await api.resque.stopScheduler();
  }, HOOK_TIMEOUT);

  test("fanned-out jobs are processed and results collected", async () => {
    const inputs = [{ itemId: "x" }, { itemId: "y" }, { itemId: "z" }];
    const result = await api.actions.fanOut("fanout:child", inputs);

    await api.resque.startWorkers();
    // Wait for workers to process jobs
    await Bun.sleep(2000);

    const status = await api.actions.fanOutStatus(result.fanOutId);
    expect(status.total).toBe(3);
    expect(status.completed).toBe(3);
    expect(status.failed).toBe(0);
    expect(status.results).toHaveLength(3);

    const processedIds = status.results.map((r) => r.result.processed).sort();
    expect(processedIds).toEqual(["x", "y", "z"]);
  });

  test("failed child jobs have errors collected", async () => {
    const inputs = [{ itemId: "fail-1" }, { itemId: "fail-2" }];
    const result = await api.actions.fanOut("fanout:failing-child", inputs);

    await api.resque.startWorkers();
    await Bun.sleep(2000);

    const status = await api.actions.fanOutStatus(result.fanOutId);
    expect(status.total).toBe(2);
    expect(status.completed).toBe(0);
    expect(status.failed).toBe(2);
    expect(status.errors).toHaveLength(2);

    for (const err of status.errors) {
      expect(err.error).toContain("failed processing");
    }
  });
});
