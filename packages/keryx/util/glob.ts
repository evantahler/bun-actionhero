import { Glob } from "bun";
import path from "path";
import { api } from "../api";
import { ErrorType, TypedError } from "../classes/TypedError";

/**
 * Auto-discover and instantiate all exported classes from `.ts`/`.tsx` files in a directory.
 * Files prefixed with `.` are skipped. Used to load actions, initializers, and servers.
 *
 * @param searchDir - Absolute path or relative path (resolved from `api.rootDir`) to scan.
 * @returns Array of instantiated class instances of type `T`.
 * @throws {TypedError} With `ErrorType.SERVER_INITIALIZATION` if any class fails to instantiate.
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
      const modules = (await import(fullPath)) as Record<string, unknown>;

      // Object.entries() can throw ReferenceError if an export is still in
      // TDZ (temporal dead zone) due to circular imports. Fall back to
      // per-key access so one TDZ export doesn't block the entire module.
      let entries: [string, unknown][];
      try {
        entries = Object.entries(modules);
      } catch {
        const keys = Object.getOwnPropertyNames(modules);
        entries = [];
        for (const key of keys) {
          try {
            entries.push([key, modules[key]]);
          } catch {
            // Skip TDZ exports — they'll be loaded by their own initializer
          }
        }
      }

      for (const [name, klass] of entries) {
        // Skip non-class exports (constants, functions, type remnants)
        if (typeof klass !== "function" || klass.prototype === undefined) {
          continue;
        }

        try {
          const instance = new (klass as new () => T)();
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
