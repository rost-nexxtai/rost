package server

import (
	"net/http"
	"strconv"

	"rost/backend/internal/rules"
)

func validGross(g float64) bool { return g >= minGrossLei && g <= maxGrossLei }

// PUT /api/me/salary {grossMonthly}: the user's gross salary changed, or is given for the first
// time. Answers with the new payslip, and the payslip moment reopened when it was a raise.
func (s *server) setSalary(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	var body struct {
		GrossMonthly *float64 `json:"grossMonthly"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.GrossMonthly == nil || !validGross(*body.GrossMonthly) {
		fail(w, http.StatusBadRequest, "grossMonthly must be a monthly gross salary in lei")
		return
	}
	out, err := s.svc.SetSalary(r.Context(), u, *body.GrossMonthly)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// GET /api/payslip?gross=6000: where a gross salary goes, for a preview while the user types.
// Pure arithmetic on the year's rules, so it needs no session; with one, the personal deduction
// follows the user's age band (under 26 gets the extra 15%). ?young=true asks for it without a session.
func (s *server) payslip(w http.ResponseWriter, r *http.Request) {
	gross, err := strconv.ParseFloat(r.URL.Query().Get("gross"), 64)
	if err != nil || !validGross(gross) {
		fail(w, http.StatusBadRequest, "gross must be a monthly gross salary in lei")
		return
	}
	d := rules.Deduction{Young: r.URL.Query().Get("young") == "true"}
	if id, ok := s.currentUserID(w, r); ok {
		if u, err := s.Store.GetUser(r.Context(), id); err == nil && u.Quiz != nil {
			d = rules.DeductionFor(u.AgeBand())
		}
	}
	p, err := rules.Payslip(gross, d)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}
