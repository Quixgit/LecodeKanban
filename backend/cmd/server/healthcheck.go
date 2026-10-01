package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

// healthcheck probes /healthz on the local listener. It lets distroless images
// (no shell, no curl) declare a container HEALTHCHECK: `server healthcheck`.
func healthcheck() error {
	addr := os.Getenv("LK_HTTP_ADDR")
	if addr == "" {
		addr = ":47101"
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("healthcheck: bad LK_HTTP_ADDR %q: %w", addr, err)
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 {
		return fmt.Errorf("healthcheck: bad port in LK_HTTP_ADDR %q", addr)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	target := fmt.Sprintf("http://127.0.0.1:%d/healthz", n)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil) //nolint:gosec // G704: fixed loopback host, validated port
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req) //nolint:gosec // G704: see above
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck: status %d", resp.StatusCode)
	}
	return nil
}
