import { $, sleep } from "bun";
import { EOL } from "os";

/**
Loads a value from the environment, if it's set, otherwise returns the default value.
ensureUnique will mutate this value to ensure it's unique, which is useful for test.
*/
export async function loadFromEnvIfSet<T>(
  envString: string,
  defaultValue: T,
  ensureUnique = false
) {
  let val = defaultValue;
  let valFromEnv = Bun.env[envString];
  let valFromEnvNodeEnv = Bun.env[`${envString}.${Bun.env.NODE_ENV}`];
  let testVal = valFromEnvNodeEnv || valFromEnv;

  if (testVal !== undefined) {
    val = (
      typeof defaultValue === "boolean"
        ? testVal.trim().toUpperCase() === "TRUE"
        : typeof defaultValue === "number"
          ? testVal.includes(".")
            ? parseFloat(testVal)
            : parseInt(testVal)
          : testVal
    ) as T;
  }

  if (ensureUnique) {
    if (!["string", "number"].includes(typeof val)) {
      throw new Error(
        "Only config values of number or string can be made unique."
      );
    }

    /*
    We want to slowly increment the port number until we find one that's available.
    We can't use the PID directly, as those are too large.
    Instead, we'll count instances of other `bun test` processes running.

    TODO: This will not work on windows.

    See https://github.com/oven-sh/bun/issues/9352 for a more ideal solution.
    */

    const pids = (await $`ps | grep -v grep | grep 'bun test'`.text())
      .split(EOL)
      .map((l) => l.split(" ")[0])
      .filter((l) => l.length > 0)
      .map(parseInt);

    if (typeof val === "number") {
      val = (val + pids.length) as T;
    } else if (typeof val === "string") {
      val = `${val}-${pids.length}` as T;
    }
  }

  return val;
}
