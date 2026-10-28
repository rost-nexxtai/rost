package moments_test

import (
	"reflect"
	"testing"

	"rost/backend/internal/domain"
	"rost/backend/internal/moments"
	"rost/backend/internal/reference"
)

const now = "2026-10-28T12:00:00.000Z"

func maria() domain.User {
	return domain.User{
		ID:              "maria",
		Situations:      []domain.Situation{domain.Graduate, domain.Employed},
		GrossMonthly:    domain.Ptr(6000.0),
		HireDate:        domain.Ptr("2026-09-01"),
		MonthlyExpenses: domain.Ptr(2500.0),
		FirstsDone:      []domain.FirstDone{},
		Spending: &domain.SpendingProfile{
			Shares:  domain.CategoryShares{Services: 0.55, NonFood: 0.25, Food: 0.2},
			Monthly: domain.MonthlyLines{Fuel: domain.Ptr(400.0)},
			Source:  "self",
		},
		CreatedAt: "2026-10-01T00:00:00.000Z",
	}
}

func ev(t domain.EventType) moments.Event {
	return moments.Event{Type: t, Source: domain.SourceSimulator, Payload: map[string]any{}}
}

func run(momentID string, state domain.RunState, createdAt string) domain.MomentRun {
	return domain.MomentRun{ID: momentID + string(state), UserID: "maria", MomentID: momentID, State: state, CreatedAt: createdAt}
}

func decide(u domain.User, e moments.Event, runs []domain.MomentRun, ignoreCap bool) moments.Decision {
	return moments.Decide(reference.MomentDefs(reference.RO), u, e, runs, now, ignoreCap)
}

func TestOpensMoments(t *testing.T) {
	if got := decide(maria(), ev(domain.SalaryReceived), nil, false).Open; !reflect.DeepEqual(got, []string{"payslip_explained"}) {
		t.Errorf("salary_received opened %v", got)
	}
	if got := decide(maria(), ev(domain.InflationPublished), nil, false).Open; !reflect.DeepEqual(got, []string{"personal_inflation"}) {
		t.Errorf("inflation_published opened %v", got)
	}
}

func TestSilentForStudent(t *testing.T) {
	student := maria()
	student.Situations = []domain.Situation{domain.Student}
	d := decide(student, ev(domain.SalaryReceived), nil, false)
	if len(d.Open) != 0 || d.Skipped[0].Reason != moments.SkipSituation {
		t.Errorf("got %+v", d)
	}
}

func TestWeeklyCap(t *testing.T) {
	recent := []domain.MomentRun{run("payslip_explained", domain.RunCompleted, "2026-10-25T00:00:00.000Z")}
	if r := decide(maria(), ev(domain.InflationPublished), recent, false).Skipped[0].Reason; r != moments.SkipWeeklyCap {
		t.Errorf("reason = %s", r)
	}
	if got := decide(maria(), ev(domain.InflationPublished), recent, true).Open; !reflect.DeepEqual(got, []string{"personal_inflation"}) {
		t.Errorf("ignoreWeeklyCap opened %v", got)
	}
	catchUp := moments.Event{Type: domain.CatchUp, Source: domain.SourceUser, Payload: map[string]any{"momentId": "personal_inflation"}}
	if got := decide(maria(), catchUp, recent, false).Open; !reflect.DeepEqual(got, []string{"personal_inflation"}) {
		t.Errorf("catch_up opened %v", got)
	}
}

func TestRepeats(t *testing.T) {
	old := "2026-09-01T00:00:00.000Z"
	done := []domain.MomentRun{run("payslip_explained", domain.RunCompleted, old)}
	if r := decide(maria(), ev(domain.SalaryReceived), done, false).Skipped[0].Reason; r != moments.SkipAlreadyDone {
		t.Errorf("reason = %s", r)
	}
	if got := decide(maria(), ev(domain.Raise), done, false).Open; !reflect.DeepEqual(got, []string{"payslip_explained"}) {
		t.Errorf("raise opened %v", got)
	}
	news := []domain.MomentRun{run("personal_inflation", domain.RunCompleted, old)}
	if got := decide(maria(), ev(domain.InflationPublished), news, false).Open; !reflect.DeepEqual(got, []string{"personal_inflation"}) {
		t.Errorf("repeat news opened %v", got)
	}
}

func TestFill(t *testing.T) {
	if got := moments.Fill("Out of {{gross}} lei, {{ missing }}ok", map[string]any{"gross": "6,000"}); got != "Out of 6,000 lei, ok" {
		t.Errorf("fill = %q", got)
	}
	if got := moments.Fill("{{headline}}%", map[string]any{"headline": 6.61}); got != "6.61%" {
		t.Errorf("fill number = %q", got)
	}
}
