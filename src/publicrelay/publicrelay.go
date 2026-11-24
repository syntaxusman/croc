// Package publicrelay defines and measures croc's ordered public relay pool.
package publicrelay

import (
	"context"
	"errors"
	"strings"
	"time"
)

const ProbeTimeout = time.Second

var relays = []string{
	"1.getcroc.com:9009",
	"2.getcroc.com:9009",
	"3.getcroc.com:9009",
	"4.getcroc.com:9009",
}

// Pool optionally replaces the default relay pool for self-hosted builds. It
// is a comma-separated, ordered list of host:port relays set at link time:
//
//	-ldflags "-X github.com/schollz/croc/v11/src/publicrelay.Pool=relay.example.com:9009"
//
// Every croc and croc-web binary that shares codes must use the same Pool,
// because a code's relay is chosen by its index within the pool.
var Pool string

// Relays returns a copy of the protocol-ordered public relay pool.
func Relays() []string {
	if pool := parsePool(Pool); len(pool) > 0 {
		return pool
	}
	return append([]string(nil), relays...)
}

func parsePool(value string) []string {
	var pool []string
	for relay := range strings.SplitSeq(value, ",") {
		if relay = strings.TrimSpace(relay); relay != "" {
			pool = append(pool, relay)
		}
	}
	return pool
}

// Probe measures one complete croc ping/pong exchange.
type Probe func(ctx context.Context, address string, timeout time.Duration) (time.Duration, error)

type probeResult struct {
	index    int
	duration time.Duration
	err      error
}

// SelectFirst races one probe to every relay and returns as soon as the first
// relay completes a successful croc ping/pong exchange. Outstanding probes are
// canceled before returning.
func SelectFirst(ctx context.Context, addresses []string, timeout time.Duration, probe Probe) (int, time.Duration, error) {
	if len(addresses) == 0 {
		return 0, 0, errors.New("public relay pool is empty")
	}
	if timeout <= 0 {
		return 0, 0, errors.New("probe timeout must be positive")
	}
	if probe == nil {
		return 0, 0, errors.New("relay probe is required")
	}
	if ctx == nil {
		return 0, 0, errors.New("probe context is required")
	}

	probeCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	results := make(chan probeResult, len(addresses))
	for index, address := range addresses {
		go func() {
			duration, err := probe(probeCtx, address, timeout)
			results <- probeResult{index: index, duration: duration, err: err}
		}()
	}

	for range addresses {
		select {
		case <-ctx.Done():
			return 0, 0, ctx.Err()
		case result := <-results:
			if result.err == nil {
				return result.index, result.duration, nil
			}
		}
	}
	return 0, 0, errors.New("no public relay available")
}
