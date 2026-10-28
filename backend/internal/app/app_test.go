package app

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"rost/backend/internal/clock"
	"rost/backend/internal/content"
	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/store/storetest"
)

func maria(t *testing.T) domain.User {
	t.Helper()
	for _, u := range reference.DemoUsers() {
		if u.ID == "maria" {
			return u
		}
	}
	t.Fatal("no maria")
	return domain.User{}
}

func types(evs []CalendarEvent) []domain.EventType {
	out := []domain.EventType{}
	for _, e := range evs {
		out = append(out, e.Type)
	}
	return out
}

func has(list []domain.EventType, t domain.EventType) bool {
	for _, x := range list {
		if x == t {
			return true
		}
	}
	return false
}

// The demo path, end to end: salary -> payslip moment -> guess -> action -> follow-up -> metrics.
func TestDemoFlow(t *testing.T) {
	t.Cleanup(func() { clock.SetOffsetDays(0) })
	ctx := context.Background()
	s := Service{Store: storetest.New(maria(t))}

	res, err := s.HandleEvent(ctx, EventInput{UserID: "maria", Type: domain.SalaryReceived, Source: domain.SourceSimulator})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Runs) != 1 || res.Runs[0].MomentID != "payslip_explained" {
		t.Fatalf("runs = %+v", res.Runs)
	}
	runID := res.Runs[0].ID

	loaded, err := s.RunWithView(ctx, runID, "maria", reference.RO)
	if err != nil {
		t.Fatal(err)
	}
	if p := loaded.View.Payslip; p.Pension != 1500 || p.Pillar2 != 285 || *p.Pillar2Deadline != "2026-12-31" {
		t.Errorf("payslip view = %+v", p)
	}
	if loaded.Run.State != domain.RunStarted {
		t.Errorf("state = %s", loaded.Run.State)
	}
	if _, err := s.RunWithView(ctx, runID, "someone-else", reference.RO); err == nil {
		t.Error("another user could load the run")
	}

	if _, err := s.RecordGuess(ctx, runID, "maria", 300, loaded.View.Answers["pension"]); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CompleteWithAction(ctx, ActionInput{RunID: runID, UserID: "maria", ActionType: "payday_savings_rule", Params: map[string]any{"amountLei": 400}, FollowUpDays: 7}); err != nil {
		t.Fatal(err)
	}
	u, _ := s.Store.GetUser(ctx, "maria")
	if !reflect.DeepEqual(u.FirstsDone, []domain.FirstDone{"payslip"}) {
		t.Errorf("firstsDone = %v", u.FirstsDone)
	}

	if due, _ := s.DueFollowUps(ctx, "maria"); len(due) != 0 {
		t.Errorf("due before 7 days: %d", len(due))
	}
	clock.SetOffsetDays(7)
	due, _ := s.DueFollowUps(ctx, "maria")
	if len(due) != 1 {
		t.Fatalf("due after 7 days: %d", len(due))
	}
	due[0].Status = domain.ActionConfirmed
	if err := s.Store.UpdateAction(ctx, due[0]); err != nil {
		t.Fatal(err)
	}

	m, err := s.Metrics(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if m.Moments["payslip_explained"] != (MomentCounts{1, 1}) || m.ActionRate != 1 {
		t.Errorf("metrics = %+v", m)
	}
	if g := m.PayslipGuess; g == nil || *g != (PayslipGuess{1, 300, 1500, 1}) {
		t.Errorf("payslip guess = %+v", g)
	}
}

func TestReferralFeeOnlyForPartners(t *testing.T) {
	ctx := context.Background()
	s := Service{Store: storetest.New()}
	partner, _ := s.TrackReferralClick(ctx, "bank-b-12m", nil)
	state, _ := s.TrackReferralClick(ctx, "fidelis-2y-lei", nil)
	if _, err := s.TrackReferralClick(ctx, "nope", nil); err != ErrUnknownOffer {
		t.Errorf("unknown offer: %v", err)
	}
	if r, _ := s.ReferralPostback(ctx, partner, domain.ReferralFunded); r.FeeLei != 50 {
		t.Errorf("partner fee = %v", r.FeeLei)
	}
	if r, _ := s.ReferralPostback(ctx, state, domain.ReferralFunded); r.FeeLei != 0 {
		t.Errorf("state bond fee = %v", r.FeeLei)
	}
	m, _ := s.Metrics(ctx)
	if m.Referrals.Clicked != 2 || m.Referrals.Opened != 2 || m.Referrals.Funded != 2 || m.Referrals.FeesLei != 50 {
		t.Errorf("referrals = %+v", m.Referrals)
	}
}

