// Package learning: quiz, levels, risk, Momente/Știri order.
// same rules as frontend/src/data/mock
package learning

import (
	"math"
	"slices"
	"sort"

	"rost/backend/internal/content"
	"rost/backend/internal/domain"
)

var (
	AgeBands = []string{"sub_25", "25_29", "30_plus"}
	Horizons = []string{"sub_1_an", "1_3_ani", "peste_3_ani"}
)

// Placement is the quiz level. Questions come two per level; you place at a level only if you got
// every question of the levels below it right and at least one of its own. Scoring by count let
// 1 in 4 people guess their way to L1; this way a guess rarely skips a level (1 in 16 to L1).
// right[i] is whether question i, at levels[i], was answered right ("nu știu" is wrong).
func Placement(levels []domain.Level, right []bool) domain.Level {
	placed := domain.Level(0)
	for l := domain.Level(1); l <= 2; l++ {
		below, own := true, false
		for i, ql := range levels {
			switch {
			case ql < l && !right[i]:
				below = false
			case ql == l && right[i]:
				own = true
			}
		}
		if !below || !own {
			break
		}
		placed = l
	}
	return placed
}

// Passed: a lesson counts toward the next level only with at least 2 of 3 graded screens right.
// A lesson with nothing graded passes by finishing it.
func Passed(correct, total int) bool { return total == 0 || correct*3 >= total*2 }

type RiskInput struct {
	Level         domain.Level
	AgeBand       string
	Horizon       string
	BufferMonths  float64
	ExpensiveDebt bool
}

// Risk follows the level (L0 prudent, L1 echilibrat, L2 dinamic), then the horizon/buffer/debt caps.
// Age doesn't add risk: being young says nothing about knowing what you buy.
func Risk(in RiskInput) domain.RiskProfile {
	if in.Horizon == "sub_1_an" {
		return domain.RiskPrudent
	}
	raw := domain.RiskEchilibrat
	switch in.Level {
	case 0:
		raw = domain.RiskPrudent
	case 2:
		raw = domain.RiskDinamic
	}
	if raw == domain.RiskDinamic && (in.BufferMonths < 3 || in.ExpensiveDebt) {
		return domain.RiskEchilibrat
	}
	return raw
}

// only lessons with steps count
func CoreByLevel(moments []domain.LibraryMoment) map[domain.Level][]string {
	core := map[domain.Level][]string{0: {}, 1: {}, 2: {}}
	for _, m := range moments {
		if m.Core && m.Playable() {
			core[m.Level] = append(core[m.Level], m.ID)
		}
	}
	return core
}

// empty level doesn't unlock the next one
func LevelWithMoments(quizLevel domain.Level, core map[domain.Level][]string, completed []string) domain.Level {
	done := func(l domain.Level) bool {
		ids := core[l]
		return len(ids) > 0 && !slices.ContainsFunc(ids, func(id string) bool { return !slices.Contains(completed, id) })
	}
	earned := domain.Level(0)
	if done(0) {
		earned = 1
		if done(1) {
			earned = 2
		}
	}
	return max(quizLevel, earned)
}

// nil before the quiz. completed = the lessons passed (see Passed).
func BuildProfile(u domain.User, completed []string, core map[domain.Level][]string, inflationPct float64) *domain.Profile {
	q := u.Quiz
	if q == nil {
		return nil
	}
	if completed == nil {
		completed = []string{}
	}
	level := max(LevelWithMoments(q.Level, core, completed), u.LevelEarned)
	return &domain.Profile{
		Name:      u.Name,
		QuizScore: q.Score,
		QuizLevel: q.Level,
		Level:     level,
		RiskProfile: Risk(RiskInput{
			Level: level, AgeBand: q.AgeBand, Horizon: q.Horizon, BufferMonths: q.BufferMonths, ExpensiveDebt: q.ExpensiveDebt,
		}),
		AgeBand:       q.AgeBand,
		Situation:     q.Situation,
		BufferMonths:  q.BufferMonths,
		ExpensiveDebt: q.ExpensiveDebt,
		Horizon:       q.Horizon,
		Money: domain.MoneyLines{
			FuelLei: q.FuelLei, ElectricityLei: q.ElectricityLei, SavedLei: q.SavedLei, InflationPct: inflationPct,
		},
		CompletedMomentIDs: completed,
	}
}

