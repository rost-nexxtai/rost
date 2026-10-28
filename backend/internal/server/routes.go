package server

import (
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"time"

	"rost/backend/internal/app"
	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/moments"
	"rost/backend/internal/partner"
	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
	"rost/backend/internal/views"
)

func (s *server) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "mode": "db"})
	})

	mux.HandleFunc("POST /api/users", s.createUser)
	mux.HandleFunc("DELETE /api/users", s.signOut)
	mux.HandleFunc("GET /api/me", s.me)

	mux.HandleFunc("POST /api/events", s.fireEvent)
	mux.HandleFunc("POST /api/calendar", s.runCalendar)
	mux.HandleFunc("GET /api/clock", s.getClock)
	mux.HandleFunc("POST /api/clock", s.setClock)
	mux.HandleFunc("POST /api/demo/reset", s.resetDemo)

	mux.HandleFunc("GET /api/today", s.today)
	mux.HandleFunc("GET /api/moments/{runId}", s.getMoment)
	mux.HandleFunc("POST /api/moments/{runId}", s.postMoment)
	mux.HandleFunc("GET /api/followups", s.followUps)
	mux.HandleFunc("POST /api/followups", s.answerFollowUp)

	mux.HandleFunc("GET /api/options", s.options)
	mux.HandleFunc("GET /api/providers", s.allProviders)
	mux.HandleFunc("GET /api/providers/{assetId}", s.assetProviders)

	mux.HandleFunc("POST /api/referrals/clicks", s.referralClick)
	mux.HandleFunc("POST /api/referrals/postback", s.referralPostback)
	mux.HandleFunc("GET /api/referrals/{clickId}", s.referral)

	mux.HandleFunc("GET /api/partner/demo-token", s.demoToken)
	mux.HandleFunc("GET /api/embed", s.embed)

	mux.HandleFunc("GET /api/metrics", s.metrics)
	mux.HandleFunc("POST /api/payslip/read", s.readPayslip)

	s.libraryRoutes(mux)
	s.adminRoutes(mux)
}

// ---- users and session ----

type createUserRequest struct {
	Demo            string                  `json:"demo"`
	Name            *string                 `json:"name"`
	Situations      []domain.Situation      `json:"situations"`
	Payday          *int                    `json:"payday"`
	HireDate        *string                 `json:"hireDate"`
	GrossMonthly    *float64                `json:"grossMonthly"`
	MonthlyExpenses *float64                `json:"monthlyExpenses"`
	FirstsDone      []domain.FirstDone      `json:"firstsDone"`
	Spending        *domain.SpendingProfile `json:"spending"`
}

