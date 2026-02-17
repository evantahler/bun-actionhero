/** Base port that Conductor assigns workspace ranges from. */
export const CONDUCTOR_BASE_PORT = 55000;

/** Compute the workspace offset from CONDUCTOR_PORT. */
export function getWorkspaceOffset(conductorPort: number) {
  return Math.floor((conductorPort - CONDUCTOR_BASE_PORT) / 10);
}