// ---- library answers ----

// picked for choice, value for predict, buckets for sort (one per item)
type Answer struct {
	Step    int      `json:"step"`
	Picked  *int     `json:"picked,omitempty"`
	Value   *float64 `json:"value,omitempty"`
	Buckets []int    `json:"buckets,omitempty"`
}

func num(step domain.LibraryStep, key string) float64 {
	v, _ := step[key].(float64)
	return v
}

// ok=false if an answer doesn't fit its step
func ScoreAnswers(m domain.LibraryMoment, answers []Answer) (correct, total int, ok bool) {
	for _, s := range m.Steps {
		if content.IsGraded(s) {
			total++
		}
	}
	seen := map[int]bool{}
	for _, a := range answers {
		if a.Step < 0 || a.Step >= len(m.Steps) || seen[a.Step] {
			return 0, 0, false
		}
		seen[a.Step] = true
		step := m.Steps[a.Step]
		switch step["type"] {
		case "choice":
			if a.Picked == nil || a.Value != nil || a.Buckets != nil {
				return 0, 0, false
			}
			if float64(*a.Picked) == num(step, "correct") {
				correct++
			}
		case "predict":
			if a.Value == nil || a.Picked != nil || a.Buckets != nil {
				return 0, 0, false
			}
			// close enough, or inside the step's acceptRange, counts, like in the app
			if content.PredictRight(step, *a.Value) {
				correct++
			}
		case "sort":
			items, _ := step["items"].([]any)
			if a.Buckets == nil || len(a.Buckets) != len(items) || a.Picked != nil || a.Value != nil {
				return 0, 0, false
			}
			right := true
			for i, it := range items {
				item, _ := it.(map[string]any)
				right = right && float64(a.Buckets[i]) == num(item, "bucket")
			}
			if right {
				correct++
			}
		default:
			return 0, 0, false
		}
	}
	return correct, total, true
}

// ---- Momente ----

type MomentSummary struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	// library lessons only
	Hook   string `json:"hook,omitempty"`
	Series string `json:"series"`
	// nil for triggered moments
	Level   *domain.Level `json:"level"`
	Core    bool          `json:"core"`
	Minutes int           `json:"minutes"`
	// open | done | todo | soon
	Status          string `json:"status"`
	Href            string `json:"href,omitempty"`
	CatchUpMomentID string `json:"catchUpMomentId,omitempty"`
}

type Progress struct {
	Level     domain.Level  `json:"level"`
	CoreDone  int           `json:"coreDone"`
	CoreTotal int           `json:"coreTotal"`
	NextLevel *domain.Level `json:"nextLevel"`
}

// GET /api/momente
type MomenteResponse struct {
	Triggered    []MomentSummary `json:"triggered"`
	ForYourLevel []MomentSummary `json:"forYourLevel"`
	Rest         []MomentSummary `json:"rest"`
	Progress     Progress        `json:"progress"`
	DueFollowUps []domain.Action `json:"dueFollowUps"`
	RealAPIDown  bool            `json:"realApiDown"`
}

type TriggeredMoment struct {
	ID, Title, Series string
	Minutes           int
}

// same data as /api/today
type TriggeredState struct {
	Defs         []TriggeredMoment
	Open         []domain.MomentRun
	DoneIDs      []string
	CatchUpIDs   []string
	DueFollowUps []domain.Action
}

func librarySummary(m domain.LibraryMoment, done bool) MomentSummary {
	s := MomentSummary{ID: m.ID, Title: m.Title, Hook: m.Hook, Series: m.Series, Level: &m.Level, Core: m.Core, Minutes: m.Minutes, Status: "todo"}
	switch {
	case done:
		s.Status = "done"
	case !m.Playable():
		s.Status = "soon"
	}
	if s.Status != "soon" {
		s.Href = "/moment/lib/" + m.ID
	}
	return s
}

