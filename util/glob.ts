import path from "path";
import { Glob } from "bun";
import { api } from "../api";

/**
 *
 * @param searchDir From the root of the project, the directory to search for files
 */
export async function globLoader<T>(searchDir: string) {
  const results: T[] = [];
  const globs = [new Glob("**/*.ts"), new Glob("**/*.tsx")];
  const dir = path.join(api.rootDir, searchDir);

  for (const glob of globs) {
    for await (const file of glob.scan(dir)) {
      const fullPath = path.join(dir, file);
      const modules = (await import(fullPath)) as {
        [key: string]: new () => T;
      };
      for (const [name, klass] of Object.entries(modules)) {
        try {
          const instance = new klass();
          results.push(instance);
        } catch (error) {
          throw new Error(`Error loading from ${dir} -  ${name} - ${error}`);
        }
      }
    }
  }

  return results;
}
