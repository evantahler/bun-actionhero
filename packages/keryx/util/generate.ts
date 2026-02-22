import fs from "fs";
import Mustache from "mustache";
import path from "path";

const VALID_TYPES = [
  "action",
  "initializer",
  "middleware",
  "channel",
  "ops",
] as const;
type GeneratorType = (typeof VALID_TYPES)[number];

export interface GenerateOptions {
  dryRun?: boolean;
  force?: boolean;
  noTest?: boolean;
}

const templatesDir = path.join(import.meta.dir, "..", "templates", "generate");

async function loadTemplate(name: string): Promise<string> {
  return Bun.file(path.join(templatesDir, name)).text();
}

/**
 * Convert a colon-separated name to PascalCase class name.
 * e.g. "user:delete" → "UserDelete", "hello" → "Hello"
 */
function toClassName(name: string): string {
  return name
    .split(":")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

/**
 * Determine the directory and filename for a component type + name.
 * Actions with colons get nested: "user:delete" → "actions/user/delete.ts"
 * Others are flat: "cache" → "initializers/cache.ts"
 */
function resolveFilePath(type: GeneratorType, name: string): string {
  const dirMap: Record<GeneratorType, string> = {
    action: "actions",
    initializer: "initializers",
    middleware: "middleware",
    channel: "channels",
    ops: "ops",
  };

  const baseDir = dirMap[type];
  const segments = name.split(":");

  if (segments.length > 1) {
    // "user:delete" → "actions/user/delete.ts"
    const fileName = segments.pop()!;
    return path.join(baseDir, ...segments, `${fileName}.ts`);
  }

  return path.join(baseDir, `${name}.ts`);
}

/**
 * Determine the test file path for a component.
 * "user:delete" action → "__tests__/actions/user/delete.test.ts"
 */
function resolveTestPath(type: GeneratorType, name: string): string {
  const componentPath = resolveFilePath(type, name);
  const parsed = path.parse(componentPath);
  return path.join("__tests__", parsed.dir, `${parsed.name}.test.ts`);
}

/**
 * Derive the web route from an action name.
 * "hello" → "/api/hello", "user:delete" → "/api/user/delete"
 */
function toRoute(name: string): string {
  return "/api/" + name.replace(/:/g, "/");
}

/**
 * Generate a component file (and optionally a test file).
 * @param type The component type to generate
 * @param name The component name (e.g., "user:delete", "cache")
 * @param rootDir The project root directory
 * @param options Generation options (dry-run, force, no-test)
 * @returns List of created (or would-be-created) file paths
 */
export async function generateComponent(
  type: string,
  name: string,
  rootDir: string,
  options: GenerateOptions = {},
): Promise<string[]> {
  if (!VALID_TYPES.includes(type as GeneratorType)) {
    throw new Error(
      `Unknown generator type "${type}". Valid types: ${VALID_TYPES.join(", ")}`,
    );
  }

  const generatorType = type as GeneratorType;
  const filePath = resolveFilePath(generatorType, name);
  const fullPath = path.join(rootDir, filePath);
  const createdFiles: string[] = [];

  // Check for conflicts
  if (!options.force && fs.existsSync(fullPath)) {
    throw new Error(
      `File already exists: ${filePath}. Use --force to overwrite.`,
    );
  }

  // Build template view
  let className = toClassName(name);
  if (generatorType === "middleware") className += "Middleware";
  if (generatorType === "channel") className += "Channel";

  const view: Record<string, string> = { name, className };
  if (generatorType === "action") {
    view.route = toRoute(name);
  }

  // Determine template
  const templateMap: Record<GeneratorType, string> = {
    action: "action.ts.mustache",
    initializer: "initializer.ts.mustache",
    middleware: "action-middleware.ts.mustache",
    channel: "channel.ts.mustache",
    ops: "ops.ts.mustache",
  };

  const template = await loadTemplate(templateMap[generatorType]);
  const content = Mustache.render(template, view);

  if (options.dryRun) {
    console.log(`Would create: ${filePath}`);
    console.log("---");
    console.log(content);
    createdFiles.push(filePath);
  } else {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, content);
    createdFiles.push(filePath);
  }

  // Generate test file
  if (!options.noTest) {
    const testPath = resolveTestPath(generatorType, name);
    const testFullPath = path.join(rootDir, testPath);

    if (!options.force && fs.existsSync(testFullPath)) {
      // Silently skip test file if it already exists
    } else {
      const testTemplate = await loadTemplate("test.ts.mustache");
      const testContent = Mustache.render(testTemplate, view);

      if (options.dryRun) {
        console.log(`Would create: ${testPath}`);
        createdFiles.push(testPath);
      } else {
        fs.mkdirSync(path.dirname(testFullPath), { recursive: true });
        await Bun.write(testFullPath, testContent);
        createdFiles.push(testPath);
      }
    }
  }

  return createdFiles;
}
