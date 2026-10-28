# Rost backend (Go)

The Go API for the product described in [Architecture.md](../Architecture.md).

## Run with Docker (from the repo root)

```bash
docker compose up -d --build
curl localhost:8080/readyz
```

This starts Postgres 16 (`db`, port 5432) and the API (`backend`, port 8080). The API waits for the database to be healthy.

## Run locally

```bash
docker compose up -d db
cd backend
DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' go run ./cmd/api
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string |
| `HTTP_ADDR` | `:8080` | Listen address |
| `SHUTDOWN_TIMEOUT` | `10s` | Time in-flight requests get on SIGTERM |

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Liveness: the process is up |
| `GET /readyz` | Readiness: Postgres answers a ping |

## Layout

```
cmd/api/            entry point: config, database, HTTP server, graceful shutdown
internal/config/    settings from the environment
internal/database/  pgx connection pool
internal/server/    routes and handlers
```

## Checks

```bash
go vet ./... && go test ./...
```
