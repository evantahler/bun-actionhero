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