// POST /api/users: either { demo: "maria" } or an onboarding profile. Sets the session cookie.
func (s *server) createUser(w http.ResponseWriter, r *http.Request) {
	var body createUserRequest
	if !readJSON(w, r, &body) {
		return
	}
	var userID string
	if body.Demo != "" {
		// Only the synthetic personas can be entered by id.
		u, err := s.Store.GetUser(r.Context(), body.Demo)
		if !reference.IsDemoUser(body.Demo) || isNotFound(err) {
			fail(w, http.StatusNotFound, "demo user not found")
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		userID = u.ID
	} else {
		if len(body.Situations) == 0 {
			fail(w, http.StatusBadRequest, "pick at least one situation")
			return
		}
		if body.HireDate != nil && *body.HireDate == "" {
			body.HireDate = nil
		}
		u, err := s.Store.CreateUser(r.Context(), domain.User{
			ID:              newUserID(),
			Name:            body.Name,
			Situations:      body.Situations,
			Payday:          body.Payday,
			HireDate:        body.HireDate,
			GrossMonthly:    body.GrossMonthly,
			MonthlyExpenses: body.MonthlyExpenses,
			FirstsDone:      body.FirstsDone,
			Spending:        body.Spending,
		})
		if err != nil {
			s.internal(w, r, err)
			return
		}
		userID = u.ID
	}
	setUserID(w, userID)
	writeJSON(w, http.StatusOK, map[string]string{"userId": userID})
}

func (s *server) signOut(w http.ResponseWriter, r *http.Request) {
	clearUserID(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// profile only after the quiz
func (s *server) me(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	p, err := s.svc.Profile(r.Context(), u)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	out := map[string]any{"user": u}
	if p != nil {
		out["profile"] = p
	}
	writeJSON(w, http.StatusOK, out)
}

// ---- triggers ----

type eventRequest struct {
	Type            domain.EventType `json:"type"`
	Payload         map[string]any   `json:"payload"`
	IgnoreWeeklyCap bool             `json:"ignoreWeeklyCap"`
}

// POST /api/events: fire an event for the current user (simulator, catch-up button, or a future bank webhook adapter).
func (s *server) fireEvent(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	var body eventRequest
	if !readJSON(w, r, &body) {
		return
	}
	if !slices.Contains(domain.EventTypes, body.Type) {
		fail(w, http.StatusBadRequest, "unknown event type")
		return
	}
	source := domain.SourceSimulator
	if body.Type == domain.CatchUp {
		source = domain.SourceUser
	}
	res, err := s.svc.HandleEvent(r.Context(), app.EventInput{
		UserID: u.ID, Type: body.Type, Payload: body.Payload, Source: source, IgnoreWeeklyCap: body.IgnoreWeeklyCap,
	})
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// POST /api/calendar runs today's calendar for the current user. In production this is a daily
// cron over all users; here the simulator calls it so the trigger on stage is computed, not pressed.
func (s *server) runCalendar(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	today := clock.TodayISO()
	results := []app.EventResult{}
	for _, ev := range app.CalendarEvents(u, today) {
		res, err := s.svc.HandleEvent(r.Context(), app.EventInput{UserID: u.ID, Type: ev.Type, Payload: ev.Payload, Source: domain.SourceCalendar})
		if err != nil {
			s.internal(w, r, err)
			return
		}
		results = append(results, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"today": today, "results": results})
}

func clockResponse() map[string]any {
	return map[string]any{"offsetDays": clock.OffsetDays(), "now": clock.NowISO()}
}

func (s *server) getClock(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, clockResponse())
}

// POST /api/clock moves the app clock forward (e.g. "7 days later" for follow-ups). Demo tools only.
func (s *server) setClock(w http.ResponseWriter, r *http.Request) {
	if !s.Config.AllowDemoTools {
		fail(w, http.StatusForbidden, "clock is demo-only")
		return
	}
	var body struct {
		Days float64 `json:"days"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	clock.SetOffsetDays(body.Days)
	writeJSON(w, http.StatusOK, clockResponse())
}

// POST /api/demo/reset: back to fresh demo personas and today's date. Demo tools only.
func (s *server) resetDemo(w http.ResponseWriter, r *http.Request) {
	if !s.Config.AllowDemoTools {
		fail(w, http.StatusForbidden, "reset is demo-only")
		return
	}
	if err := s.Store.ResetUsers(r.Context(), reference.DemoUsers()); err != nil {
		s.internal(w, r, err)
		return
	}
	clock.SetOffsetDays(0)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---- screens ----

// GET /api/today: everything the Today screen shows, in one call.
func (s *server) today(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	t, err := s.svc.Today(r.Context(), u.ID)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user": u, "open": t.Open, "moments": reference.MomentDefs(langOf(r)), "doneMomentIds": t.DoneIDs, "catchUpMomentIds": t.CatchUpIDs,
		"dueFollowUps": t.DueFollowUps,
	})
}

// GET /api/moments/{runId}. Step text comes with {{placeholders}} already filled.
func (s *server) getMoment(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok {
		return
	}
	data, err := s.svc.RunWithView(r.Context(), r.PathValue("runId"), userID, langOf(r))
	if isNotFound(err) {
		fail(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	data.Def = moments.FillSteps(data.Def, data.View.Vars)
	writeJSON(w, http.StatusOK, data)
}

type momentPost struct {
	Kind       string         `json:"kind"`
	Value      float64        `json:"value"`
	AnswerKey  string         `json:"answerKey"`
	ActionType string         `json:"actionType"`
	Params     map[string]any `json:"params"`
}

// POST /api/moments/{runId}: a guess, an action or a dismiss.
func (s *server) postMoment(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok {
		return
	}
	runID := r.PathValue("runId")
	loaded, err := s.svc.RunWithView(r.Context(), runID, userID, langOf(r))
	if isNotFound(err) {
		fail(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	var body momentPost
	if !readJSON(w, r, &body) {
		return
	}
	switch body.Kind {
	case "guess":
		answer, ok := loaded.View.Answers[body.AnswerKey]
		if !ok {
			fail(w, http.StatusBadRequest, "unknown answer key")
			return
		}
		run, err := s.svc.RecordGuess(r.Context(), runID, userID, body.Value, answer)
		if err != nil {
			s.internal(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"run": run, "answer": answer})
	case "action":
		action, err := s.svc.CompleteWithAction(r.Context(), app.ActionInput{
			RunID: runID, UserID: userID, ActionType: body.ActionType, Params: body.Params, FollowUpDays: loaded.Def.FollowUpDays,
		})
		if err != nil {
			s.internal(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"action": action})
	case "dismiss":
		run := loaded.Run
		run.State = domain.RunDismissed
		if err := s.Store.UpdateRun(r.Context(), run); err != nil {
			s.internal(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"run": run})
	default:
		fail(w, http.StatusBadRequest, "unknown kind")
	}
}

// GET /api/followups: actions whose 7-day check is due. An action only counts once the user confirms it.
func (s *server) followUps(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok {
		return
	}
	due, err := s.svc.DueFollowUps(r.Context(), userID)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"due": due})
}

func (s *server) answerFollowUp(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok {
		return
	}
	var body struct {
		ActionID string              `json:"actionId"`
		Status   domain.ActionStatus `json:"status"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.Status != domain.ActionConfirmed && body.Status != domain.ActionSkipped {
		fail(w, http.StatusBadRequest, "bad status")
		return
	}
	actions, err := s.Store.ListActions(r.Context(), userID)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	i := slices.IndexFunc(actions, func(a domain.Action) bool { return a.ID == body.ActionID })
	if i < 0 {
		fail(w, http.StatusNotFound, "not found")
		return
	}
	action := actions[i]
	action.Status = body.Status
	if err := s.Store.UpdateAction(r.Context(), action); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"action": action})
}

type rankedWithReal struct {
	rules.RankedOffer
	RealChangeLei float64 `json:"realChangeLei"`
}

// GET /api/options?horizon=&amount=: the neutral ranking. Partner status is never an input.
// Works without a session: then it compares against national inflation.
func (s *server) options(w http.ResponseWriter, r *http.Request) {
	horizon := rules.Horizon(r.URL.Query().Get("horizon"))
	if !slices.Contains(rules.Horizons, horizon) {
		horizon = rules.OneToTwoYears
	}
	amount, _ := strconv.ParseFloat(r.URL.Query().Get("amount"), 64)
	if !(amount > 0) {
		amount = 10000
	}
	cpi := reference.LatestCPI(langOf(r))
	inflationPct, personal := cpi.HeadlinePct, false
	if id, ok := currentUserID(r); ok {
		if u, err := s.Store.GetUser(r.Context(), id); err == nil && u.Spending != nil {
			if p, err := rules.PersonalInflationFor(u.Spending.Shares, cpi.GroupsPct); err == nil {
				inflationPct, personal = p.PersonalPct, true
			}
		}
	}
	offers := []rankedWithReal{}
	for _, o := range rules.RankOffers(reference.Offers(langOf(r)), horizon, amount) {
		offers = append(offers, rankedWithReal{o, rules.RealChange(amount, o.NetRatePct, inflationPct)})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"horizon": horizon, "amountLei": amount, "inflationPct": inflationPct, "personalInflation": personal, "offers": offers,
	})
}

// ---- referrals ----

// POST /api/referrals/clicks records a click from an options or asset page.
func (s *server) referralClick(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfferID string `json:"offerId"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	var userID *string
	if id, ok := currentUserID(r); ok {
		userID = &id
	}
	clickID, err := s.svc.TrackReferralClick(r.Context(), body.OfferID, userID)
	if err == app.ErrUnknownOffer {
		fail(w, http.StatusNotFound, "unknown offer")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"clickId": clickID, "offerId": body.OfferID})
}

// POST /api/referrals/postback is called by a partner bank when a referred account is opened or
// funded. Fees are earned on "funded" only.
func (s *server) referralPostback(w http.ResponseWriter, r *http.Request) {
	if secret := s.Config.PostbackSecret; secret != "" && r.Header.Get("x-postback-secret") != secret {
		fail(w, http.StatusForbidden, "forbidden")
		return
	}
	var body struct {
		ClickID string                `json:"clickId"`
		Status  domain.ReferralStatus `json:"status"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.Status != domain.ReferralOpened && body.Status != domain.ReferralFunded {
		fail(w, http.StatusBadRequest, "bad status")
		return
	}
	ref, err := s.svc.ReferralPostback(r.Context(), body.ClickID, body.Status)
	if isNotFound(err) {
		fail(w, http.StatusNotFound, "unknown click")
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"referral": ref})
}

