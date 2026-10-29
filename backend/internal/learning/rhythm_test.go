package learning

import (
	"reflect"
	"testing"
	"time"

	"rost/backend/internal/domain"
)

func TestDayKeyIsRomanianTime(t *testing.T) {
	// 22:30 UTC on 28 October is already 29 October in Bucharest (UTC+2 in winter)
	if got := DayKey(time.Date(2026, 10, 28, 22, 30, 0, 0, time.UTC)); got != "2026-10-29" {
		t.Errorf("DayKey = %s", got)
	}
}

func TestWithDay(t *testing.T) {
	days := []string{}
	for d := 1; d <= 16; d++ {
		days = WithDay(days, time.Date(2026, 10, d, 12, 0, 0, 0, time.UTC).Format("2006-01-02"))
	}
	if len(days) != 14 || days[0] != "2026-10-03" || days[13] != "2026-10-16" {
		t.Errorf("kept = %v", days)
	}
	if again := WithDay(days, "2026-10-16"); !reflect.DeepEqual(again, days) {
		t.Error("the same day twice is kept once")
	}
}

func TestWithProgressDropsTheOldest(t *testing.T) {
	l := domain.Learning{}
	for i := 0; i < MaxInProgress+2; i++ {
		l = WithProgress(l, string(rune('a'+i)), domain.LessonProgress{Step: 1, Of: 4, SavedAt: time.Date(2026, 10, 1+i, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)})
	}
	if len(l.LessonProgress) != MaxInProgress {
		t.Fatalf("kept %d", len(l.LessonProgress))
	}
	if _, ok := l.LessonProgress["a"]; ok {
		t.Error("the oldest should be dropped first")
	}
	if l = WithoutProgress(l, "j"); len(l.LessonProgress) != MaxInProgress-1 {
		t.Error("finishing a lesson forgets it")
	}
}
