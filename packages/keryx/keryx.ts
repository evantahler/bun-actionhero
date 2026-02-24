#! /usr/bin/env bun

import pkg from "./package.json";
import { buildProgram } from "./util/cli";

const program = await buildProgram({
  name: pkg.name,
  description: pkg.description,
  version: pkg.version,
});

program.parse();
