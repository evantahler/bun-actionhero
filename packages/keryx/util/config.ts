/**
Deep-merges source into target, mutating target in place.
Only plain objects are recursively merged; arrays and primitives are overwritten.
*/
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>,
): T {
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];

    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === "object" &&
      typeof sourceVal === "object" &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      deepMerge(targetVal, sourceVal);
    } else {
      (target as any)[key] = sourceVal;
    }
  }

  return target;
}

/**
Loads a value from the environment, if it's set, otherwise returns the default value.
*/
export async function loadFromEnvIfSet<T>(envString: string, defaultValue: T) {
  let val = defaultValue;
  const valFromEnv = Bun.env[envString];
  const env = (Bun.env.NODE_ENV || "development").toUpperCase();
  const valFromEnvNodeEnv = Bun.env[`${envString}_${env}`];
  const testVal = valFromEnvNodeEnv || valFromEnv;

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
