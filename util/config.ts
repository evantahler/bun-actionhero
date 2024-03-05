export function loadFromEnvIfSet<T>(envString: string, defaultValue: T) {
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

  return val;
}
