# syntax=docker/dockerfile:1
# Builds the API, worker, migrate, seed and adduser binaries into a distroless, non-root image.
FROM golang:1.27-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOFLAGS=-trimpath
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    for cmd in server worker migrate seed adduser; do \
      go build -ldflags="-s -w" -o /out/$cmd ./cmd/$cmd || exit 1; \
    done
# Owned by distroless "nonroot" (65532) so a fresh named volume inherits writable ownership.
RUN mkdir -p /data/attachments && chown -R 65532:65532 /data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ /app/
COPY --from=build --chown=65532:65532 /data /data
USER nonroot:nonroot
EXPOSE 47101
HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=3 CMD ["/app/server", "healthcheck"]
ENTRYPOINT ["/app/server"]
