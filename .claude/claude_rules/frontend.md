# Frontend Development

Next.js frontend application rules and guidelines.

## Type Definitions

Always load the type definitions from the Actions in the backend. Do not write your own types.

### Form Input Types

For form inputs, use the type from the backend action. For example, if the backend action is `SessionCreate`, the input type is `SessionCreate["inputs"]["_type"]`.

```typescript
type SigninFormData = SessionCreate["inputs"]["_type"];
```

### API Response Types

For API responses, use the type from the backend action. For example, if the backend action is `SessionCreate`, the response type is `ActionResponse<SessionCreate>`.

```typescript
type SigninResponse = ActionResponse<SessionCreate>;
```

## API Calls

When making API calls, use the APIWrapper class. For example, if the backend action is `SessionCreate`, the API call is `APIWrapper.post<SessionCreate>(SessionCreate)`.

## Styling

We write SCSS files for styling, not CSS.

## Development

### Start Frontend

```bash
cd frontend
bun dev
```

### Build for Production

```bash
cd frontend
bun build
```

## Project Structure

- Follows Next.js 13+ app directory structure
- API routes in `app/api/`
- Pages in `app/`
- Components in `components/`
- Styles in `styles/`

## Environment Variables

- Copy `.env.example` to `.env`
- Configure API endpoints and other settings

## API Integration

- Backend API is available at configured endpoint
- Use TypeScript types for API responses
- Handle errors appropriately

## Best Practices

- Use TypeScript for type safety
- Follow Next.js conventions
- Implement proper error handling
- Use proper loading states
- Optimize for performance
