import { api } from "bun-actionhero";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { users, type User } from "../../schema/users";
import { isUser, zUserIdOrModel, zUserSchema } from "../../util/zodMixins";
import { HOOK_TIMEOUT } from "./../setup";

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

describe("zUserIdOrModel", () => {
  let testUser: User;

  beforeAll(async () => {
    // Create a test user
    const [user] = await api.db.db
      .insert(users)
      .values({
        name: "Test User",
        email: "zidormodel@example.com",
        password_hash: "hashedpassword",
      })
      .returning();
    testUser = user;
  });

  describe("ID resolution", () => {
    test("resolves numeric ID to full model", async () => {
      const schema = zUserIdOrModel();
      const result = await schema.parseAsync(testUser.id);

      expect(result.id).toBe(testUser.id);
      expect(result.name).toBe("Test User");
      expect(result.email).toBe("zidormodel@example.com");
    });

    test("resolves string ID to full model", async () => {
      const schema = zUserIdOrModel();
      const result = await schema.parseAsync(String(testUser.id));

      expect(result.id).toBe(testUser.id);
      expect(result.name).toBe("Test User");
    });

    test("throws error for non-existent ID", async () => {
      const schema = zUserIdOrModel();

      await expect(schema.parseAsync(99999)).rejects.toThrow(
        /User with id 99999 not found/,
      );
    });
  });

  describe("object passthrough", () => {
    test("passes through valid User object without database lookup", async () => {
      const schema = zUserIdOrModel();

      // Pass the full user object directly
      const result = await schema.parseAsync(testUser);

      // Zod parses and may create a new object, so use toEqual for deep equality
      expect(result).toEqual(testUser);
      expect(result.id).toBe(testUser.id);
      expect(result.name).toBe("Test User");
    });

    test("passes through User object even if it doesn't exist in database", async () => {
      const schema = zUserIdOrModel();

      // Create a fake user object that doesn't exist in the database
      const fakeUser: User = {
        id: 99999,
        name: "Fake User",
        email: "fake@example.com",
        password_hash: "fakehash",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should pass through without database lookup (Zod may create a new object)
      const result = await schema.parseAsync(fakeUser);

      expect(result).toEqual(fakeUser);
      expect(result.id).toBe(99999);
      expect(result.name).toBe("Fake User");
    });
  });

  describe("validation", () => {
    test("rejects invalid input (non-numeric string, non-object)", async () => {
      const schema = zUserIdOrModel();

      await expect(schema.parseAsync("invalid")).rejects.toThrow();
    });

    test("rejects negative numbers", async () => {
      const schema = zUserIdOrModel();

      await expect(schema.parseAsync(-1)).rejects.toThrow();
    });

    test("rejects zero", async () => {
      const schema = zUserIdOrModel();

      await expect(schema.parseAsync(0)).rejects.toThrow();
    });

    test("rejects incomplete object (missing required fields)", async () => {
      const schema = zUserIdOrModel();

      const incompleteUser = {
        id: 1,
        name: "Test",
        // missing email, password_hash, createdAt, updatedAt
      };

      await expect(schema.parseAsync(incompleteUser)).rejects.toThrow();
    });
  });
});

describe("isUser type guard", () => {
  test("returns true for valid User object", () => {
    const validUser: User = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      password_hash: "hashedpassword",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isUser(validUser)).toBe(true);
  });

  test("returns false for incomplete object", () => {
    const incompleteUser = {
      id: 1,
      name: "Test",
    };

    expect(isUser(incompleteUser)).toBe(false);
  });

  test("returns false for number", () => {
    expect(isUser(123)).toBe(false);
  });

  test("returns false for null", () => {
    expect(isUser(null)).toBe(false);
  });
});

describe("zUserSchema", () => {
  test("validates a complete User object", () => {
    const validUser: User = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      password_hash: "hashedpassword",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = zUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  test("rejects incomplete User object", () => {
    const incompleteUser = {
      id: 1,
      name: "Test",
    };

    const result = zUserSchema.safeParse(incompleteUser);
    expect(result.success).toBe(false);
  });
});
