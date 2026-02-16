import { Glob } from "bun";
import path from "path";
import { api } from "../api";
import { ErrorType, TypedError } from "../classes/TypedError";

/**
 *
 * @param searchDir Absolute path or relative path (resolved from api.rootDir) to search for files
 */
export async function globLoader<T>(searchDir: string) {
  const results: T[] = [];
  const globs = [new Glob("**/*.{ts,tsx}")];
  const dir = path.isAbsolute(searchDir)
    ? searchDir
    : path.join(api.rootDir, searchDir);

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
