import { $ } from "bun";
import { test, expect, describe, beforeAll, beforeEach } from "bun:test";
import pkg from "./../../package.json";
import { api } from "../../api";

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
  await api.stop();
});

describe("CLI", () => {
  test("help describes the CLI and actions", async () => {
    const { stdout, stderr, exitCode } =
      await $`./actionhero.ts --help`.quiet();

    expect(exitCode).toBe(0);
    expect(stderr).toBeEmpty();
    expect(stdout.toString()).toContain("Bun Actionhero");
    expect(stdout.toString()).toContain("status");
    expect(stdout.toString()).toContain("user:create");
  });

  test("no action is the same as help, but technically an error", async () => {
    const { stdout, stderr, exitCode } = await $`./actionhero.ts`
      .quiet()
      .nothrow();

    expect(exitCode).toBe(1);
    expect(stdout).toBeEmpty();
    expect(stderr.toString()).toContain("Bun Actionhero");
  });

  test('the version is returend with "--version"', async () => {
    const { stdout, stderr, exitCode } =
      await $`./actionhero.ts --version`.quiet();

    expect(exitCode).toBe(0);
    expect(stderr).toBeEmpty();
    expect(stdout.toString()).toContain(pkg.version);
  });

  test('actions with inputs can be described with "--help"', async () => {
    const { stdout, stderr, exitCode } =
      await $`./actionhero.ts "user:create" --help`.quiet();

    expect(exitCode).toBe(0);
    expect(stderr).toBeEmpty();

    expect(stdout.toString()).toContain("--name <value>");
    expect(stdout.toString()).toContain("The user's name");
    expect(stdout.toString()).toContain("--email <value>");
    expect(stdout.toString()).toContain("The user's email");
    expect(stdout.toString()).toContain("--password <value>");
    expect(stdout.toString()).toContain("The user's password");
  });

  test("create user and session via the CLI as integration test", async () => {
    const { stdout, stderr, exitCode } =
      await $`./actionhero.ts "user:create" --name test --email test@test.com --password test`.quiet();

    expect(exitCode).toBe(0);
    expect(stderr).toBeEmpty();

    const { response } = JSON.parse(stdout.toString());
    expect(response.user.id).toEqual(1);
    expect(response.user.email).toEqual("test@test.com");

    const {
      stdout: stdout2,
      stderr: stderr2,
      exitCode: exitCode2,
    } = await $`./actionhero.ts "session:create" --email test@test.com --password test`.quiet();

    expect(exitCode2).toBe(0);
    expect(stderr2).toBeEmpty();

    const { response: response2 } = JSON.parse(stdout2.toString());
    expect(response2.user.id).toEqual(1);
    expect(response2.user.email).toEqual("test@test.com");
    expect(response2.session.id).not.toBeNull();
  });

  describe("CLI errors", () => {
    test("action not found", async () => {
      const { stdout, stderr, exitCode } = await $`./actionhero.ts foo`
        .quiet()
        .nothrow();

      expect(exitCode).toBe(1);
      expect(stdout).toBeEmpty();
      expect(stderr.toString()).toContain("unknown command 'foo'");
    });

    test("action param missing", async () => {
      // missing password
      const { stdout, stderr, exitCode } =
        await $`./actionhero.ts "user:create" --name test --email test@test.com`
          .quiet()
          .nothrow();

      expect(exitCode).toBe(1);
      expect(stderr.toString()).toContain(
        "required option '--password <value>' not specified",
      );
      expect(stdout).toBeEmpty();
    });

    test("validation from within action", async () => {
      // password too short
      const { stdout, stderr, exitCode } =
        await $`./actionhero.ts "user:create" --name test --email test@test.com --password x`
          .quiet()
          .nothrow();

      expect(exitCode).toBe(1);
      expect(stdout).toBeEmpty();

      const { response } = JSON.parse(stderr.toString());
      expect(response).toEqual({});
    });
  });
});
