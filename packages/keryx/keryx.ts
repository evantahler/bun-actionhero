#! /usr/bin/env bun

import { Command } from "commander";
import path from "path";
import { Action, api } from "./api";
import pkg from "./package.json";
import { addActionToProgram } from "./util/cli";
import { generateComponent } from "./util/generate";
import { globLoader } from "./util/glob";
import {
  interactiveScaffold,
  scaffoldProject,
  type ScaffoldOptions,
} from "./util/scaffold";
import { upgradeProject } from "./util/upgrade";

const program = new Command();
program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command("new [project-name]")
  .summary("Create a new Keryx project")
  .description("Scaffold a new Keryx application with project boilerplate")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("--no-interactive", "Skip prompts and use defaults")
  .option("--no-db", "Skip database setup files")
  .option("--no-example", "Skip example action")
  .action(async (projectName: string | undefined, opts) => {
    let options: ScaffoldOptions;

    if (opts.yes || opts.interactive === false) {
      // --no-interactive: use defaults
      projectName = projectName || "my-keryx-app";
      options = {
        includeDb: opts.db !== false,
        includeExample: opts.example !== false,
      };
    } else {
      const result = await interactiveScaffold(projectName);
      projectName = result.projectName;
      options = result.options;
    }

    const targetDir = path.resolve(process.cwd(), projectName);

    console.log(`\nCreating new Keryx project: ${projectName}\n`);

    const files = await scaffoldProject(projectName, targetDir, options);
    files.forEach((f) => console.log(`  ${f}`));

    console.log(`
Done! To get started:

  cd ${projectName}
  cp .env.example .env
  bun install
  bun dev
`);
    process.exit(0);
  });

program
  .command("upgrade")
  .summary("Update framework-owned files to match the installed keryx version")
  .option("--dry-run", "Show what would change without writing files")
  .option("--force", "Overwrite all framework files without confirmation")
  .option("-y, --yes", "Overwrite all framework files without confirmation")
  .action(async (opts) => {
    try {
      await upgradeProject(process.cwd(), {
        dryRun: opts.dryRun || false,
        force: opts.force || opts.yes || false,
      });
      process.exit(0);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command("generate <type> <name>")
  .alias("g")
  .summary("Generate a new component")
  .description(
    "Scaffold a new action, initializer, middleware, channel, or ops file.\n\n" +
      "Examples:\n" +
      "  keryx generate action user:delete\n" +
      "  keryx generate initializer cache\n" +
      "  keryx generate middleware auth\n" +
      "  keryx generate channel notifications\n" +
      "  keryx generate ops UserOps\n" +
      "  keryx g action hello",
  )
  .option("--dry-run", "Show what would be generated without writing files")
  .option("--force", "Overwrite existing files")
  .option("--no-test", "Skip generating a test file")
  .action(
    async (
      type: string,
      name: string,
      opts: { dryRun?: boolean; force?: boolean; test?: boolean },
    ) => {
      try {
        const rootDir = process.cwd();
        const files = await generateComponent(type, name, rootDir, {
          dryRun: opts.dryRun,
          force: opts.force,
          noTest: opts.test === false,
        });

        if (!opts.dryRun) {
          console.log("\nGenerated:");
          files.forEach((f) => console.log(`  ${f}`));
          console.log();
        }

        process.exit(0);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    },
  );

program
  .command("start")
  .summary("Run the server")
  .description("Start the Keryx server")
  .action(async () => {
    await api.start();
  });

// Load actions from the project directory
let actions: Action[] = [];
try {
  actions = await globLoader<Action>(path.join(api.rootDir, "actions"));
} catch {
  // project may not have actions yet
}
actions.forEach((action) => addActionToProgram(program, action));

program
  .command("actions")
  .summary("List all actions")
  .action(async () => {
    const actionSpacing =
      actions.map((a) => a.name.length).reduce((a, b) => Math.max(a, b), 0) + 2;
    const routeSpacing =
      actions
        .map((a) =>
          a.web ? a.web.route.toString().length + a.web.method.length : 0,
        )
        .reduce((a, b) => Math.max(a, b), 0) + 2;

    actions
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((action) => {
        console.log(
          `${action.name}${" ".repeat(actionSpacing - action.name.length)} ${action.web ? `[${action.web.method}] ${action.web.route}` : " "}${" ".repeat(routeSpacing - (action.web ? action.web.method.length + action.web.route.toString().length + 2 : 0))} ${action.description ?? ""}`,
        );
      });
  });

program.parse();
