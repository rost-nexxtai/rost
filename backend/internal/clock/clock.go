// Package clock is the app clock with a demo offset, so the simulator can jump
// forward ("7 days later") without touching the system time.
package clock

import (
	"math"
	"sync/atomic"
	"time"
)

const isoLayout = "2006-01-02T15:04:05.000Z"

var offsetDays atomic.Int64

func OffsetDays() int { return int(offsetDays.Load()) }

// SetOffsetDays moves the clock; negative values become 0.
func SetOffsetDays(days float64) {
	d := int64(math.Floor(days + 0.5))
	if d < 0 || math.IsNaN(days) {
		d = 0
	}
	offsetDays.Store(d)
}

func Now() time.Time {
	return time.Now().Add(time.Duration(offsetDays.Load()) * 24 * time.Hour)
}

// ISO formats a time like JavaScript's toISOString (UTC, milliseconds).
func ISO(t time.Time) string { return t.UTC().Format(isoLayout) }

func NowISO() string { return ISO(Now()) }

func TodayISO() string { return NowISO()[:10] }

// Parse reads an ISO timestamp written by ISO (or any RFC 3339 time).
func Parse(s string) (time.Time, error) { return time.Parse(time.RFC3339Nano, s) }
