package app

import (
	"context"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/moments"
	"rost/backend/internal/rules"
)

type SalaryChange struct {
	User    domain.User            `json:"user"`
	Payslip rules.PayslipBreakdown `json:"payslip"`
	// Before is the gross salary before this change; nil the first time it is given.
	Before *float64 `json:"before"`
	// Raise is true when the salary went up: it is dated today and fires a raise event.
	Raise bool `json:"raise"`
	// After a raise, the payslip moment with the new numbers: opened again, or the one already
	// open (moments read the salary when shown, so it has the new numbers too).
	Runs []domain.MomentRun `json:"runs"`
}

// SetSalary records a new monthly gross salary. Everything that shows the salary (the payslip
// moment, the real-salary line in the inflation moment) reads it when shown, so it follows at
// once. A raise also gets today's date and reopens the payslip moment, even if it was done.
func (s Service) SetSalary(ctx context.Context, u domain.User, gross float64) (SalaryChange, error) {
	payslip, err := rules.Payslip(gross, rules.DeductionFor(u.AgeBand()))
	if err != nil {
		return SalaryChange{}, err
	}
	out := SalaryChange{Before: u.GrossMonthly, Payslip: payslip, Runs: []domain.MomentRun{}}
	out.Raise = u.GrossMonthly != nil && gross > *u.GrossMonthly
	u.GrossMonthly = &gross
	if out.Raise {
		u.LastRaiseDate = domain.Ptr(clock.TodayISO())
	}
	if err := s.Store.UpdateUser(ctx, u); err != nil {
		return SalaryChange{}, err
	}
	out.User = u
	if out.Raise {
		res, err := s.HandleEvent(ctx, EventInput{
			UserID: u.ID, Type: domain.Raise, Source: domain.SourceUser,
			Payload: map[string]any{"from": *out.Before, "to": gross},
		})
		if err != nil {
			return out, err
		}
		out.Runs = res.Runs
		open, err := s.openRuns(ctx, u.ID, res.Decision.Skipped)
		if err != nil {
			return out, err
		}
		out.Runs = append(out.Runs, open...)
	}
	return out, nil
}

// openRuns finds the runs behind "already open" skips, so the user can be sent to them.
func (s Service) openRuns(ctx context.Context, userID string, skipped []moments.Skip) ([]domain.MomentRun, error) {
	want := map[string]bool{}
	for _, sk := range skipped {
		if sk.Reason == moments.SkipAlreadyOpen {
			want[sk.MomentID] = true
		}
	}
	if len(want) == 0 {
		return nil, nil
	}
	runs, err := s.Store.ListRuns(ctx, userID)
	if err != nil {
		return nil, err
	}
	var out []domain.MomentRun
	for _, r := range runs {
		if want[r.MomentID] && (r.State == domain.RunPending || r.State == domain.RunStarted) {
			out = append(out, r)
			delete(want, r.MomentID)
		}
	}
	return out, nil
}
