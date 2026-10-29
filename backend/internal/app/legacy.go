package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/learning"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
)

// LegacyProfile is the profile the web app kept in the rost_profile cookie before the profile lived
// here (frontend Profile on main). Fields it had that the server works out itself (riskProfile,
// money.inflationPct) or drops (lessonProgress: no raw answers, so a resumed lesson would be scored
// short) are ignored.
type LegacyProfile struct {
	QuizScore     *int     `json:"quizScore"`
	QuizLevel     *int     `json:"quizLevel"`
	Level         *int     `json:"level"`
	AgeBand       string   `json:"ageBand"`
	Situation     string   `json:"situation"`
	BufferMonths  *float64 `json:"bufferMonths"`
	ExpensiveDebt *bool    `json:"expensiveDebt"`
	Horizon       string   `json:"horizon"`
	Money         *struct {
		FuelLei        *float64 `json:"fuelLei"`
		ElectricityLei *float64 `json:"electricityLei"`
		SavedLei       *float64 `json:"savedLei"`
		Known          []string `json:"known"`
		ExpensesLei    *float64 `json:"expensesLei"`
	} `json:"money"`
	CompletedMomentIDs []string `json:"completedMomentIds"`
	LearnedDays        []string `json:"learnedDays"`
}

// ErrBadImport: the cookie isn't a profile the old app could have written.
type ErrBadImport struct{ Msg string }

func (e ErrBadImport) Error() string { return e.Msg }

// ErrHasProfile: the user took the quiz already; an import never overwrites it.
var ErrHasProfile = errors.New("this user has a profile already")

// Situations a user can be in (the quiz's options).
var Situations = []domain.Situation{domain.Student, domain.Graduate, domain.Employed, domain.Freelance, domain.BetweenJobs}

var moneyLines = []string{"fuelLei", "electricityLei", "savedLei"}

// at most this many lessons in one import, well above the library's size
const maxImportedLessons = 200

func isLevel(p *int) bool { return p != nil && *p >= 0 && *p <= 2 }

func amount(p *float64) bool { return p != nil && *p >= 0 && *p < 1e9 }

// check says what's wrong with the cookie, "" when it's fine.
func (p LegacyProfile) check() string {
	m := p.Money
	switch {
	case p.QuizScore == nil || *p.QuizScore < 0 || *p.QuizScore > len(reference.Quiz()):
		return "quizScore out of range"
	case !isLevel(p.QuizLevel) || !isLevel(p.Level):
		return "level and quizLevel must be 0, 1 or 2"
	case !slices.Contains(learning.AgeBands, p.AgeBand):
		return "unknown ageBand"
	case !slices.Contains(Situations, domain.Situation(p.Situation)):
		return "unknown situation"
	case !slices.Contains(learning.Horizons, p.Horizon):
		return "unknown horizon"
	case p.BufferMonths == nil || *p.BufferMonths < 0 || *p.BufferMonths > 120:
		return "bufferMonths must be between 0 and 120"
	case p.ExpensiveDebt == nil:
		return "expensiveDebt is missing"
	case m == nil || !amount(m.FuelLei) || !amount(m.ElectricityLei) || !amount(m.SavedLei):
		return "money lines must be 0 or more"
	case m.ExpensesLei != nil && !(*m.ExpensesLei > 0 && *m.ExpensesLei < 1e9):
		return "expensesLei must be more than 0"
	case slices.ContainsFunc(m.Known, func(l string) bool { return !slices.Contains(moneyLines, l) }):
		return "unknown money line in known"
	case p.CompletedMomentIDs == nil || len(p.CompletedMomentIDs) > maxImportedLessons:
		return "completedMomentIds must be a list of lessons"
	}
	for _, d := range p.LearnedDays {
		if _, err := time.Parse("2006-01-02", d); err != nil {
			return "learnedDays must be YYYY-MM-DD days"
		}
	}
	return ""
}

