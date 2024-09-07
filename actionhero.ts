#! /usr/bin/env bun

import { Command } from "commander";
import { api, Connection, RUN_MODE } from "./api";
import pkg from "./package.json";

const program = new Command();
program.name(pkg.name).description(pkg.description).version(pkg.version);

enum OUTPUT_TYPES {
  JSON = "json",
  TEXT = "text",
}

program
  .command("start")
  .summary("Run the server")
  .description("Start the actionhero server")
  .action(async () => {
    await api.start();
  });

program
  .command("action")
  .summary("Call an action from the command line")
  .description(
    "Call an action from the command line.  Inputs should be passed as options and will be formatted and validated per the action's definition.  The server will be initialized and started, except for initialized with the skipCLI flag (e.g. web server).",
  )
  .argument("<action-name>", "name of the action to run")
  .option("-i", "--inputs [inputs...]", "inputs to the action")
  .option(
    "-o, --output-type <type>",
    "return type of the action response",
    OUTPUT_TYPES.JSON,
  )
  .option(
    "-q, --quiet",
    "disable all logging except for the action response.  You may also override the log level via environment variables",
    false,
  )
  .action(async (actionName, options) => {
    if (options.quiet) api.logger.quiet = true;

    await api.initialize();

    const action = api.actions.actions.find((a) => a.name === actionName);
    if (!action) {
      exitWithError(`Action "${actionName}" not found`);
    }

    await api.start(RUN_MODE.CLI);

    const connection = new Connection("cli", new Date().getTime().toString());
    const params = new FormData(); // TODO
    const { response, error } = await connection.act(actionName, params);
    const payload: { response: any; error?: any } = { response };
    if (error) payload.error = error;

    await api.signals.stop("CLI_COMPLETE", false, JSON.stringify(payload));
  });

program.parse();

function exitWithError(error: string | Error) {
  if (typeof error === "string") {
    error = new Error(error);
  }

  console.error(error.message);
  process.exit(1);
}
