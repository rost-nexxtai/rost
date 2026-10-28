// Package moments decides which moment an event opens, and fills moment text.
package moments

import (
	"fmt"
	"regexp"
	"strconv"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
)

// Step is one step of a moment, kept as the JSON object from the definition file so the
// frontend receives it unchanged (predict, reveal, card or action).
type Step = map[string]any

type Conditions struct {
	Situations []domain.Situation `json:"situations,omitempty"`
	// User fields the moment needs: grossMonthly, spending, hireDate, monthlyExpenses.
	Requires []string `json:"requires,omitempty"`
}

type Definition struct {
	ID      string `json:"id"`
	Series  string `json:"series"`
	Title   string `json:"title"`
	Minutes int    `json:"minutes"`
	// Events that can open this moment. catch_up (user-initiated) can open any moment.
	Triggers []domain.EventType `json:"triggers"`
	// Events that may open it again after it was completed.
	RepeatOn     []domain.EventType `json:"repeatOn,omitempty"`
	Conditions   Conditions         `json:"conditions"`
	Steps        []Step             `json:"steps"`
	FollowUpDays int                `json:"followUpDays"`
}

const WeeklyCapDays = 7

type SkipReason string

const (
	SkipSituation   SkipReason = "situation"
	SkipMissingData SkipReason = "missing_data"
	SkipAlreadyDone SkipReason = "already_done"
	SkipAlreadyOpen SkipReason = "already_open"
	SkipWeeklyCap   SkipReason = "weekly_cap"
)

type Skip struct {
	MomentID string     `json:"momentId"`
	Reason   SkipReason `json:"reason"`
}

type Decision struct {
	Open    []string `json:"open"`
	Skipped []Skip   `json:"skipped"`
}

// Event is the part of an event the engine reads.
type Event struct {
	Type    domain.EventType
	Payload map[string]any
	Source  domain.EventSource
}

func contains[T comparable](list []T, v T) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// AskOnCatchUp is the data a user can type in when they start a moment themselves: a gross salary
// (theirs, or one they expect) is enough for the payslip moment.
var AskOnCatchUp = []string{"grossMonthly"}

// CatchUpNeeds says whether the user can start this moment themselves, and which data they must
// type in first (only fields in AskOnCatchUp). Starting it yourself skips the situation check:
// a student may want to see their first payslip before they have one.
func CatchUpNeeds(def Definition, u domain.User) (ok bool, needs []string) {
	for _, field := range def.Conditions.Requires {
		if !missingField(field, u) {
			continue
		}
		if !contains(AskOnCatchUp, field) {
			return false, nil
		}
		needs = append(needs, field)
	}
	return true, needs
}

func situationOK(def Definition, u domain.User) bool {
	s := def.Conditions.Situations
	if len(s) == 0 {
		return true
	}
	for _, x := range s {
		if u.HasSituation(x) {
			return true
		}
	}
	return false
}

func missingRequirement(def Definition, u domain.User) bool {
	for _, field := range def.Conditions.Requires {
		if missingField(field, u) {
			return true
		}
	}
	return false
}

func missingField(field string, u domain.User) bool {
	switch field {
	case "grossMonthly":
		return u.GrossMonthly == nil
	case "spending":
		return u.Spending == nil
	case "hireDate":
		return u.HireDate == nil
	case "monthlyExpenses":
		return u.MonthlyExpenses == nil
	}
	return false
}

// Decide is the pure decision: which moments does this event open for this user?
// Rules: trigger matches, conditions hold, not already done (unless the event is a repeat
// trigger), not already open, and at most one new moment per week unless the user asked for it.
func Decide(defs []Definition, u domain.User, ev Event, runs []domain.MomentRun, nowISO string, ignoreWeeklyCap bool) Decision {
	d := Decision{Open: []string{}, Skipped: []Skip{}}
	userInitiated := ev.Type == domain.CatchUp || ev.Source == domain.SourceUser
	now, _ := clock.Parse(nowISO)
	capStart := now.AddDate(0, 0, -WeeklyCapDays)
	recent := 0
	for _, r := range runs {
		created, err := clock.Parse(r.CreatedAt)
		if r.State != domain.RunDismissed && err == nil && !created.Before(capStart) {
			recent++
		}
	}

	for _, def := range defs {
		var triggered bool
		if ev.Type == domain.CatchUp {
			triggered = ev.Payload["momentId"] == def.ID
		} else {
			triggered = contains(def.Triggers, ev.Type) || contains(def.RepeatOn, ev.Type)
		}
		if !triggered {
			continue
		}

		if ev.Type != domain.CatchUp && !situationOK(def, u) {
			d.Skipped = append(d.Skipped, Skip{def.ID, SkipSituation})
			continue
		}
		if missingRequirement(def, u) {
			d.Skipped = append(d.Skipped, Skip{def.ID, SkipMissingData})
			continue
		}
		open, done := false, false
		for _, r := range runs {
			if r.MomentID != def.ID {
				continue
			}
			open = open || r.State == domain.RunPending || r.State == domain.RunStarted
			done = done || r.State == domain.RunCompleted
		}
		if open {
			d.Skipped = append(d.Skipped, Skip{def.ID, SkipAlreadyOpen})
			continue
		}
		if done && !userInitiated && !contains(def.RepeatOn, ev.Type) {
			d.Skipped = append(d.Skipped, Skip{def.ID, SkipAlreadyDone})
			continue
		}
		if !userInitiated && !ignoreWeeklyCap && (recent > 0 || len(d.Open) > 0) {
			d.Skipped = append(d.Skipped, Skip{def.ID, SkipWeeklyCap})
			continue
		}
		d.Open = append(d.Open, def.ID)
	}
	return d
}

var placeholder = regexp.MustCompile(`\{\{\s*(\w+)\s*\}\}`)

// Fill fills {{placeholders}} from a flat map of values. Unknown keys become empty strings.
func Fill(template string, vars map[string]any) string {
	return placeholder.ReplaceAllStringFunc(template, func(m string) string {
		v, ok := vars[placeholder.FindStringSubmatch(m)[1]]
		if !ok || v == nil {
			return ""
		}
		switch x := v.(type) {
		case string:
			return x
		case float64:
			return strconv.FormatFloat(x, 'f', -1, 64)
		case int:
			return strconv.Itoa(x)
		default:
			return fmt.Sprint(x)
		}
	})
}

// FillSteps returns the definition with every text field's {{placeholders}} filled, so clients render plain text.
func FillSteps(def Definition, vars map[string]any) Definition {
	steps := make([]Step, len(def.Steps))
	for i, step := range def.Steps {
		out := Step{}
		for k, v := range step {
			if s, ok := v.(string); ok {
				v = Fill(s, vars)
			}
			out[k] = v
		}
		steps[i] = out
	}
	def.Steps = steps
	return def
}