// GET /api/referrals/{clickId}: the referral behind a click id, for the mock provider page.
func (s *server) referral(w http.ResponseWriter, r *http.Request) {
	ref, err := s.Store.GetReferralByClick(r.Context(), r.PathValue("clickId"))
	if err != nil && !isNotFound(err) {
		s.internal(w, r, err)
		return
	}
	offer, ok := reference.FindOffer(ref.OfferID, langOf(r))
	if err != nil || !ok {
		fail(w, http.StatusNotFound, "not found")
		return
	}
	out := map[string]any{"referral": ref, "offer": offer}
	if p, ok := reference.GetPartner(offer.PartnerID); ok {
		out["partner"] = p.Public(langOf(r))
	}
	writeJSON(w, http.StatusOK, out)
}

// ---- partner view ----

// GET /api/partner/demo-token signs a demo partner token. Stage only: a real bank signs this on
// its own servers with its own secret, from category shares it computes from card spending.
func (s *server) demoToken(w http.ResponseWriter, r *http.Request) {
	if !s.Config.AllowDemoTools {
		fail(w, http.StatusForbidden, "disabled")
		return
	}
	maria := reference.DemoUsers()[0]
	claims := partner.Claims{
		PartnerID:       "demo-bank",
		AgeBand:         "18-24",
		Event:           string(domain.InflationPublished),
		GrossMonthly:    maria.GrossMonthly,
		MonthlyExpenses: maria.MonthlyExpenses,
	}
	if maria.Spending != nil {
		claims.Shares, claims.Monthly = maria.Spending.Shares, &maria.Spending.Monthly
	}
	token, err := partner.Sign(claims, 15*time.Minute, s.Config.AllowDemoTools)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": token, "url": "/embed?token=" + url.QueryEscape(token)})
}

