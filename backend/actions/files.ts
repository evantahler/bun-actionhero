import { z } from "zod";
import { Action, ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";

export class FileUpload implements Action {
  name = "fileUpload";
  description = "A sample action that handles file uploads";
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
