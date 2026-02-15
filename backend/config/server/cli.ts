import { loadFromEnvIfSet } from "../../util/config";

export const configServerCli = {
  includeStackInErrors: await loadFromEnvIfSet(
    "CLI_INCLUDE_STACK_IN_ERRORS",
    true,
  ),
  quiet: await loadFromEnvIfSet("CLI_QUIET", false),
};
