import { Glob } from "bun";
import fs from "fs";
import Mustache from "mustache";
import path from "path";
import * as readline from "readline";
import pkg from "../package.json";

export interface ScaffoldOptions {
  includeDb: boolean;
  includeExample: boolean;
}

const templatesDir = path.join(import.meta.dir, "..", "templates", "scaffold");

async function loadTemplate(name: string): Promise<string> {
  return Bun.file(path.join(templatesDir, name)).text();
}

async function prompt(question: string, defaultValue: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function promptYesNo(
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await prompt(`${question} (${hint})`, defaultYes ? "y" : "n");
  return answer.toLowerCase().startsWith("y");
}

export async function interactiveScaffold(
  projectName?: string,
): Promise<{ projectName: string; options: ScaffoldOptions }> {
  if (!projectName) {
    projectName = await prompt("Project name:", "my-keryx-app");
  }

  const includeDb = await promptYesNo("Include database setup?", true);
  const includeExample = await promptYesNo("Include example action?", true);

  return { projectName, options: { includeDb, includeExample } };
}

export async function scaffoldProject(
  projectName: string,
  targetDir: string,
  options: ScaffoldOptions,
): Promise<string[]> {
  const keryxVersion = pkg.version;
  const createdFiles: string[] = [];

  if (fs.existsSync(targetDir)) {
    throw new Error(`Directory "${projectName}" already exists`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const view = { projectName, keryxVersion };

  const write = async (filePath: string, content: string) => {
    const fullPath = path.join(targetDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, content);
    createdFiles.push(filePath);
  };

  const writeTemplate = async (filePath: string, templateName: string) => {
    const template = await loadTemplate(templateName);
    await write(filePath, Mustache.render(template, view));
  };

  // --- Always generated ---

  // package.json is built programmatically (conditional deps/scripts)
  await write(
    "package.json",
    JSON.stringify(
      {
        name: projectName,
        version: "0.0.1",
        module: "index.ts",
        type: "module",
        private: true,
        license: "MIT",
        bin: { keryx: "keryx.ts" },
        scripts: {
          start: "bun keryx.ts start",
          dev: "bun --watch keryx.ts start",
          ...(options.includeDb ? { migrations: "bun run migrations.ts" } : {}),
          lint: "tsc && prettier --check .",
          format: "tsc && prettier --write .",
        },
        dependencies: {
          keryx: `^${keryxVersion}`,
          ...(options.includeDb ? { "drizzle-zod": "^0.8.3" } : {}),
        },
        devDependencies: {
          "@types/bun": "latest",
          prettier: "^3.8.1",
          ...(options.includeDb ? { "drizzle-kit": "^0.20.18" } : {}),
        },
      },
      null,
      2,
    ) + "\n",
  );

  // tsconfig.json is static JSON (no interpolation needed)
  await write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          lib: ["ESNext"],
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          types: ["bun-types"],
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          isolatedModules: true,
          verbatimModuleSyntax: true,
          noImplicitAny: true,
          noImplicitReturns: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          forceConsistentCasingInFileNames: true,
          allowImportingTsExtensions: true,
        },
        include: ["**/*.ts"],
        exclude: ["node_modules", "drizzle"],
      },
      null,
      2,
    ) + "\n",
  );

  await writeTemplate("index.ts", "index.ts.mustache");
  await writeTemplate("keryx.ts", "keryx.ts.mustache");
  await writeTemplate(".env.example", "env.example.mustache");
  await writeTemplate(".gitignore", "gitignore.mustache");
  // Copy config files from the framework, adjusting imports for user projects
  const configDir = path.join(import.meta.dir, "..", "config");
  const glob = new Glob("**/*.ts");
  for await (const file of glob.scan(configDir)) {
    let content = await Bun.file(path.join(configDir, file)).text();

    // Rewrite relative imports to package imports
    content = content.replace(
      /from ["']\.\.\/\.\.\/util\/config["']/g,
      'from "keryx"',
    );
    content = content.replace(
      /from ["']\.\.\/util\/config["']/g,
      'from "keryx"',
    );
    content = content.replace(
      /from ["']\.\.\/classes\/Logger["']/g,
      'from "keryx/classes/Logger.ts"',
    );

    // In index.ts, change `export const config` to `export default`
    // and remove the KeryxConfig type export (it comes from the package)
    if (file === "index.ts") {
      content = content.replace("export const config =", "export default");
      content = content.replace(
        /\nexport type KeryxConfig = typeof config;\n/,
        "\n",
      );
    }

    await write(`config/${file}`, content);
  }

  // Create empty directories with .gitkeep
  await write("initializers/.gitkeep", "");
  await write("middleware/.gitkeep", "");
  await write("channels/.gitkeep", "");

  // --- Database setup ---

  if (options.includeDb) {
    await writeTemplate("migrations.ts", "migrations.ts.mustache");
    await write("schema/.gitkeep", "");
    await write("drizzle/.gitkeep", "");
  }

  // --- Built-in actions (always included) ---
  // Copy status and swagger actions from the framework, adjusting imports
  const builtinActions = ["status.ts", "swagger.ts"];
  const actionsDir = path.join(import.meta.dir, "..", "actions");
  for (const file of builtinActions) {
    let content = await Bun.file(path.join(actionsDir, file)).text();

    // Rewrite relative imports to package imports
    content = content.replace(/from ["']\.\.\/api["']/g, 'from "keryx"');
    content = content.replace(
      /from ["']\.\.\/classes\/Action["']/g,
      'from "keryx/classes/Action.ts"',
    );
    content = content.replace(
      /from ["']\.\.\/package\.json["']/g,
      'from "../package.json"',
    );

    await write(`actions/${file}`, content);
  }

  // --- Example action ---

  if (options.includeExample) {
    await writeTemplate("actions/hello.ts", "hello-action.ts.mustache");
  }

  return createdFiles;
}
