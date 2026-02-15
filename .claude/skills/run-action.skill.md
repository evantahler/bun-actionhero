---
name: run-action
description: Execute Keryx actions from the command line
when_to_use: |
  - User wants to test or run a Keryx action directly
  - User asks how to run actions from CLI
  - User needs to check server status or debug an action
  - User mentions running actions outside of HTTP/WebSocket
keywords: [keryx, cli, action, status, command-line]
---

# Run Keryx Action

Execute Keryx actions from the command line interface.

## Basic Usage

Actions can be run from the CLI using the `keryx.ts` script in the backend directory:

```bash
cd backend
./keryx.ts "actionName" [options] -q | jq
```

## Examples

### Check Server Status
```bash
./keryx.ts "status" -q | jq
```

This will return server information including:
- Server name
- Process ID
- Version
- Uptime
- Memory usage

## Options

- `-q`: Hide logging output
- `--help`: Show help information for the action
- `| jq`: Format the JSON response nicely (requires jq to be installed)

## Notes

- All actions can be run from the CLI
- The same input validation and responses are used as when running actions via HTTP or WebSocket
- Actions can also be scheduled as tasks if they have a `task` property
