export function monkeyPatchLogging() {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);

  // @ts-ignore
  process.stdout.write = (chunk, encoding, callback) => {
    // next.js writes to stdout, so we need to intercept that add our own logging instead (done in web.ts)
    if (
      typeof chunk === "string" &&
      chunk.startsWith(" GET ") &&
      (chunk.endsWith("ms\n") || chunk.endsWith("ms\r"))
    ) {
      return;
    }

    return originalStdoutWrite(chunk, encoding, callback);
  };
}
