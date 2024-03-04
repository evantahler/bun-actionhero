export function loadFromEnvIfSet<T>(envString: string, defaultValue: T) {
  let val = defaultValue;
  let valFromEnv = Bun.env[envString];

  if (valFromEnv !== undefined) {
    val = (
      typeof defaultValue === "boolean"
        ? valFromEnv.trim().toUpperCase() === "TRUE"
        : typeof defaultValue === "number"
          ? valFromEnv.includes(".")
            ? parseFloat(valFromEnv)
            : parseInt(valFromEnv)
          : valFromEnv
    ) as T;
  }

  return val;
}
