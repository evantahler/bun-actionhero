import os from "node:os";
import { Action, api, Connection, RUN_MODE } from "./../api";
import { Command } from "commander";
import { TypedError } from "./../classes/TypedError";
import { ExitCode } from "./../classes/ExitCode";

export function addActionToProgram(program: Command, action: Action) {
  const command = program.command(action.name);
  command.summary(
    `Run action "${action.name}"${action.description ? ` (${action.description})` : ""}`,
  );
  command.description(
    `Run action "${action.name}"${action.description ? ` (${action.description})` : ""}

Inputs should be passed as options and will be formatted and validated per the action's definition.
The server will be initialized and started, except for initialized with the skipCLI flag (e.g. web server).`,
  );

  for (const [name, input] of Object.entries(action.inputs)) {
    if (input.required) {
      command.requiredOption(`--${name} <value>`, input.description);
    } else {
      command.option(`--${name} [value]`, input.description);
    }
  }

  command.option(
    "-q, --quiet",
    "disable all logging except for the action response.  You may also override the log level via environment variables",
    false,
  );

  command.action(runActionViaCLI);
}

async function runActionViaCLI(options: Record<string, string>, command: any) {
  const actionName: string = command.parent.args[0];
  if (options.quiet) api.logger.quiet = true;

  await api.initialize();

  const action = api.actions.actions.find((a) => a.name === actionName);
  if (!action) {
    exitWithError(`Action "${actionName}" not found`);
  }

  await api.start(RUN_MODE.CLI);

  const id = "cli:" + os.userInfo().username;
  const connection = new Connection("cli", id);
  const params = new FormData();
  for (const [key, value] of Object.entries(options)) {
    params.append(key, value);
  }

  const { response, error } = await connection.act(actionName, params);
  const payload: { response: any; error?: any } = { response };
  let exitCode = ExitCode.success;

  if (error) {
    exitCode = ExitCode.error;
    if (error instanceof TypedError) {
      payload.error = {
        message: error.message,
        stack: error.stack,
        type: error.type,
        key: error.key,
        value: error.value,
      };
    } else {
      payload.error = error;
    }
  }

  await api.signals.stop(
    "CLI_COMPLETE",
    exitCode,
    false,
    JSON.stringify(payload),
  );
}

function exitWithError(error: string | Error) {
  if (typeof error === "string") {
    error = new Error(error);
  }

  console.error(error.message);
  process.exit(1);
}
