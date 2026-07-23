# Micro-Service Project

A microservice architecture application with API Gateway, multiple backend services, and a React frontend.

## Prerequisites

- Docker & Docker Compose
- Bun (for TypeScript services)
- uv (for Python services)

## Quick Start

### Development

```bash
# Start the entire stack in development mode
make dev

# Seed the databases with demo data
make seed

# Access the services:
# - UI: http://localhost:5173
# - Gateway API: http://localhost:3000
# - Gateway Swagger: http://localhost:3000/api
```

### Production

```bash
# Deploy to Docker Swarm
make deploy

# Stop production stack
make stop-prod
```

## Project Structure

```
.
├── api/
│   ├── gateway/          # NestJS API Gateway (BFF)
│   ├── proto/            # Protocol Buffer definitions
│   ├── scripts/          # Helper scripts (proto-gen.sh)
│   └── services/         # Microservices
│       ├── auth/         # Auth service (TypeScript/Bun)
│       ├── student/      # Student service (Python/FastAPI)
│       ├── payment/      # Payment service (Python/FastAPI)
│       └── notification/ # Notification service (Python/FastAPI)
├── ui/                   # React + Vite frontend
├── e2e/                  # Playwright E2E tests
├── docker-compose.yml    # Development Docker Compose
└── README.md             # This file
```

## Creating a New Service

### 1. Define Protocol Buffers (Proto Files)

Create your service definition in `api/proto/` (e.g., `api/proto/myservice.proto`):

```proto
syntax = "proto3";

package myservice.v1;

service MyService {
  rpc MyMethod(MyRequest) returns (MyResponse);
}

message MyRequest {
  string field = 1;
}

message MyResponse {
  string result = 1;
}
```

### 2. Generate Code from Protos

Run the proto generation script:

```bash
make proto-gen
```

This generates TypeScript and Python code in:

- `api/gateway/src/proto_gen/` (for Gateway)
- Each service's `proto_gen/` directory

### 3. Create Your Service

#### Option A: TypeScript/Bun Service (like auth)

- Copy `api/services/auth/` as a template
- Update `package.json`
- Implement your service using ConnectRPC
- Add service to `docker-compose.yml`
- Update Gateway to connect to your new service

#### Option B: Python/FastAPI Service (like student/payment)

- Copy `api/services/student/` or `api/services/payment/` as a template
- Update `pyproject.toml`
- Implement your service using FastAPI + ConnectRPC
- Add service to `docker-compose.yml`
- Update Gateway to connect to your new service

### 4. Environment Configuration

Each service has a `.env` file (see existing services for examples).

### 5. Update Gateway

- Add a controller module in `api/gateway/src/` (like `student/` or `payment/`)
- Update `app.module.ts` to include your new module
- Update environment variables in `docker-compose.yml` to point to your new service

## Makefile Commands

| Command          | Description                         |
| ---------------- | ----------------------------------- |
| `make help`      | Show all available commands         |
| `make proto-gen` | Generate protobuf code              |
| `make build-all` | Build all Docker images             |
| `make seed`      | Seed databases with demo data       |
| `make dev`       | Start development stack             |
| `make stop-dev`  | Stop development stack              |
| `make deploy`    | Deploy to Docker Swarm (production) |
| `make stop-prod` | Stop production stack               |
| `make clean`     | Remove build artifacts              |
| `make test`      | Run all unit/integration tests      |
| `make e2e-test`  | Run Playwright E2E tests            |
| `make load-test` | Run k6 load tests                   |

## Testing

### Running Tests

#### All Tests (Unit + Integration)

```bash
make test
```

#### Individual Services

##### Auth Service

```bash
cd api/services/auth && bun test
```

##### Gateway Service

```bash
cd api/gateway && bun test
```

##### Student Service

```bash
cd api/services/student && uv run pytest tests/ -v
```

#### E2E Tests (Playwright)

End-to-end tests simulate real user interactions in a browser.
First, start the development stack:

```bash
make dev
```

Then run E2E tests:

```bash
make e2e-test
```

To run E2E tests in headed mode (visible browser for debugging):

```bash
cd e2e && bun playwright test --headed
```

### Types of Tests

- **Unit Tests**: Test individual functions and components in isolation.
- **Integration Tests**: Test interactions between multiple components (e.g., database, external services).
- **E2E Tests**: Full end-to-end testing (Playwright) that simulates real user flows (register, login, etc.).

## Load Testing

We use [k6](https://k6.io/) for load testing! First, install k6:

- macOS: `brew install k6`
- Windows: `choco install k6`
- Linux: Follow [k6 installation guide](https://k6.io/docs/getting-started/installation/)

Then, start your dev stack with `make dev` and run load tests with:

```bash
make load-test
```

The test script simulates virtual users logging in and fetching the students list, and shows metrics like:

- Request duration
- Request rate
- Error rate
