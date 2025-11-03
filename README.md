# Chat App - Microservices

Scaffolded microservices:

- services/user
- services/email
- services/chat

Each service:

- TypeScript + Express
- Mongoose (MongoDB)
- Redis (ioredis)
- RabbitMQ (amqplib)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure (Docker)

```bash
# Start RabbitMQ and Redis
docker-compose up -d

# Check if services are running
docker-compose ps
```

### 3. Environment Setup

The .env files are already configured to work with the Docker setup:

- RabbitMQ: `amqp://admin:password@localhost:5672`
- Redis: `localhost:6379`
- MongoDB: Uses cloud MongoDB Atlas (update with your connection string)

### 4. Build Services

```bash
pnpm build
```

### 5. Start Services

```bash
# Development mode (all services)
pnpm dev

# Or start individual services
cd services/user && pnpm dev
cd services/chat && pnpm dev
cd services/email && pnpm dev
```

## Health Checks

Each service provides a health endpoint:

- User Service: http://localhost:3000/health
- Chat Service: http://localhost:3001/health (if different port)
- Email Service: http://localhost:3002/health (if different port)

## Docker Services

- **RabbitMQ Management**: http://localhost:15672 (admin/password)
- **Redis**: localhost:6379

## Features

- ✅ Robust RabbitMQ connection with retry logic
- ✅ Automatic reconnection on connection loss
- ✅ Health monitoring for all services
- ✅ Graceful degradation when services are unavailable
- ✅ Proper error handling and logging

## Notes

- Services will continue running even if RabbitMQ/Redis are unavailable (degraded mode)
- Connection retry logic with exponential backoff
- All message queues are durable and persistent