// triggered, then my level (+ lower ones not done), then the rest
func Momente(p domain.Profile, library []domain.LibraryMoment, core map[domain.Level][]string, t TriggeredState) MomenteResponse {
	def := func(id string) TriggeredMoment {
		for _, d := range t.Defs {
			if d.ID == id {
				return d
			}
		}
		return TriggeredMoment{ID: id, Title: id, Minutes: 3}
	}
	out := MomenteResponse{Triggered: []MomentSummary{}, ForYourLevel: []MomentSummary{}, Rest: []MomentSummary{}, DueFollowUps: t.DueFollowUps}
	if out.DueFollowUps == nil {
		out.DueFollowUps = []domain.Action{}
	}
	for _, run := range t.Open {
		d := def(run.MomentID)
		out.Triggered = append(out.Triggered, MomentSummary{
			ID: run.MomentID, Title: d.Title, Series: d.Series, Minutes: d.Minutes, Status: "open", Href: "/moment/" + run.ID,
		})
	}

	done := func(id string) bool { return slices.Contains(p.CompletedMomentIDs, id) }
	mine := []domain.LibraryMoment{}
	for _, m := range library {
		if m.Level <= p.Level && !done(m.ID) {
			mine = append(mine, m)
		}
	}
	sort.SliceStable(mine, func(i, j int) bool { return mine[i].Level > mine[j].Level })
	for _, m := range mine {
		out.ForYourLevel = append(out.ForYourLevel, librarySummary(m, false))
	}
	for _, m := range library {
		if m.Level > p.Level || done(m.ID) {
			out.Rest = append(out.Rest, librarySummary(m, done(m.ID)))
		}
	}
	openIDs := map[string]bool{}
	for _, r := range t.Open {
		openIDs[r.MomentID] = true
	}
	for _, d := range t.Defs {
		isDone, catchUp := slices.Contains(t.DoneIDs, d.ID), slices.Contains(t.CatchUpIDs, d.ID)
		if openIDs[d.ID] || (!isDone && !catchUp) {
			continue
		}
		s := MomentSummary{ID: d.ID, Title: d.Title, Series: d.Series, Minutes: d.Minutes, Status: "todo", CatchUpMomentID: d.ID}
		if isDone {
			s.Status, s.CatchUpMomentID = "done", ""
		}
		out.Rest = append(out.Rest, s)
	}

	coreHere := core[p.Level]
	out.Progress = Progress{Level: p.Level, CoreTotal: len(coreHere)}
	for _, id := range coreHere {
		if done(id) {
			out.Progress.CoreDone++
		}
	}
	if p.Level < 2 {
		next := p.Level + 1
		out.Progress.NextLevel = &next
	}
	return out
}

// ---- Știri ----

type StiriItem struct {
	domain.NewsItem
	MonthlyLei float64 `json:"monthlyLei"`
}

// GET /api/stiri
type StiriResponse struct {
	Items []StiriItem       `json:"items"`
	Money domain.MoneyLines `json:"money"`
}

// like Math.round in JS, so numbers match the frontend
func jsRound(x float64) float64 { return math.Floor(x + 0.5) }

// lei/month this news costs the user
func MonthlyLei(n domain.NewsItem, m domain.MoneyLines) float64 {
	if n.Impact.Kind == "spend" && n.Impact.Shock != nil {
		spend := m.FuelLei
		if n.Impact.Line == "electricityLei" {
			spend = m.ElectricityLei
		}
		return jsRound(spend * n.Impact.Shock.DefaultPct / 100)
	}
	loss := jsRound(m.SavedLei * (1/(1+m.InflationPct/100) - 1))
	return math.Abs(loss) / 12
}

func Stiri(news []domain.NewsItem, money domain.MoneyLines) StiriResponse {
	items := make([]StiriItem, 0, len(news))
	for _, n := range news {
		items = append(items, StiriItem{n, MonthlyLei(n, money)})
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].MonthlyLei > items[j].MonthlyLei })
	return StiriResponse{Items: items, Money: money}
}