// ImportOutcome: Created says the import made the user (there was no session).
type ImportOutcome struct {
	User    domain.User
	Created bool
}

// ImportLegacyProfile moves a profile from the old cookie to userID, once: only while the user has
// no quiz, never over one (ErrHasProfile). With userID "" it makes the user, like the quiz does.
// Lessons count as passed, marked as imported; ids that aren't playable lessons are left out.
func (s Service) ImportLegacyProfile(ctx context.Context, userID string, p LegacyProfile) (ImportOutcome, error) {
	if p.Horizon == "" {
		p.Horizon = "1_3_ani" // the default the old app saved, like POST /api/quiz
	}
	if msg := p.check(); msg != "" {
		return ImportOutcome{}, ErrBadImport{msg}
	}
	library, err := s.Library(ctx)
	if err != nil {
		return ImportOutcome{}, err
	}
	playable := map[string]bool{}
	for _, m := range library {
		playable[m.ID] = m.Playable()
	}

	out := ImportOutcome{}
	u, err := s.Store.GetUser(ctx, userID)
	if userID == "" || errors.Is(err, store.ErrNotFound) {
		u, err = s.Store.CreateUser(ctx, domain.User{ID: store.NewID(), Situations: []domain.Situation{}})
		out.Created = true
	}
	if err != nil {
		return out, err
	}
	if u.Quiz != nil {
		return out, ErrHasProfile
	}

	situation := domain.Situation(p.Situation)
	if !slices.Contains(u.Situations, situation) {
		u.Situations = append(u.Situations, situation)
	}
	m := p.Money
	u.Quiz = &domain.QuizProfile{
		Score: *p.QuizScore, Level: domain.Level(*p.QuizLevel), AgeBand: p.AgeBand, Situation: p.Situation,
		BufferMonths: *p.BufferMonths, ExpensiveDebt: *p.ExpensiveDebt, Horizon: p.Horizon,
		FuelLei: *m.FuelLei, ElectricityLei: *m.ElectricityLei, SavedLei: *m.SavedLei, TakenAt: clock.NowISO(),
	}
	for _, line := range m.Known {
		u.Quiz.Known = withLine(u.Quiz.Known, line)
	}
	if u.MonthlyExpenses == nil && m.ExpensesLei != nil {
		u.MonthlyExpenses = m.ExpensesLei
	}
	// the old app worked the level out with the same rules
	u.LevelEarned = max(u.LevelEarned, domain.Level(*p.Level))
	if len(p.LearnedDays) > 0 {
		l := domain.Learning{}
		if u.Learning != nil {
			l = *u.Learning
		}
		for _, d := range p.LearnedDays {
			l.LearnedDays = learning.WithDay(l.LearnedDays, d)
		}
		u.Learning = &l
	}
	if err := s.Store.UpdateUser(ctx, u); err != nil {
		return out, err
	}
	out.User = u

	done, err := s.Store.ListCompletions(ctx, u.ID)
	if err != nil {
		return out, err
	}
	passed := passedIDs(done)
	for _, id := range p.CompletedMomentIDs {
		if !playable[id] || slices.Contains(passed, id) {
			continue
		}
		// no answers were kept: one graded screen, right, so it counts as passed (learning.Passed)
		c := domain.Completion{UserID: u.ID, MomentID: id, Answers: []map[string]any{{"imported": true}}, Correct: 1, Total: 1}
		if _, err := s.Store.AddCompletion(ctx, c); err != nil {
			return out, err
		}
		passed = append(passed, id)
	}

	events := []domain.TrackEvent{}
	if out.Created {
		events = append(events, serverEvent(u.ID, "user_created", map[string]any{"via": "import"}))
	}
	events = append(events, serverEvent(u.ID, "profile_imported", map[string]any{"level": *p.Level, "lessons": len(passed)}))
	return out, s.Store.AddTrackEvents(ctx, events)
}
