# General Rules

Core principles and general rules for the bun-actionhero project.

## Core Principles

**Be minimal, surgical, elegant, and correct.**

## Planning

Before writing code, always make a plan about how to best implement the feature. Then, follow the plan, checking off each step as complete before moving on to the next.

## Package Manager

We use `bun` for every command. We do not use npm, node.js, or yarn.

## Code Formatting

Always run `bun lint` after writing tests to format the code.

## Project Structure

This is a monorepo, with a top-level `package.json` to run things in development, and then 2 sub-projects for the `backend` and `frontend`.
