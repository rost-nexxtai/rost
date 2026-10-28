package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"

	"rost/backend/internal/app"
	"rost/backend/internal/content"
	"rost/backend/internal/domain"
	"rost/backend/internal/learning"
	"rost/backend/internal/reference"
)

func (s *server) libraryRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/quiz", s.getQuiz)
	mux.HandleFunc("POST /api/quiz", s.postQuiz)

	mux.HandleFunc("GET /api/library", s.library)
	mux.HandleFunc("GET /api/library/{id}", s.libraryMoment)
	mux.HandleFunc("POST /api/library/{id}/complete", s.completeLibraryMoment)

	mux.HandleFunc("GET /api/momente", s.momente)
	mux.HandleFunc("GET /api/stiri", s.stiri)

	mux.HandleFunc("POST /api/track", s.track)
}

// empty body is ok here
func readOptionalJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v)
	if err != nil && !errors.Is(err, io.EOF) {
		fail(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

// ---- quiz ----

type quizQuestion struct {
	ID       string   `json:"id"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

// no answers in here
func (s *server) getQuiz(w http.ResponseWriter, r *http.Request) {
	out := []quizQuestion{}
	for _, q := range reference.Quiz() {
		out = append(out, quizQuestion{q.ID, q.Question, q.Options})
	}
	writeJSON(w, http.StatusOK, map[string]any{"knowledge": out})
}

// knowledge: option index or "nu_stiu"
type quizRequest struct {
	Knowledge      []json.RawMessage `json:"knowledge"`
	AgeBand        string            `json:"ageBand"`
	Situation      domain.Situation  `json:"situation"`
	BufferMonths   *float64          `json:"bufferMonths"`
	ExpensiveDebt  *bool             `json:"expensiveDebt"`
	Horizon        string            `json:"horizon"`
	GrossMonthly   *float64          `json:"grossMonthly"`
	FuelLei        *float64          `json:"fuelLei"`
	ElectricityLei *float64          `json:"electricityLei"`
	SavedLei       *float64          `json:"savedLei"`
}

var situations = []domain.Situation{domain.Student, domain.Graduate, domain.Employed, domain.Freelance, domain.BetweenJobs}

func (q quizRequest) input() (app.QuizInput, string) {
	questions := reference.Quiz()
	if len(q.Knowledge) != len(questions) {
		return app.QuizInput{}, "knowledge needs one answer per question"
	}
	in := app.QuizInput{
		AgeBand: q.AgeBand, Situation: q.Situation, Horizon: q.Horizon,
		GrossMonthly: q.GrossMonthly, FuelLei: q.FuelLei, ElectricityLei: q.ElectricityLei, SavedLei: q.SavedLei,
	}
	for i, raw := range q.Knowledge {
		var pick int
		var word string
		switch {
		case json.Unmarshal(raw, &word) == nil && word == "nu_stiu":
			in.Knowledge = append(in.Knowledge, nil)
		case json.Unmarshal(raw, &pick) == nil && pick >= 0 && pick < len(questions[i].Options):
			in.Knowledge = append(in.Knowledge, &pick)
		default:
			return in, "each knowledge answer must be an option index or \"nu_stiu\""
		}
	}
	switch {
	case !slices.Contains(learning.AgeBands, q.AgeBand):
		return in, "unknown ageBand"
	case !slices.Contains(situations, q.Situation):
		return in, "unknown situation"
	case !slices.Contains(learning.Horizons, q.Horizon):
		return in, "unknown horizon"
	case q.BufferMonths == nil || *q.BufferMonths < 0 || *q.BufferMonths > 120:
		return in, "bufferMonths must be between 0 and 120"
	}
	for _, v := range []*float64{q.GrossMonthly, q.FuelLei, q.ElectricityLei, q.SavedLei} {
		if v != nil && !(*v >= 0 && *v < 1e9) {
			return in, "amounts must be 0 or more"
		}
	}
	in.BufferMonths = *q.BufferMonths
	if q.ExpensiveDebt != nil {
		in.ExpensiveDebt = *q.ExpensiveDebt
	}
	return in, ""
}

// scored here, not in the browser
func (s *server) postQuiz(w http.ResponseWriter, r *http.Request) {
	var body quizRequest
	if !readJSON(w, r, &body) {
		return
	}
	// not asked at onboarding anymore, same default as the frontend
	if body.Horizon == "" {
		body.Horizon = "1_3_ani"
	}
	in, problem := body.input()
	if problem != "" {
		fail(w, http.StatusBadRequest, problem)
		return
	}
	userID, _ := currentUserID(r)
	out, err := s.svc.SaveQuiz(r.Context(), userID, in)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	if out.Created {
		setUserID(w, out.User.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"userId": out.User.ID, "profile": out.Profile, "results": out.Results})
}

// ---- library ----

func (s *server) library(w http.ResponseWriter, r *http.Request) {
	moments, err := s.svc.Library(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	for i := range moments {
		moments[i] = content.Localize(moments[i], string(langOf(r)))
	}
	writeJSON(w, http.StatusOK, map[string]any{"moments": moments})
}

func (s *server) libraryMoment(w http.ResponseWriter, r *http.Request) {
	m, err := s.svc.LibraryMoment(r.Context(), r.PathValue("id"))
	if isNotFound(err) {
		fail(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"moment": content.Localize(m, string(langOf(r)))})
}

// safe to call twice
func (s *server) completeLibraryMoment(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	var body struct {
		Answers []learning.Answer `json:"answers"`
	}
	if !readOptionalJSON(w, r, &body) {
		return
	}
	out, err := s.svc.CompleteLibraryMoment(r.Context(), u, r.PathValue("id"), body.Answers)
	switch {
	case isNotFound(err):
		fail(w, http.StatusNotFound, "not found")
	case errors.Is(err, app.ErrNotPlayable):
		fail(w, http.StatusConflict, err.Error())
	case errors.Is(err, app.ErrBadAnswers):
		fail(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.internal(w, r, err)
	default:
		writeJSON(w, http.StatusOK, out)
	}
}

// 404 before the quiz
func (s *server) momente(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	out, err := s.svc.Momente(r.Context(), u, langOf(r))
	if errors.Is(err, app.ErrNoProfile) {
		fail(w, http.StatusNotFound, "no profile")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// 404 before the quiz
func (s *server) stiri(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	out, err := s.svc.Stiri(r.Context(), u)
	if errors.Is(err, app.ErrNoProfile) {
		fail(w, http.StatusNotFound, "no profile")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ---- tracking ----

// works before onboarding too
func (s *server) track(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Events []app.TrackInput `json:"events"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	var userID *string
	if id, ok := currentUserID(r); ok {
		if _, err := s.Store.GetUser(r.Context(), id); err == nil {
			userID = &id
		} else if !isNotFound(err) {
			s.internal(w, r, err)
			return
		}
	}
	err := s.svc.Track(r.Context(), userID, body.Events)
	var bad app.ErrBadTrack
	if errors.As(err, &bad) {
		fail(w, http.StatusBadRequest, bad.Msg)
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]int{"accepted": len(body.Events)})
}
