import { Command } from "commander";
import os from "node:os";
import { Action, api, Connection, RUN_MODE } from "../api";
import { config } from "../config";
import { ExitCode } from "./../classes/ExitCode";
import { TypedError } from "./../classes/TypedError";

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

  // Handle Zod schemas
  if (action.inputs && typeof action.inputs.parse === "function") {
    const zodSchema = action.inputs as any;

    // In Zod v4, object schemas have a .shape property
    if (zodSchema.shape && typeof zodSchema.shape === "object") {
      const shape = zodSchema.shape;

      for (const [name, fieldSchema] of Object.entries(shape)) {
        const isRequired = !isZodOptional(fieldSchema);
        const description =
          getZodDescription(fieldSchema) || `${name} parameter`;

        if (isRequired) {
          command.requiredOption(`--${name} <value>`, description);
        } else {
          command.option(`--${name} [value]`, description);
        }
      }
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
  if (options.quiet || config.server.cli.quiet) api.logger.quiet = true;

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
        type: error.type,
        key: error.key,
        value: error.value,
        ...(config.server.cli.includeStackInErrors
          ? { stack: error.stack }
          : {}),
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

function isZodOptional(fieldSchema: any): boolean {
  if (!fieldSchema) return true;

  // Zod v4 has .isOptional() method
  if (typeof fieldSchema.isOptional === "function") {
    return fieldSchema.isOptional();
  }

  // Fallback for Zod v4: check the type in _zod.def
  const type = fieldSchema._zod?.def?.type;
  if (type === "optional" || type === "default") return true;

  return false;
}

function getZodDescription(fieldSchema: any): string | undefined {
  if (!fieldSchema) return undefined;

  // Zod v4: description is directly on the schema
  if (fieldSchema.description) return fieldSchema.description;

  // Fallback: check _zod.def.description
  const description = fieldSchema._zod?.def?.description;
  if (description) return description;

  return undefined;
}
