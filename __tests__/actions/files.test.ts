import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { api, type ActionResponse } from "../../api";
import type { FileUpload } from "../../actions/files";
import { config } from "../../config";
import path from "path";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

describe("status", () => {
  test("the web server can handle a request to an action", async () => {
    const formData = new FormData();
    formData.append("stringParam", "test");
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "frontend",
      "public",
      "assets",
      "images",
      "actionhero.png",
    );

    const f = Bun.file(filePath);
    formData.append("file", f);
    const res = await fetch(url + "/api/file", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    const response = (await res.json()) as ActionResponse<FileUpload>;
    expect(response.params.stringParam).toBe("test");
    expect(response.params.file.name).toInclude("/actionhero.png");
    expect(response.params.file.type).toBe("image/png");
    expect(response.params.file.size).toBe(f.size);
  });
});
