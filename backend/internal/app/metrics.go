package app

import (
	"context"

	"rost/backend/internal/domain"
	"rost/backend/internal/rules"
)

type MomentCounts struct {
	Opened    int `json:"opened"`
	Completed int `json:"completed"`
}

type PayslipGuess struct {
	Count             int     `json:"count"`
	AvgGuess          float64 `json:"avgGuess"`
	AvgActual         float64 `json:"avgActual"`
	UnderGuessedShare float64 `json:"underGuessedShare"`
}

type Metrics struct {
	Moments map[string]MomentCounts `json:"moments"`
	Actions struct {
		Set       int `json:"set"`
		Confirmed int `json:"confirmed"`
		Skipped   int `json:"skipped"`
	} `json:"actions"`
	// Confirmed actions / completed moments. The north-star input.
	ActionRate   float64       `json:"actionRate"`
	PayslipGuess *PayslipGuess `json:"payslipGuess,omitempty"`
	Referrals    struct {
		Clicked int     `json:"clicked"`
		Opened  int     `json:"opened"`
		Funded  int     `json:"funded"`
		FeesLei float64 `json:"feesLei"`
	} `json:"referrals"`
}

func toNumber(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int:
		return float64(x), true
	}
	return 0, false
}

// Metrics aggregates the whole instance. No per-user data leaves this function.
func (s Service) Metrics(ctx context.Context) (Metrics, error) {
	var m Metrics
	m.Moments = map[string]MomentCounts{}
	runs, err := s.Store.ListRuns(ctx, "")
	if err != nil {
		return m, err
	}
	actions, err := s.Store.ListActions(ctx, "")
	if err != nil {
		return m, err
	}
	refs, err := s.Store.ListReferrals(ctx)
	if err != nil {
		return m, err
	}

	completed := 0
	var guessSum, actualSum float64
	guesses, under := 0, 0
	for _, r := range runs {
		c := m.Moments[r.MomentID]
		c.Opened++
		if r.State == domain.RunCompleted {
			c.Completed++
			completed++
		}
		m.Moments[r.MomentID] = c

		if answer, ok := toNumber(r.Result["answer"]); ok && r.MomentID == "payslip_explained" && r.Guess != nil {
			guesses++
			guessSum += *r.Guess
			actualSum += answer
			if *r.Guess < answer {
				under++
			}
		}
	}
	for _, a := range actions {
		switch a.Status {
		case domain.ActionSet:
			m.Actions.Set++
		case domain.ActionConfirmed:
			m.Actions.Confirmed++
		case domain.ActionSkipped:
			m.Actions.Skipped++
		}
	}
	if completed > 0 {
		m.ActionRate = float64(m.Actions.Confirmed) / float64(completed)
	}
	if guesses > 0 {
		m.PayslipGuess = &PayslipGuess{
			Count:             guesses,
			AvgGuess:          rules.Round(guessSum / float64(guesses)),
			AvgActual:         rules.Round(actualSum / float64(guesses)),
			UnderGuessedShare: float64(under) / float64(guesses),
		}
	}
	for _, r := range refs {
		m.Referrals.Clicked++
		if r.Status == domain.ReferralOpened || r.Status == domain.ReferralFunded {
			m.Referrals.Opened++
		}
		if r.Status == domain.ReferralFunded {
			m.Referrals.Funded++
		}
		m.Referrals.FeesLei += r.FeeLei
	}
	return m, nil
}
