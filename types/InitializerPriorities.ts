export const InitializerPriorities = [
  "loadPriority",
  "startPriority",
  "stopPriority",
] as const;

export type InitializerPriority = (typeof InitializerPriorities)[number];
