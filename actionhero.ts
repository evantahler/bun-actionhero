#! /usr/bin/env bun

import pkg from "./package.json";
import { Action, api } from "./api";
import { Command } from "commander";
import { globLoader } from "./util/glob";
import { addActionToProgram } from "./util/cli";

const program = new Command();
program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command("start")
  .summary("Run the server")
  .description("Start the actionhero server")
  .action(async () => {
    await api.start();
  });

const actions = await globLoader<Action>("actions");
actions.forEach((action) => addActionToProgram(program, action));

program.parse();
