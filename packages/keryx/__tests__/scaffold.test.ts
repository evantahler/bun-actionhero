import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { scaffoldProject } from "../util/scaffold";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "keryx-scaffold-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function targetDir(name: string) {
  return path.join(tmpDir, name);
}

describe("scaffoldProject", () => {
  test("creates all default files with db and example", async () => {
    const files = await scaffoldProject("test-app", targetDir("test-app"), {
      includeDb: true,
      includeExample: true,
    });

    expect(files).toContain("package.json");
    expect(files).toContain("index.ts");
    expect(files).toContain("keryx.ts");
    expect(files).toContain("tsconfig.json");
    expect(files).toContain(".env.example");
    expect(files).toContain(".gitignore");
    expect(files).toContain("initializers/.gitkeep");
    expect(files).toContain("middleware/.gitkeep");
    expect(files).toContain("channels/.gitkeep");
    expect(files).toContain("migrations.ts");
    expect(files).toContain("schema/.gitkeep");
    expect(files).toContain("drizzle/.gitkeep");
    expect(files).toContain("actions/hello.ts");

    // Verify files actually exist on disk
    for (const f of files) {
      expect(fs.existsSync(path.join(targetDir("test-app"), f))).toBe(true);
    }
  });

  test("package.json has correct name and keryx dependency", async () => {
    await scaffoldProject("my-project", targetDir("my-project"), {
      includeDb: true,
      includeExample: true,
    });

    const pkg = JSON.parse(
      fs.readFileSync(
        path.join(targetDir("my-project"), "package.json"),
        "utf-8",
      ),
    );
    expect(pkg.name).toBe("my-project");
    expect(pkg.dependencies.keryx).toMatch(/^\^/);
    expect(pkg.dependencies["drizzle-zod"]).toBeDefined();
    expect(pkg.devDependencies["drizzle-kit"]).toBeDefined();
  });

  test("skips db files when includeDb is false", async () => {
    const files = await scaffoldProject("no-db", targetDir("no-db"), {
      includeDb: false,
      includeExample: true,
    });

    expect(files).not.toContain("migrations.ts");
    expect(files).not.toContain("schema/.gitkeep");
    expect(files).not.toContain("drizzle/.gitkeep");
    expect(files).toContain("actions/hello.ts");

    const pkg = JSON.parse(
      fs.readFileSync(path.join(targetDir("no-db"), "package.json"), "utf-8"),
    );
    expect(pkg.dependencies["drizzle-zod"]).toBeUndefined();
    expect(pkg.devDependencies["drizzle-kit"]).toBeUndefined();
    expect(pkg.scripts.migrations).toBeUndefined();
  });

  test("skips example action when includeExample is false", async () => {
    const files = await scaffoldProject("no-example", targetDir("no-example"), {
      includeDb: true,
      includeExample: false,
    });

    expect(files).not.toContain("actions/hello.ts");
    expect(files).toContain("actions/.gitkeep");
  });

  test("index.ts sets rootDir", async () => {
    await scaffoldProject("check-index", targetDir("check-index"), {
      includeDb: false,
      includeExample: false,
    });

    const content = fs.readFileSync(
      path.join(targetDir("check-index"), "index.ts"),
      "utf-8",
    );
    expect(content).toContain("api.rootDir = import.meta.dir");
  });

  test(".env.example uses project name", async () => {
    await scaffoldProject("cool-api", targetDir("cool-api"), {
      includeDb: true,
      includeExample: false,
    });

    const content = fs.readFileSync(
      path.join(targetDir("cool-api"), ".env.example"),
      "utf-8",
    );
    expect(content).toContain("PROCESS_NAME=cool-api");
    expect(content).toContain("cool-api");
  });

  test("throws if directory already exists", async () => {
    const dir = targetDir("existing");
    fs.mkdirSync(dir, { recursive: true });

    expect(
      scaffoldProject("existing", dir, {
        includeDb: true,
        includeExample: true,
      }),
    ).rejects.toThrow('Directory "existing" already exists');
  });
});