func TestCalendar(t *testing.T) {
	m := maria(t)
	if has(types(CalendarEvents(m, "2026-10-28")), domain.Pillar2DeadlineNear) {
		t.Error("Pillar II reminder too early")
	}
	if !has(types(CalendarEvents(m, "2026-12-05")), domain.Pillar2DeadlineNear) {
		t.Error("no Pillar II reminder within 30 days")
	}
	if !has(types(CalendarEvents(m, "2026-11-10")), domain.SalaryReceived) {
		t.Error("no salary on payday")
	}
}

func TestUpgradeSeededLessons(t *testing.T) {
	ctx := context.Background()
	seed, err := content.Seed()
	if err != nil {
		t.Fatal(err)
	}
	st := storetest.New()
	if err := st.SeedContent(ctx, content.SeedName, seed); err != nil {
		t.Fatal(err)
	}
	s := Service{Store: st}

	// An old seed: Romanian only, as it was before the English text existed.
	stripEN := func(id string) domain.ContentItem {
		c, _ := st.GetContent(ctx, domain.KindMoment, id)
		var m domain.LibraryMoment
		_ = json.Unmarshal(c.Doc, &m)
		m.EN = nil
		c.Doc, _ = json.Marshal(m)
		return c
	}
	untouched := stripEN("dobanda_compusa")
	untouched.UpdatedBy = "seed"
	edited := stripEN("fondul_urgenta")
	edited.UpdatedBy = "admin@rost.ro"
	reshaped := stripEN("etf")
	reshaped.UpdatedBy = "admin@rost.ro"
	var r domain.LibraryMoment
	_ = json.Unmarshal(reshaped.Doc, &r)
	r.Steps = append(r.Steps[:1], r.Steps[2:]...) // the admin removed a step
	reshaped.Doc, _ = json.Marshal(r)
	for _, c := range []domain.ContentItem{untouched, edited, reshaped} {
		if _, err := st.UpdateContent(ctx, c); err != nil {
			t.Fatal(err)
		}
	}

	n, err := s.UpgradeSeededLessons(ctx, seed)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("upgraded %d lessons, want 2", n)
	}
	lessonEN := func(id string) (*domain.LessonText, domain.ContentItem) {
		c, _ := st.GetContent(ctx, domain.KindMoment, id)
		var m domain.LibraryMoment
		_ = json.Unmarshal(c.Doc, &m)
		return m.EN, c
	}
	if en, c := lessonEN("dobanda_compusa"); en == nil || c.UpdatedBy != "seed" {
		t.Error("seed-owned lesson not upgraded")
	}
	if en, c := lessonEN("fondul_urgenta"); en == nil || c.UpdatedBy != "admin@rost.ro" {
		t.Error("admin-edited lesson didn't get its English, or lost its editor")
	}
	if en, _ := lessonEN("etf"); en != nil {
		t.Error("English added to a lesson whose steps no longer match it")
	}
	if n, _ := s.UpgradeSeededLessons(ctx, seed); n != 0 {
		t.Errorf("second run changed %d lessons", n)
	}
	// Postgres hands JSON back with its own key order and spacing; that alone isn't a change.
	c, _ := st.GetContent(ctx, domain.KindMoment, "dobanda_compusa")
	var doc map[string]any
	_ = json.Unmarshal(c.Doc, &doc)
	c.Doc, _ = json.MarshalIndent(doc, "", "    ")
	if _, err := st.UpdateContent(ctx, c); err != nil {
		t.Fatal(err)
	}
	if n, _ := s.UpgradeSeededLessons(ctx, seed); n != 0 {
		t.Errorf("reformatted JSON counted as %d changes", n)
	}
}
