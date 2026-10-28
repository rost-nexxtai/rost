package server

import (
	"net/http"
	"slices"
	"time"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
)

// The monthly spending a user can give: up to a generous ceiling.
const maxExpensesLei = 200_000

// Every field is optional: only what's given changes. A zero (or "") clears a field.
type updateMeRequest struct {
	Situations []domain.Situation `json:"situations"`
	// The salary stopped (a lost job, studies again): forget it. Salary changes go to PUT /api/me/salary.
	NoSalary        bool                   `json:"noSalary"`
	Payday          *int                   `json:"payday"`
	HireDate        *string                `json:"hireDate"`
	MonthlyExpenses *float64               `json:"monthlyExpenses"`
	SpendingShares  *domain.CategoryShares `json:"spendingShares"`
}

// UserInflation is the national 12-month figure and, once the user gave a spending mix, theirs.
type UserInflation struct {
	Period      string   `json:"period"`
	HeadlinePct float64  `json:"headlinePct"`
	PersonalPct *float64 `json:"personalPct"`
}

func inflationOf(u domain.User, lang reference.Lang) UserInflation {
	cpi := reference.LatestCPI(lang)
	out := UserInflation{Period: cpi.Period, HeadlinePct: cpi.HeadlinePct}
	if u.Spending != nil {
		if p, err := rules.PersonalInflationFor(u.Spending.Shares, cpi.GroupsPct); err == nil {
			out.PersonalPct = &p.PersonalPct
		}
	}
	return out
}

// PATCH /api/me: the user corrects their own numbers (Profil → "Banii tăi"). Answers with the
// user and their inflation, so the app can redraw everything that reads them.
func (s *server) updateMe(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	var body updateMeRequest
	if !readJSON(w, r, &body) {
		return
	}
	if body.Situations != nil {
		if len(body.Situations) == 0 {
			fail(w, http.StatusBadRequest, "pick at least one situation")
			return
		}
		for _, sit := range body.Situations {
			if !slices.Contains(situations, sit) {
				fail(w, http.StatusBadRequest, "unknown situation")
				return
			}
		}
		u.Situations = body.Situations
	}
	if body.NoSalary {
		u.GrossMonthly = nil
	}
	if body.Payday != nil {
		switch d := *body.Payday; {
		case d == 0:
			u.Payday = nil
		case d >= 1 && d <= 31:
			u.Payday = &d
		default:
			fail(w, http.StatusBadRequest, "payday must be a day of the month, 1 to 31")
			return
		}
	}
	if body.HireDate != nil {
		if *body.HireDate == "" {
			u.HireDate = nil
		} else if _, err := time.Parse("2006-01-02", *body.HireDate); err != nil {
			fail(w, http.StatusBadRequest, "hireDate must be YYYY-MM-DD")
			return
		} else {
			u.HireDate = body.HireDate
		}
	}
	if body.MonthlyExpenses != nil {
		switch e := *body.MonthlyExpenses; {
		case e == 0:
			u.MonthlyExpenses = nil
		case e > 0 && e <= maxExpensesLei:
			u.MonthlyExpenses = &e
		default:
			fail(w, http.StatusBadRequest, "monthlyExpenses must be monthly spending in lei")
			return
		}
	}
	if sh := body.SpendingShares; sh != nil {
		if sh.Services < 0 || sh.NonFood < 0 || sh.Food < 0 || !(sh.Services+sh.NonFood+sh.Food > 0) {
			fail(w, http.StatusBadRequest, "spendingShares must be three shares, at least one above 0")
			return
		}
		sp := domain.SpendingProfile{}
		if u.Spending != nil {
			sp = *u.Spending
		}
		sp.Shares, sp.Source = *sh, "user"
		u.Spending = &sp
	}
	if err := s.Store.UpdateUser(r.Context(), u); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": u, "inflation": inflationOf(u, langOf(r))})
}
