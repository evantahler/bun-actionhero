import { api, logger } from "../api";
import { Initializer } from "../classes/Initializer";
import path from "path";
import { Glob, type BuildConfig } from "bun";
import { watch, mkdirSync } from "fs";
import { unlink } from "node:fs/promises";

const namespace = "react";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<React["initialize"]>>;
  }
}

const transpiledPagesDirPrefix = ".transpiled-pages";
const transpiledPagesDir = path.join(
  api.rootDir,
  "assets",
  transpiledPagesDirPrefix,
);
const transpilerOptions = {
  target: "browser" as const,
  outdir: transpiledPagesDir,
  minify: true,
  splitting: true,
  sourcemap: "inline" as const,
} as BuildConfig;

export class React extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 800;
  }

  async initialize() {
    const pagesDir = path.join(api.rootDir, "pages");
    const componentsDir = path.join(api.rootDir, "components");
    const glob = new Glob("**/*.{jsx,tsx}");
    const pages: string[] = [];

    for await (const f of glob.scan(pagesDir)) {
      pages.push(path.join(pagesDir, f));
    }

    await transpileAllPages(pages);

    logger.info(
      `Transpiled ${pages.length} react pages to ${transpiledPagesDir}`,
    );

    const pagesDirWatcher = watch(pagesDir, async (event, filename) => {
      if (!filename) return;

      const fullFilename = path.join(pagesDir, filename);
      logger.trace(`Detected ${event} in ${fullFilename}`);

      await Bun.build({
        ...{ entrypoints: [fullFilename] },
        ...transpilerOptions,
      });
    });

    const componentsDirWatcher = watch(
      componentsDir,
      async (event, filename) => {
        if (!filename) return;

        const fullFilename = path.join(pagesDir, filename);
        logger.trace(`Detected ${event} in ${fullFilename}`);
        await transpileAllPages(pages); // TODO: this can certainly be optimized by walking the react trees...
      },
    );

    return {
      transpiledPagesDir,
      transpiledPagesDirPrefix,
      pagesDirWatcher,
      componentsDirWatcher,
    };
  }

  async stop() {
    if (api.react.pagesDirWatcher) api.react.pagesDirWatcher.close();
    if (api.react.componentsDirWatcher) api.react.componentsDirWatcher.close();
  }
}

const transpileAllPages = async (pages: string[]) => {
  const dir = Bun.file(transpiledPagesDir);
  if (!(await dir.exists())) mkdirSync(transpiledPagesDir, { recursive: true });

  const glob = new Glob("**/*.{js}");
  const existingTranspiledPages: string[] = [];
  for await (const f of glob.scan(transpiledPagesDir)) {
    existingTranspiledPages.push(path.join(transpiledPagesDir, f));
  }

  const result = await Bun.build({
    ...{ entrypoints: pages },
    ...transpilerOptions,
  });

  if (!result.success) {
    logger.fatal("Build failed");
    for (const message of result.logs) console.error(message);
  }

  result.outputs.forEach((output) => {
    const idx = existingTranspiledPages.indexOf(output.path);
    if (idx >= 0) existingTranspiledPages.splice(idx, 1);
  });

  for await (const f of existingTranspiledPages) {
    logger.debug(`Removing no-longer found transpiled artifact: ${f}`);
    await unlink(f);
  }
};
