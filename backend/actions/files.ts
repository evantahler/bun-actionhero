import { Action, ActionParams, type Inputs } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { ensureFile, ensureString } from "../util/formatters";

export class FileUpload implements Action {
  name = "fileUpload";
  description = "A sample action that handles file uploads";
  web = { route: "/file", method: HTTP_METHOD.POST };
  inputs = {
    file: {
      required: true,
      description: "The file to upload",
      formatter: ensureFile,
    },
    stringParam: {
      required: true,
      description: "A string parameter",
      formatter: ensureString,
    },
  };

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
