import { Glob } from "bun";
import path from "path";
import { ErrorType, TypedError } from "../classes/TypedError";

/**
 * Load and instantiate all exported classes from .ts/.tsx files in a directory.
 * @param dir Absolute path to the directory to scan
 */
export async function globLoader<T>(dir: string) {
  const results: T[] = [];
  const globs = [new Glob("**/*.{ts,tsx}")];

  for (const glob of globs) {
    for await (const file of glob.scan(dir)) {
      if (file.startsWith(".")) continue;

      const fullPath = path.join(dir, file);
      const modules = (await import(fullPath)) as {
        [key: string]: new () => T;
      };
      for (const [name, klass] of Object.entries(modules)) {
        try {
          const instance = new klass();
          results.push(instance);
        } catch (error) {
          throw new TypedError({
            message: `Error loading from ${dir} -  ${name} - ${error}`,
            type: ErrorType.SERVER_INITIALIZATION,
            originalError: error,
          });
        }
      }
    }
  }

  return results;
}
