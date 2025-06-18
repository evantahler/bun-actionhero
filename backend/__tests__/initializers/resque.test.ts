import { Action, ActionParams, api } from "../../api";
import {
  test,
  expect,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
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
});

afterAll(async () => {
  await api.stop();
});

let ran: string | null = null;

class TestAction implements Action {
  name = "test_action";
  inputs = z.object({
    val: z.string().default("I ran"),
  });
  run = async (params: ActionParams<TestAction>) => {
    ran = params.val;
  };
}

beforeEach(async () => {
  await api.redis.redis.flushdb();
  ran = null;
  const instance = new TestAction();
  api.actions.actions.push(instance);
  api.resque.jobs[instance.name] = api.resque.wrapActionAsJob(instance);
});

test("actions can be enqueued", async () => {
  const enqueued = await api.actions.enqueue("test_action");
  expect(enqueued).toBe(true);
  const jobs = await api.actions.queued();
  expect(jobs.length).toBe(1);
  expect(jobs[0].class).toBe("test_action");
});

test("actions with the different args will only be enqueued", async () => {
  const enqueued_A = await api.actions.enqueue("test_action", { val: "I ran" });
  const enqueued_B = await api.actions.enqueue("test_action", {
    val: "other args",
  });
  const jobs = await api.actions.queued();
  expect(enqueued_A).toBe(true);
  expect(enqueued_B).toBe(true);
  expect(jobs.length).toBe(2);
  expect(jobs.map((j) => j.args[0].val)).toEqual(["I ran", "other args"]);
});

test("actions can be enqueued later", async () => {
  const enqueued = await api.actions.enqueueIn(5000, "test_action", {
    val: "test",
  });
  expect(enqueued).toBe(true);
  const jobs = await api.actions.queued();
  expect(jobs.length).toBe(0);
  const delayed = await api.actions.scheduledAt(DEFAULT_QUEUE, "test_action", {
    val: "test",
  });
  expect(delayed.length).toBe(1);
  expect(delayed[0]).toBeGreaterThan(Date.now() / 1000);
});

describe("with workers and scheduler", () => {
  afterEach(async () => {
    await api.resque.stopWorkers();
    await api.resque.stopScheduler();
  });

  test("actions will be worked by workers", async () => {
    await api.actions.enqueue("test_action", { val: "I ran" });
    await api.resque.startWorkers();
    expect(ran).toBeNull();
    await Bun.sleep(500);
    expect(ran).toBe("I ran");
  });

  test("delayed actions will be worked by workers", async () => {
    await api.actions.enqueueIn(1, "test_action", { val: "I ran" });
    await api.resque.startWorkers();
    await api.resque.startScheduler();
    expect(ran).toBeNull();
    await Bun.sleep(500);
    expect(ran).toBe("I ran");
  });

  test("recurring actions will be enqueued and worked", async () => {
    const runs: number[] = [];

    class RecurringTestAction implements Action {
      name = "recurring_test_action";
      task = { frequency: 100, queue: DEFAULT_QUEUE };
      inputs = {};
      run = async () => {
        runs.push(Date.now());
      };
    }
    const instance = new RecurringTestAction();
    api.resque.jobs[instance.name] = api.resque.wrapActionAsJob(instance);
    api.actions.actions.push(instance);

    await api.resque.startWorkers();
    await api.resque.startScheduler();
    await Bun.sleep(500);
    expect(runs.length).toBeGreaterThan(1);
  });
});
