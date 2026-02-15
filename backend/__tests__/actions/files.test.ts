import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "path";
import type { FileUpload } from "../../actions/files";
import { api, type ActionResponse } from "../../api";
import { HOOK_TIMEOUT, serverUrl } from "./../setup";

let url: string;

beforeAll(async () => {
  await api.start();
  url = serverUrl();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

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