// GET /api/embed?token=: the partner view's data, from a short-lived signed token. Nothing is stored.
func (s *server) embed(w http.ResponseWriter, r *http.Request) {
	claims, err := partner.Verify(r.URL.Query().Get("token"), s.Config.AllowDemoTools)
	p, ok := reference.GetPartner(&claims.PartnerID)
	if err != nil || !ok {
		fail(w, http.StatusUnauthorized, "expired")
		return
	}
	var monthly domain.MonthlyLines
	if claims.Monthly != nil {
		monthly = *claims.Monthly
	}
	monthly = domain.MonthlyLines{
		Fuel: domain.Ptr(monthly.Line("fuel")), Utilities: domain.Ptr(monthly.Line("utilities")), Food: domain.Ptr(monthly.Line("food")),
	}
	iv, err := views.Inflation(views.InflationInput{
		Spending:        domain.SpendingProfile{Shares: claims.Shares, Monthly: monthly, Source: "bank"},
		GrossMonthly:    claims.GrossMonthly,
		MonthlyExpenses: claims.MonthlyExpenses,
	}, langOf(r))
	if err != nil {
		fail(w, http.StatusUnauthorized, "expired")
		return
	}
	out := map[string]any{"partner": p.Public(langOf(r)), "inflation": iv}
	if sc, ok := reference.GetScenario("fuel-shortage", langOf(r)); ok {
		out["scenario"] = views.ScenarioView{Scenario: sc, MonthlySpend: monthly.Line(sc.SpendLine)}
	}
	writeJSON(w, http.StatusOK, out)
}

// GET /api/metrics: what we'd show a partner bank. Aggregates only, counted live from this instance.
func (s *server) metrics(w http.ResponseWriter, r *http.Request) {
	m, err := s.svc.Metrics(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	titles := map[string]string{}
	for _, d := range reference.MomentDefs(langOf(r)) {
		titles[d.ID] = d.Title
	}
	writeJSON(w, http.StatusOK, struct {
		app.Metrics
		Mode         string            `json:"mode"`
		MomentTitles map[string]string `json:"momentTitles"`
	}{m, "db", titles})
}
