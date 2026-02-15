---
name: docker
description: Docker operations, containerization, and deployment
when_to_use: |
  - User wants to run the app in Docker
  - User asks about containerization or docker-compose
  - User needs to manage containers or view logs
  - User mentions deployment or production setup
  - User wants to access container shells or debug containers
keywords: [docker, docker-compose, container, deployment, production, logs]
---

# Docker Operations

Docker-related commands and configurations for the Keryx project.

## Development

### Build and Run
```bash
docker-compose up --build
```

### Stop Containers
```bash
docker-compose down
```

## Production

### Build Images
```bash
docker-compose -f docker-compose.prod.yml build
```

### Run Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Container Management

### View Logs
```bash
docker-compose logs -f
```

### Access Container Shell
```bash
docker-compose exec backend bash
```

## Database Operations

### Backup Database
```bash
docker-compose exec db pg_dump -U postgres bun > backup.sql
```

### Restore Database
```bash
docker-compose exec -T db psql -U postgres bun < backup.sql
```

## Best Practices
- Use environment variables for configuration
- Keep containers up to date
- Monitor resource usage
- Use proper networking
- Implement proper logging
