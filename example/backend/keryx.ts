#! /usr/bin/env bun

// Set rootDir before any framework code loads actions
import "./index";

import { buildProgram } from "keryx";
import pkg from "./package.json";

const program = await buildProgram({
  name: pkg.name,
  description: pkg.description,
  version: pkg.version,
});

program.parse();
