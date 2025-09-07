import { Command } from "commander";
import os from "node:os";
import { Action, api, Connection, RUN_MODE } from "../api";
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

    // Only process if it's a ZodObject with a shape property
    if (
      zodSchema._def &&
      zodSchema._def.typeName === "ZodObject" &&
      zodSchema.shape
    ) {
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

function isZodOptional(fieldSchema: any): boolean {
  if (!fieldSchema) return true;

  const typeName = fieldSchema._def?.typeName;
  if (typeName === "ZodOptional") return true;
  if (typeName === "ZodDefault") return true;

  return false;
}

function getZodDescription(fieldSchema: any): string | undefined {
  if (!fieldSchema) return undefined;

  // First try to get the explicit description
  const description = fieldSchema._def?.description;
  if (description) return description;

  // If no description, try to extract from error messages
  const typeName = fieldSchema._def?.typeName;

  // For string fields, try to get the error message from validators
  if (typeName === "ZodString") {
    const validators = fieldSchema._def?.checks;
    if (validators && validators.length > 0) {
      // Look for min/max length or email validators
      for (const validator of validators) {
        if (validator.kind === "min" && validator.message) {
          return validator.message;
        }
        if (validator.kind === "max" && validator.message) {
          return validator.message;
        }
        if (validator.kind === "email" && validator.message) {
          return validator.message;
        }
      }
    }
  }

  // Fallback to a generic description based on the field name
  return undefined;
}
