// Command healthcheck is the Docker HEALTHCHECK for the API image, which has no shell, curl or wget.
// It GETs a path (default /healthz) on the API's own port, from HTTP_ADDR like the API, and exits 0 on a 200.
//
//	healthcheck [path]
package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	path := "/healthz"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}

	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://" + addr + path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, resp.Status)
		os.Exit(1)
	}
}
