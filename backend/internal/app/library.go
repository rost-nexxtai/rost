package app

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"slices"

	"rost/backend/internal/clock"
	"rost/backend/internal/content"
	"rost/backend/internal/domain"
	"rost/backend/internal/learning"
	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
	"rost/backend/internal/store"
)

var (
	// "în curând"
	ErrNotPlayable = errors.New("moment not written yet")
	ErrBadAnswers  = errors.New("answers don't match the moment's steps")
	ErrNoProfile   = errors.New("no profile: take the quiz first")
)

// was in the today handler, momente needs it too
type TodayState struct {
	Open         []domain.MomentRun
	DoneIDs      []string
	CatchUpIDs   []string
	DueFollowUps []domain.Action
}

func (s Service) Today(ctx context.Context, userID string) (TodayState, error) {
	runs, err := s.Store.ListRuns(ctx, userID)
	if err != nil {
		return TodayState{}, err
	}
	t := TodayState{Open: []domain.MomentRun{}, DoneIDs: []string{}, CatchUpIDs: []string{}}
	openIDs, done := map[string]bool{}, map[string]bool{}
	for _, run := range runs {
		switch run.State {
		case domain.RunPending, domain.RunStarted:
			t.Open = append(t.Open, run)
			openIDs[run.MomentID] = true
		case domain.RunCompleted:
			if !done[run.MomentID] {
				done[run.MomentID] = true
				t.DoneIDs = append(t.DoneIDs, run.MomentID)
			}
		}
	}
	// Ids are the same in every language.
	for _, d := range reference.MomentDefs(reference.RO) {
		if !done[d.ID] && !openIDs[d.ID] && d.Triggers[0] != domain.ShockScenario {
			t.CatchUpIDs = append(t.CatchUpIDs, d.ID)
		}
	}
	t.DueFollowUps, err = s.DueFollowUps(ctx, userID)
	return t, err
}

// ---- library ----

func (s Service) Library(ctx context.Context) ([]domain.LibraryMoment, error) {
	items, err := s.Store.ListContent(ctx, domain.KindMoment, false)
	if err != nil {
		return nil, err
	}
	return content.Moments(items)
}

// drafts = not found
func (s Service) LibraryMoment(ctx context.Context, id string) (domain.LibraryMoment, error) {
	c, err := s.Store.GetContent(ctx, domain.KindMoment, id)
	if err != nil {
		return domain.LibraryMoment{}, err
	}
	if c.Status != domain.StatusPublished {
		return domain.LibraryMoment{}, store.ErrNotFound
	}
	ms, err := content.Moments([]domain.ContentItem{c})
	if err != nil {
		return domain.LibraryMoment{}, err
	}
	return ms[0], nil
}

func (s Service) News(ctx context.Context) ([]domain.NewsItem, error) {
	items, err := s.Store.ListContent(ctx, domain.KindNews, false)
	if err != nil {
		return nil, err
	}
	return content.News(items)
}

// personal if we know their spending
func InflationFor(u domain.User) float64 {
	cpi := reference.LatestCPI(reference.RO) // numbers only; the language just changes the source label
	if u.Spending != nil {
		if p, err := rules.PersonalInflationFor(u.Spending.Shares, cpi.GroupsPct); err == nil {
			return p.PersonalPct
		}
	}
	return cpi.HeadlinePct
}

// passedIDs are the lessons whose best attempt passed: only those count as done and toward a level.
func passedIDs(cs []domain.Completion) []string {
	ids := make([]string, 0, len(cs))
	for _, c := range cs {
		if learning.Passed(c.Correct, c.Total) {
			ids = append(ids, c.MomentID)
		}
	}
	return ids
}

