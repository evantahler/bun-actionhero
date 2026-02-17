#! /usr/bin/env bun

import { Command } from "commander";
import path from "path";
import { Action, api } from "./api";
import pkg from "./package.json";
import { addActionToProgram } from "./util/cli";
import { globLoader } from "./util/glob";
import {
  interactiveScaffold,
  scaffoldProject,
  type ScaffoldOptions,
} from "./util/scaffold";

const program = new Command();
program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command("new [project-name]")
  .summary("Create a new Keryx project")
  .description("Scaffold a new Keryx application with project boilerplate")
  .option("--no-interactive", "Skip prompts and use defaults")
  .option("--no-db", "Skip database setup files")
  .option("--no-example", "Skip example action")
  .action(async (projectName: string | undefined, opts) => {
    let options: ScaffoldOptions;

    if (opts.interactive === false) {
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
  .command("start")
  .summary("Run the server")
  .description("Start the Keryx server")
  .action(async () => {
    await api.start();
  });

// Load framework actions from the package directory
const frameworkActions = await globLoader<Action>(
  path.join(api.packageDir, "actions"),
);

// Load user project actions (if rootDir differs from packageDir)
let userActions: Action[] = [];
if (api.rootDir !== api.packageDir) {
  try {
    userActions = await globLoader<Action>(path.join(api.rootDir, "actions"));
  } catch {
    // user project may not have actions, that's fine
  }
}

const actions = [...frameworkActions, ...userActions];
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
