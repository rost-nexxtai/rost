package learning

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"rost/backend/internal/content"
	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
)

func seedLibrary(t *testing.T) ([]domain.LibraryMoment, []domain.NewsItem) {
	t.Helper()
	items, err := content.Seed()
	if err != nil {
		t.Fatal(err)
	}
	var moments, news []domain.ContentItem
	for _, c := range items {
		if c.Kind == domain.KindMoment {
			moments = append(moments, c)
		} else {
			news = append(news, c)
		}
	}
	m, err := content.Moments(moments)
	if err != nil {
		t.Fatal(err)
	}
	n, err := content.News(news)
	if err != nil {
		t.Fatal(err)
	}
	return m, n
}

// same cases as scoring.test.ts
func TestLevelAndRisk(t *testing.T) {
	base := RiskInput{AgeBand: "sub_25", Horizon: "peste_3_ani", BufferMonths: 6}
	with := func(f func(*RiskInput)) RiskInput { in := base; f(&in); return in }
	cases := []struct {
		in   RiskInput
		want domain.RiskProfile
	}{
		{with(func(i *RiskInput) { i.Level = 0 }), domain.RiskEchilibrat},
		{with(func(i *RiskInput) { i.Level = 2 }), domain.RiskDinamic},
		{with(func(i *RiskInput) { i.AgeBand = "30_plus" }), domain.RiskPrudent},
		{with(func(i *RiskInput) { i.Level, i.Horizon = 2, "sub_1_an" }), domain.RiskPrudent},
		{with(func(i *RiskInput) { i.Level, i.BufferMonths = 2, 1 }), domain.RiskEchilibrat},
		{with(func(i *RiskInput) { i.Level, i.ExpensiveDebt = 2, true }), domain.RiskEchilibrat},
	}
	for _, c := range cases {
		if got := Risk(c.in); got != c.want {
			t.Errorf("Risk(%+v) = %s, want %s", c.in, got, c.want)
		}
	}
}

var (
	l0 = []string{"fondul_urgenta", "economii_vs_depozit", "dobanda_compusa"}
	l1 = []string{"titluri_stat", "etf"}
)

func TestLevelWithMoments(t *testing.T) {
	library, _ := seedLibrary(t)
	core := CoreByLevel(library)
	// actiuni and aur have no steps yet
	if !reflect.DeepEqual(core, map[domain.Level][]string{0: l0, 1: l1, 2: {}}) {
		t.Fatalf("core = %v", core)
	}
	if got := LevelWithMoments(0, core, nil); got != 0 {
		t.Errorf("nothing done = L%d", got)
	}
	if got := LevelWithMoments(0, core, l0[:2]); got != 0 {
		t.Errorf("2 of 3 L0 lessons = L%d", got)
	}
	if got := LevelWithMoments(0, core, l0); got != 1 {
		t.Errorf("L0 core done = L%d", got)
	}
	if got := LevelWithMoments(0, core, l1); got != 0 {
		t.Errorf("L1 core without L0 = L%d", got)
	}
	if got := LevelWithMoments(0, core, append(l0, l1...)); got != 2 {
		t.Errorf("L0 + L1 core done = L%d", got)
	}
	if got := LevelWithMoments(2, core, nil); got != 2 {
		t.Errorf("quiz level is a floor: L%d", got)
	}
	empty := map[domain.Level][]string{0: {}, 1: {}, 2: {}}
	if got := LevelWithMoments(0, empty, nil); got != 0 {
		t.Errorf("no core moments must not unlock anything: L%d", got)
	}
}

func maria() domain.User {
	name := "Maria"
	return domain.User{ID: "maria", Name: &name, Quiz: &domain.QuizProfile{
		Score: 2, Level: 1, AgeBand: "sub_25", Situation: "employed", BufferMonths: 0.8, Horizon: "peste_3_ani",
		FuelLei: 400, ElectricityLei: 150, SavedLei: 2500,
	}}
}

