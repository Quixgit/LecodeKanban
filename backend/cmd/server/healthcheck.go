package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
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
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck: status %d", resp.StatusCode)
	}
	return nil
}
