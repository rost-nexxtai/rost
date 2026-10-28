package rules

import (
	"math"
	"time"
)

func parseDay(iso string) time.Time {
	if len(iso) > 10 {
		iso = iso[:10]
	}
	t, _ := time.Parse(time.DateOnly, iso)
	return t
}

// AddMonths adds whole months to an ISO date (YYYY-MM-DD), clamping to the month's last day.
func AddMonths(iso string, months int) string {
	t := parseDay(iso)
	first := time.Date(t.Year(), t.Month()+time.Month(months), 1, 0, 0, 0, 0, time.UTC)
	lastDay := first.AddDate(0, 1, -1).Day()
	day := t.Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, time.UTC).Format(time.DateOnly)
}

func AddDays(iso string, days int) string {
	return parseDay(iso).AddDate(0, 0, days).Format(time.DateOnly)
}

// DaysBetween is whole days from fromISO to toISO (negative if toISO is earlier).
func DaysBetween(fromISO, toISO string) int {
	return int(math.Round(parseDay(toISO).Sub(parseDay(fromISO)).Hours() / 24))
}

// Pillar2Deadline is the last day to choose a Pillar II fund: hire date + 4 months, minus one day.
// Example: hired 2026-09-01 -> choose by 2026-12-31. Re-verify each year with the finance reviewer.
func Pillar2Deadline(hireDateISO string) string {
	return AddDays(AddMonths(hireDateISO, Rules2026.Pillar2ChoiceMonths), -1)
}