func TestBuildProfile(t *testing.T) {
	library, _ := seedLibrary(t)
	core := CoreByLevel(library)
	if BuildProfile(domain.User{ID: "new"}, nil, core, 6.61) != nil {
		t.Error("profile before the quiz")
	}
	p := BuildProfile(maria(), nil, core, 8.48)
	if p.Level != 1 || p.QuizLevel != 1 || p.RiskProfile != domain.RiskEchilibrat || p.Money.InflationPct != 8.48 || p.CompletedMomentIDs == nil {
		t.Errorf("maria = %+v", p)
	}
	// buffer < 3 months caps her at echilibrat
	p = BuildProfile(maria(), append(l0, l1...), core, 8.48)
	if p.Level != 2 || p.RiskProfile != domain.RiskEchilibrat {
		t.Errorf("maria after L1 = L%d %s", p.Level, p.RiskProfile)
	}
}

func TestScoreAnswers(t *testing.T) {
	library, _ := seedLibrary(t)
	fond := library[0] // sort, predict, explore, choice, finish
	zero, one := 0, 1
	close, far := 4.0, 9.0
	right := []int{0, 1, 0, 1, 0}
	correct, total, ok := ScoreAnswers(fond, []Answer{{Step: 0, Buckets: right}, {Step: 1, Value: &close}, {Step: 3, Picked: &zero}})
	if !ok || correct != 3 || total != 3 {
		t.Errorf("all right = %d/%d %v", correct, total, ok)
	}
	correct, _, _ = ScoreAnswers(fond, []Answer{{Step: 0, Buckets: []int{1, 1, 0, 1, 0}}, {Step: 1, Value: &far}, {Step: 3, Picked: &one}})
	if correct != 0 {
		t.Errorf("all wrong = %d", correct)
	}
	if _, total, ok := ScoreAnswers(fond, nil); !ok || total != 3 {
		t.Error("no answers is fine: total still counts the graded steps")
	}
	for name, bad := range map[string][]Answer{
		"step out of range":    {{Step: 9, Picked: &one}},
		"value on a choice":    {{Step: 3, Value: &close}},
		"pick on a predict":    {{Step: 1, Picked: &one}},
		"pick on a sort":       {{Step: 0, Picked: &one}},
		"too few sort buckets": {{Step: 0, Buckets: []int{0, 1}}},
		"answer on an explore": {{Step: 2, Picked: &one}},
		"same step twice":      {{Step: 3, Picked: &one}, {Step: 3, Picked: &zero}},
		"negative step number": {{Step: -1, Picked: &one}},
		"buckets on a predict": {{Step: 1, Buckets: right}},
	} {
		if _, _, ok := ScoreAnswers(fond, bad); ok {
			t.Errorf("%s accepted", name)
		}
	}
}

func TestMomente(t *testing.T) {
	library, _ := seedLibrary(t)
	core := CoreByLevel(library)
	p := BuildProfile(maria(), nil, core, 8.48)
	state := TriggeredState{
		Defs:       []TriggeredMoment{{ID: "payslip_explained", Title: "Your payslip, explained", Series: "Prima dată", Minutes: 3}, {ID: "personal_inflation", Title: "Inflation", Minutes: 4}},
		Open:       []domain.MomentRun{{ID: "run1", MomentID: "payslip_explained", State: domain.RunPending}},
		CatchUpIDs: []string{"personal_inflation"},
	}
	m := Momente(*p, library, core, state)
	if len(m.Triggered) != 1 || m.Triggered[0].Href != "/moment/run1" || m.Triggered[0].Level != nil {
		t.Errorf("triggered = %+v", m.Triggered)
	}
	ids := []string{}
	for _, s := range m.ForYourLevel {
		ids = append(ids, s.ID)
	}
	// same as momente.test.ts
	if !reflect.DeepEqual(ids, []string{"titluri_stat", "etf", "fondul_urgenta", "economii_vs_depozit", "dobanda_compusa"}) {
		t.Errorf("for your level = %v", ids)
	}
	if f := m.ForYourLevel[0]; f.Status != "todo" || f.Href != "/moment/lib/titluri_stat" || f.Hook == "" {
		t.Errorf("first = %+v", f)
	}
	if a := m.Rest[0]; a.ID != "actiuni" || a.Status != "soon" || a.Href != "" {
		t.Errorf("soon = %+v", a)
	}
	last := m.Rest[len(m.Rest)-1]
	if last.ID != "personal_inflation" || last.CatchUpMomentID != "personal_inflation" || last.Status != "todo" {
		t.Errorf("catch-up = %+v", last)
	}
	if m.Progress.CoreTotal != 2 || m.Progress.CoreDone != 0 || *m.Progress.NextLevel != 2 || m.DueFollowUps == nil {
		t.Errorf("progress = %+v", m.Progress)
	}
}

