package learning

import (
	"sort"
	"time"
	_ "time/tzdata" // the container may have no zoneinfo

	"rost/backend/internal/domain"
)

// keepDays: enough for this week and the one before (same as rhythm.ts in the frontend)
const keepDays = 14

// MaxInProgress lessons are remembered halfway; the oldest is dropped first.
const MaxInProgress = 8

var bucharest, _ = time.LoadLocation("Europe/Bucharest")

// DayKey is the calendar day in Romania, YYYY-MM-DD, so "this week" follows the user's days, not UTC's.
func DayKey(t time.Time) string { return t.In(bucharest).Format("2006-01-02") }

// WithDay adds a day with a finished lesson, once, keeping the last two weeks' worth.
func WithDay(days []string, day string) []string {
	for _, d := range days {
		if d == day {
			return days
		}
	}
	out := append(append([]string{}, days...), day)
	sort.Strings(out)
	if len(out) > keepDays {
		out = out[len(out)-keepDays:]
	}
	return out
}

// WithProgress remembers where a lesson was left, dropping the oldest beyond MaxInProgress.
func WithProgress(l domain.Learning, id string, p domain.LessonProgress) domain.Learning {
	all := map[string]domain.LessonProgress{}
	for k, v := range l.LessonProgress {
		if k != id {
			all[k] = v
		}
	}
	for len(all) >= MaxInProgress {
		oldest := ""
		for k, v := range all {
			if oldest == "" || v.SavedAt < all[oldest].SavedAt || (v.SavedAt == all[oldest].SavedAt && k < oldest) {
				oldest = k
			}
		}
		delete(all, oldest)
	}
	all[id] = p
	l.LessonProgress = all
	return l
}

// WithoutProgress forgets a lesson in progress (it was finished).
func WithoutProgress(l domain.Learning, id string) domain.Learning {
	if _, ok := l.LessonProgress[id]; !ok {
		return l
	}
	all := map[string]domain.LessonProgress{}
	for k, v := range l.LessonProgress {
		if k != id {
			all[k] = v
		}
	}
	l.LessonProgress = all
	return l
}
