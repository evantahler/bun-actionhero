import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

const keryxTs = path.join(import.meta.dir, "..", "keryx.ts");
let tmpDir: string;
let projectDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "keryx-cli-scaffold-"));

  const proc = Bun.spawn(
    ["bun", keryxTs, "new", "my-test-app", "--no-interactive"],
    {
      cwd: tmpDir,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`keryx new failed with exit code ${exitCode}: ${stderr}`);
  }

  projectDir = path.join(tmpDir, "my-test-app");
});

afterAll(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("keryx new (CLI integration)", () => {
  test("creates project directory", () => {
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.statSync(projectDir).isDirectory()).toBe(true);
  });

  const expectedFiles = [
    "package.json",
    "index.ts",
    "keryx.ts",
    "tsconfig.json",
    ".env.example",
    ".gitignore",
    "migrations.ts",
    "config/index.ts",
    "actions/hello.ts",
  ];

  for (const file of expectedFiles) {
    test(`creates ${file}`, () => {
      expect(fs.existsSync(path.join(projectDir, file))).toBe(true);
    });
  }

  test("package.json is valid JSON with correct name", () => {
    const raw = fs.readFileSync(path.join(projectDir, "package.json"), "utf-8");
    const pkg = JSON.parse(raw);
    expect(pkg.name).toBe("my-test-app");
    expect(pkg.dependencies.keryx).toMatch(/^\^/);
  });

  test("index.ts sets api.rootDir", () => {
    const content = fs.readFileSync(path.join(projectDir, "index.ts"), "utf-8");
    expect(content).toContain("api.rootDir = import.meta.dir");
  });

  test(".env.example contains expected vars", () => {
    const content = fs.readFileSync(
      path.join(projectDir, ".env.example"),
      "utf-8",
    );
    expect(content).toContain("WEB_SERVER_PORT=8080");
    expect(content).toContain("DATABASE_URL=");
    expect(content).toContain("REDIS_URL=");
    expect(content).toContain("PROCESS_NAME=my-test-app");
  });

  test("fails if directory already exists", async () => {
    const proc = Bun.spawn(
      ["bun", keryxTs, "new", "my-test-app", "--no-interactive"],
      {
        cwd: tmpDir,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const exitCode = await proc.exited;
    expect(exitCode).not.toBe(0);
  });
});
