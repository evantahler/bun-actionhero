import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { SessionCreate } from "../../actions/session";
import type { UserCreate, UserEdit, UserView } from "../../actions/user";
import { api, logger, type ActionResponse } from "../../api";
import { config } from "../../config";
import "./../setup";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
});

afterAll(async () => {
  await api.stop();
});

describe("user:create", () => {
  test("user can be created", async () => {
    const res = await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mario Mario",
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const response = (await res.json()) as ActionResponse<UserCreate>;
    expect(res.status).toBe(200);

    expect(response.user.id).toEqual(1);
    expect(response.user.email).toEqual("mario@example.com");
  });

  test("email must be unique", async () => {
    const res = await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mario Mario",
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const response = (await res.json()) as ActionResponse<UserCreate>;
    expect(res.status).toBe(500);
    expect(response.error?.message.toLowerCase()).toMatch(
      /user already exists/,
    );
  });

  test("validation failures return the proper key", async () => {
    const res = await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "x",
        email: "y",
        password: "z",
      }),
    });
    const response = (await res.json()) as ActionResponse<UserCreate>;
    expect(res.status).toBe(406);
    expect(response.error?.message.toLowerCase()).toMatch(
      /this field is required and must be at least 3 characters long/,
    );
    expect(response.error?.key).toEqual("name");
    expect(response.error?.value).toEqual("x");
  });

  test("secret fields are redacted in logs", async () => {
    // Mock the logger to capture log messages
    const originalInfo = logger.info;
    const logMessages: string[] = [];
    logger.info = (message: string) => {
      logMessages.push(message);
    };

    try {
      const formData = new FormData();
      formData.append("name", "Test User");
      formData.append("email", "test@example.com");
      formData.append("password", "secretpassword123");

      const res = await fetch(url + "/api/user", {
        method: "PUT",
        body: formData,
      });

      // Find the log message that contains the action execution
      const actionLogMessage = logMessages.find(
        (msg) => msg.includes("[ACTION:") && msg.includes("user:create"),
      );

      expect(actionLogMessage).toBeDefined();
      expect(actionLogMessage).toContain('"name":"Test User"');
      expect(actionLogMessage).toContain('"email":"test@example.com"');
      expect(actionLogMessage).toContain('"password":"[[secret]]"');
      expect(actionLogMessage).not.toContain('"password":"secretpassword123"');
    } finally {
      // Restore original logger
      logger.info = originalInfo;
    }
  });
});

describe("user:edit", () => {
  test("it fails without a session", async () => {
    const res = await fetch(url + "/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "new name" }),
    });
    const response = (await res.json()) as ActionResponse<UserEdit>;
    expect(res.status).toBe(401);
    expect(response.error?.message).toMatch(/Session not found/);
  });

  test("the user can be updated", async () => {
    const sessionRes = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const sessionResponse =
      (await sessionRes.json()) as ActionResponse<SessionCreate>;
    expect(sessionRes.status).toBe(200);
    const sessionId = sessionResponse.session.id;

    const res = await fetch(url + "/api/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${config.session.cookieName}=${sessionId}`,
      },
      body: JSON.stringify({ name: "new name" }),
    });
    const response = (await res.json()) as ActionResponse<UserEdit>;
    expect(res.status).toBe(200);
    expect(response.user.name).toEqual("new name");
    expect(response.user.email).toEqual("mario@example.com");
    expect(sessionResponse.user.updatedAt).toBeLessThan(
      response.user.updatedAt,
    );
  });
});

describe("user:view", () => {
  test("it fails without a session", async () => {
    const res = await fetch(url + "/api/user/1", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const response = (await res.json()) as ActionResponse<UserView>;
    expect(res.status).toBe(401);
    expect(response.error?.message).toMatch(/Session not found/);
  });

  test("user can view themselves", async () => {
    // Create a user first
    await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Luigi Mario",
        email: "luigi@example.com",
        password: "mushroom1",
      }),
    });

    // Create a session
    const sessionRes = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "luigi@example.com",
        password: "mushroom1",
      }),
    });
    const sessionResponse =
      (await sessionRes.json()) as ActionResponse<SessionCreate>;
    expect(sessionRes.status).toBe(200);
    const sessionId = sessionResponse.session.id;
    const userId = sessionResponse.user.id;

    // View the user
    const res = await fetch(url + `/api/user/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${config.session.cookieName}=${sessionId}`,
      },
    });
    const response = (await res.json()) as ActionResponse<UserView>;
    expect(res.status).toBe(200);
    expect(response.user.id).toEqual(userId);
    expect(response.user.email).toEqual("luigi@example.com");
    expect(response.user.name).toEqual("Luigi Mario");
  });

  test("user cannot view another user", async () => {
    // Create two users
    await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Peach Toadstool",
        email: "peach@example.com",
        password: "mushroom1",
      }),
    });

    // Create a session for the first user
    const sessionRes = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "peach@example.com",
        password: "mushroom1",
      }),
    });
    const sessionResponse =
      (await sessionRes.json()) as ActionResponse<SessionCreate>;
    expect(sessionRes.status).toBe(200);
    const sessionId = sessionResponse.session.id;
    const userId = sessionResponse.user.id;

    // Try to view a different user (id 1, which should be Mario from earlier tests)
    const res = await fetch(url + "/api/user/1", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${config.session.cookieName}=${sessionId}`,
      },
    });
    const response = (await res.json()) as ActionResponse<UserView>;
    expect(res.status).toBe(500);
    expect(response.error?.message).toMatch(/You can only view yourself/);
  });

  test("fails with invalid id format", async () => {
    // Create a session
    const sessionRes = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "peach@example.com",
        password: "mushroom1",
      }),
    });
    const sessionResponse =
      (await sessionRes.json()) as ActionResponse<SessionCreate>;
    expect(sessionRes.status).toBe(200);
    const sessionId = sessionResponse.session.id;

    // Try to view with invalid id
    const res = await fetch(url + "/api/user/invalid", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${config.session.cookieName}=${sessionId}`,
      },
    });
    const response = (await res.json()) as ActionResponse<UserView>;
    expect(res.status).toBe(406);
    expect(response.error?.message).toMatch(/id must be a valid number/);
  });
});