func TestStiri(t *testing.T) {
	_, news := seedLibrary(t)
	money := domain.MoneyLines{FuelLei: 400, ElectricityLei: 150, SavedLei: 2500, InflationPct: 8.48}
	s := Stiri(news, money)
	got := []string{}
	for _, i := range s.Items {
		got = append(got, i.ID)
	}
	// same as stiri.test.ts
	if !reflect.DeepEqual(got, []string{"motorina", "electricitate", "bnr"}) || s.Items[0].MonthlyLei != 32 || s.Items[1].MonthlyLei != 30 || s.Items[2].MonthlyLei != 195.0/12 {
		t.Errorf("stiri = %v %+v", got, s.Items)
	}
	money.FuelLei = 0
	if s := Stiri(news, money); s.Items[2].ID != "motorina" {
		t.Errorf("no car: fuel should be last, got %s", s.Items[2].ID)
	}
}

// The same cases run in the frontend (scoring.test.ts), so both sides place people the same way.
func TestPlacement(t *testing.T) {
	raw, err := os.ReadFile("testdata/placement.json")
	if err != nil {
		t.Fatal(err)
	}
	var data struct {
		Cases []struct {
			Name    string            `json:"name"`
			Answers []json.RawMessage `json:"answers"`
			Level   domain.Level      `json:"level"`
			Asked   int               `json:"asked"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatal(err)
	}
	questions := reference.Quiz()
	tiers := make([]int, len(questions))
	for i, q := range questions {
		tiers[i] = q.Tier
	}
	for _, c := range data.Cases {
		if len(c.Answers) != len(questions) {
			t.Fatalf("%s: %d answers for %d questions", c.Name, len(c.Answers), len(questions))
		}
		right := make([]bool, len(questions))
		for i, a := range c.Answers {
			var pick int
			right[i] = json.Unmarshal(a, &pick) == nil && pick == questions[i].Correct
		}
		if got := PlaceLevel(tiers, right); got != c.Level {
			t.Errorf("%s: level %d, want %d", c.Name, got, c.Level)
		}
		asked := 0
		for i := range questions {
			if AskTier(tiers[i], tiers, right) {
				asked++
			}
		}
		if asked != c.Asked {
			t.Errorf("%s: asked %d questions, want %d", c.Name, asked, c.Asked)
		}
	}
}

func TestPlaceLevelEdges(t *testing.T) {
	if got := PlaceLevel(nil, nil); got != 0 {
		t.Errorf("no questions: %d", got)
	}
	// A third tier can't lift anyone past L2.
	if got := PlaceLevel([]int{0, 1, 2}, []bool{true, true, true}); got != 2 {
		t.Errorf("three tiers passed: %d", got)
	}
	// A tier with no questions stops the climb rather than counting as passed.
	if got := PlaceLevel([]int{0, 2}, []bool{true, true}); got != 1 {
		t.Errorf("gap in tiers: %d", got)
	}
}

// The questions must cover tiers 0 and 1 with at least two questions each, so one lucky
// guess can't pass a tier.
func TestQuizTiers(t *testing.T) {
	count := map[int]int{}
	for _, q := range reference.Quiz() {
		count[q.Tier]++
	}
	if count[0] < 2 || count[1] < 2 || len(count) != 2 {
		t.Errorf("questions per tier: %v", count)
	}
}
