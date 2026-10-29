# Build stage: compile a static binary.
FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/healthcheck ./cmd/healthcheck

# Runtime stage: no shell, no package manager, non-root.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /out/healthcheck /
EXPOSE 8080
USER nonroot:nonroot
# Liveness: the API answers. It listens only once migrations and seeding are done; /readyz also checks Postgres.
HEALTHCHECK --interval=10s --timeout=4s --start-period=30s --retries=3 CMD ["/healthcheck", "/healthz"]
ENTRYPOINT ["/api"]
