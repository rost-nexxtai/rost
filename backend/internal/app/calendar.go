package app

import (
	"strconv"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
)

type CalendarEvent struct {
	Type    domain.EventType
	Payload map[string]any
}

// CalendarEvents are the events the calendar knows without any bank data: payday, the Pillar II
// deadline (from the hire date) and a fresh INS inflation release. Run once a day per user (cron),
// or from the simulator.
func CalendarEvents(u domain.User, todayISO string) []CalendarEvent {
	var out []CalendarEvent
	day, _ := strconv.Atoi(todayISO[8:10])
	employed := u.HasSituation(domain.Employed)

	if u.Payday != nil && *u.Payday == day && employed {
		out = append(out, CalendarEvent{domain.SalaryReceived, map[string]any{"from": "calendar"}})
	}
	if u.HireDate != nil && employed {
		deadline := rules.Pillar2Deadline(*u.HireDate)
		if left := rules.DaysBetween(todayISO, deadline); left >= 0 && left <= 30 {
			out = append(out, CalendarEvent{domain.Pillar2DeadlineNear, map[string]any{"deadline": deadline, "daysLeft": left}})
		}
	}
	cpi := reference.LatestCPI(reference.RO)
	if since := rules.DaysBetween(cpi.PublishedAt, todayISO); since >= 0 && since <= 2 {
		out = append(out, CalendarEvent{domain.InflationPublished, map[string]any{"period": cpi.Period}})
	}
	return out
}
