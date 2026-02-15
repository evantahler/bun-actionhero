import { z } from "zod";
import { Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { RateLimitMiddleware } from "../middleware/rateLimit";

export class FileUpload implements Action {
  name = "fileUpload";
  description =
    "Upload a file along with a string parameter. Returns metadata about the uploaded file (name, MIME type, size in bytes) and the string parameter. Does not require authentication.";
  middleware = [RateLimitMiddleware];
  web = { route: "/file", method: HTTP_METHOD.POST };
  inputs = z.object({
    file: z.instanceof(File, { message: "File is required" }),
    stringParam: z.string().min(1, "String parameter is required"),
  });

  async run(params: ActionParams<FileUpload>) {
    return {
      params: {
        stringParam: params.stringParam,
        file: {
          name: params.file.name,
          type: params.file.type,
          size: params.file.size,
        },
      },
    };
  }
}