// nil before the quiz
func (s Service) Profile(ctx context.Context, u domain.User) (*domain.Profile, error) {
	if u.Quiz == nil {
		return nil, nil
	}
	library, err := s.Library(ctx)
	if err != nil {
		return nil, err
	}
	done, err := s.Store.ListCompletions(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	return learning.BuildProfile(u, passedIDs(done), learning.CoreByLevel(library), InflationFor(u)), nil
}

// nil in Knowledge = "nu știu"
type QuizInput struct {
	Knowledge      []*int
	AgeBand        string
	Situation      domain.Situation
	BufferMonths   float64
	ExpensiveDebt  bool
	Horizon        string
	GrossMonthly   *float64
	FuelLei        *float64
	ElectricityLei *float64
	SavedLei       *float64
}

type QuizResult struct {
	ID           string `json:"id"`
	Correct      bool   `json:"correct"`
	CorrectIndex int    `json:"correctIndex"`
	Explain      string `json:"explain,omitempty"`
}

type QuizOutcome struct {
	User    domain.User     `json:"-"`
	Created bool            `json:"-"`
	Profile *domain.Profile `json:"profile"`
	Results []QuizResult    `json:"results"`
}

// creates the user if needed, retaking keeps progress
func (s Service) SaveQuiz(ctx context.Context, userID string, in QuizInput) (QuizOutcome, error) {
	questions := reference.Quiz()
	out := QuizOutcome{Results: make([]QuizResult, 0, len(questions))}
	score := 0
	tiers, right := make([]int, len(questions)), make([]bool, len(questions))
	for i, q := range questions {
		ok := i < len(in.Knowledge) && in.Knowledge[i] != nil && *in.Knowledge[i] == q.Correct
		if ok {
			score++
		}
		tiers[i], right[i] = q.Tier, ok
		out.Results = append(out.Results, QuizResult{ID: q.ID, Correct: ok, CorrectIndex: q.Correct, Explain: q.Explain})
	}

	u, err := s.Store.GetUser(ctx, userID)
	if userID == "" || errors.Is(err, store.ErrNotFound) {
		u, err = s.Store.CreateUser(ctx, domain.User{ID: store.NewID(), Situations: []domain.Situation{in.Situation}})
		out.Created = true
	}
	if err != nil {
		return out, err
	}
	if !slices.Contains(u.Situations, in.Situation) {
		u.Situations = append(u.Situations, in.Situation)
	}
	if in.GrossMonthly != nil {
		u.GrossMonthly = in.GrossMonthly
	}
	orZero := func(p *float64) float64 {
		if p == nil {
			return 0
		}
		return *p
	}
	u.Quiz = &domain.QuizProfile{
		Score: score, Level: learning.PlaceLevel(tiers, right), AgeBand: in.AgeBand, Situation: string(in.Situation),
		BufferMonths: in.BufferMonths, ExpensiveDebt: in.ExpensiveDebt, Horizon: in.Horizon,
		FuelLei: orZero(in.FuelLei), ElectricityLei: orZero(in.ElectricityLei), SavedLei: orZero(in.SavedLei), TakenAt: clock.NowISO(),
	}
	if err := s.Store.UpdateUser(ctx, u); err != nil {
		return out, err
	}
	out.User = u
	if out.Profile, err = s.Profile(ctx, u); err != nil {
		return out, err
	}
	events := []domain.TrackEvent{}
	if out.Created {
		events = append(events, serverEvent(u.ID, "user_created", map[string]any{"via": "quiz"}))
	}
	events = append(events, serverEvent(u.ID, "quiz_completed", map[string]any{
		"score": score, "level": out.Profile.Level, "riskProfile": out.Profile.RiskProfile, "ageBand": in.AgeBand, "situation": in.Situation,
	}))
	return out, s.Store.AddTrackEvents(ctx, events)
}

type CompleteOutcome struct {
	Profile *domain.Profile `json:"profile"`
	LevelUp bool            `json:"levelUp"`
	// true = nothing changed: an earlier attempt was as good or better
	AlreadyDone bool `json:"alreadyDone"`
	Correct     int  `json:"correct"`
	Total       int  `json:"total"`
	// Passed: at least 2 of 3 graded screens right, so the lesson counts toward the next level.
	Passed bool `json:"passed"`
}

// keeps the best attempt per user; a lesson can be retaken until it's passed
func (s Service) CompleteLibraryMoment(ctx context.Context, u domain.User, momentID string, answers []learning.Answer) (CompleteOutcome, error) {
	m, err := s.LibraryMoment(ctx, momentID)
	if err != nil {
		return CompleteOutcome{}, err
	}
	if !m.Playable() {
		return CompleteOutcome{}, ErrNotPlayable
	}
	correct, total, ok := learning.ScoreAnswers(m, answers)
	if !ok {
		return CompleteOutcome{}, ErrBadAnswers
	}
	before, err := s.Profile(ctx, u)
	if err != nil {
		return CompleteOutcome{}, err
	}
	stored := make([]map[string]any, 0, len(answers))
	for _, a := range answers {
		row := map[string]any{"step": a.Step}
		if a.Picked != nil {
			row["picked"] = *a.Picked
		}
		if a.Value != nil {
			row["value"] = *a.Value
		}
		stored = append(stored, row)
	}
	created, err := s.Store.AddCompletion(ctx, domain.Completion{UserID: u.ID, MomentID: m.ID, Answers: stored, Correct: correct, Total: total})
	if err != nil {
		return CompleteOutcome{}, err
	}
	out := CompleteOutcome{AlreadyDone: !created, Correct: correct, Total: total, Passed: learning.Passed(correct, total)}
	if out.Profile, err = s.Profile(ctx, u); err != nil || !created {
		return out, err
	}
	if out.Profile != nil && out.Profile.Level > u.LevelEarned {
		u.LevelEarned = out.Profile.Level
		if err := s.Store.UpdateUser(ctx, u); err != nil {
			return out, err
		}
	}
	events := []domain.TrackEvent{serverEvent(u.ID, "library_completed", map[string]any{
		"momentId": m.ID, "level": m.Level, "correct": correct, "total": total, "passed": out.Passed,
	})}
	if before != nil && out.Profile.Level > before.Level {
		out.LevelUp = true
		events = append(events, serverEvent(u.ID, "level_up", map[string]any{"from": before.Level, "to": out.Profile.Level, "momentId": m.ID}))
	}
	return out, s.Store.AddTrackEvents(ctx, events)
}

func (s Service) Momente(ctx context.Context, u domain.User, lang reference.Lang) (learning.MomenteResponse, error) {
	p, err := s.Profile(ctx, u)
	if err != nil {
		return learning.MomenteResponse{}, err
	}
	if p == nil {
		return learning.MomenteResponse{}, ErrNoProfile
	}
	library, err := s.Library(ctx)
	if err != nil {
		return learning.MomenteResponse{}, err
	}
	for i := range library {
		library[i] = content.Localize(library[i], string(lang))
	}
	today, err := s.Today(ctx, u.ID)
	if err != nil {
		return learning.MomenteResponse{}, err
	}
	defs := []learning.TriggeredMoment{}
	for _, d := range reference.MomentDefs(lang) {
		defs = append(defs, learning.TriggeredMoment{ID: d.ID, Title: d.Title, Series: d.Series, Minutes: d.Minutes})
	}
	return learning.Momente(*p, library, learning.CoreByLevel(library), learning.TriggeredState{
		Defs: defs, Open: today.Open, DoneIDs: today.DoneIDs, CatchUpIDs: today.CatchUpIDs, DueFollowUps: today.DueFollowUps,
	}), nil
}

func (s Service) Stiri(ctx context.Context, u domain.User) (learning.StiriResponse, error) {
	p, err := s.Profile(ctx, u)
	if err != nil {
		return learning.StiriResponse{}, err
	}
	if p == nil {
		return learning.StiriResponse{}, ErrNoProfile
	}
	news, err := s.News(ctx)
	if err != nil {
		return learning.StiriResponse{}, err
	}
	return learning.Stiri(news, p.Money), nil
}

// UpgradeSeededLessons brings lessons already in the database up to date with the seed, on start:
// a lesson nobody has edited since the seed gets the seed's current version; a lesson an admin
// edited only gets the seed's English text, and only when it has none and the text fits the
// lesson's current shape. Admin edits are never overwritten. Returns how many lessons changed.
func (s Service) UpgradeSeededLessons(ctx context.Context, seed []domain.ContentItem) (int, error) {
	changed := 0
	for _, want := range seed {
		if want.Kind != domain.KindMoment {
			continue
		}
		have, err := s.Store.GetContent(ctx, want.Kind, want.ID)
		if errors.Is(err, store.ErrNotFound) {
			continue
		}
		if err != nil {
			return changed, err
		}
		doc, ok, err := upgradedDoc(have, want)
		if err != nil || !ok {
			if err != nil {
				return changed, err
			}
			continue
		}
		have.Doc = doc
		if _, err := s.Store.UpdateContent(ctx, have); err != nil {
			return changed, err
		}
		changed++
	}
	return changed, nil
}

func upgradedDoc(have, want domain.ContentItem) ([]byte, bool, error) {
	ms, err := content.Moments([]domain.ContentItem{have, want})
	if err != nil {
		return nil, false, err
	}
	current, seeded := ms[0], ms[1]
	if have.UpdatedBy == "seed" {
		// Postgres stores JSON in its own key order, so compare the content, not the text.
		if sameJSON(have.Doc, want.Doc) {
			return nil, false, nil
		}
		return want.Doc, true, nil
	}
	if current.EN != nil || seeded.EN == nil {
		return nil, false, nil
	}
	current.EN = seeded.EN
	_, doc, err := content.Validate(domain.KindMoment, mustJSON(current))
	if err != nil {
		// the admin changed the lesson's shape; it stays Romanian until someone translates it
		return nil, false, nil
	}
	return doc, true, nil
}

func sameJSON(a, b []byte) bool {
	var x, y any
	return json.Unmarshal(a, &x) == nil && json.Unmarshal(b, &y) == nil && reflect.DeepEqual(x, y)
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
