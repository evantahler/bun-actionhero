---
name: development-workflow
description: Common development tasks and workflows
when_to_use: |
  - User is getting started with the project
  - User asks how to start development servers
  - User needs help with common development tasks
  - User wants to create new actions or features
  - User asks about debugging or hot reloading
keywords: [development, workflow, getting-started, dev-server, debugging, hot-reload]
---

# Development Workflow

Common development tasks and workflows for the Keryx project.

## Starting Development

1. Install dependencies:
```bash
bun install
```

2. Set up environment:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start development servers:
```bash
bun dev
```

## Common Tasks

### Creating New Actions
1. Create new action in `backend/actions/`
2. Define input validation
3. Add web route if needed
4. Add task configuration if needed

### Running Single Test
```bash
cd backend
bun test path/to/test/file
```

### Debugging
- Use `console.log()` for quick debugging
- Add breakpoints in your IDE
- Check server logs in terminal

### Hot Reloading
- Both frontend and backend support hot reloading
- Changes to actions, middleware, and frontend code will automatically reload

## Best Practices
- Write tests for new actions
- Use TypeScript types
- Follow existing patterns in the codebase
- Document new features
