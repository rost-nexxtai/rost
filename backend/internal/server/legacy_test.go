package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"rost/backend/internal/config"
	"rost/backend/internal/learning"
)

// legacyCookie is a rost_profile cookie as the web app on main wrote it.
func legacyCookie(edit func(p map[string]any)) string {
	days := []any{}
	for d := 1; d <= 16; d++ {
		days = append(days, fmt.Sprintf("2026-10-%02d", d))
	}
	p := map[string]any{
		"quizScore": 1, "quizLevel": 0, "level": 2, "riskProfile": "prudent",
		"ageBand": "25_29", "situation": "employed", "bufferMonths": 2, "expensiveDebt": true, "horizon": "peste_3_ani",
		"money": map[string]any{
			"fuelLei": 300, "electricityLei": 150, "savedLei": 2000, "inflationPct": 8.5,
			"known": []any{"fuelLei", "savedLei"}, "expensesLei": 3500, "inflationPersonal": false,
		},
		"completedMomentIds": []any{"fondul_urgenta", "economii_vs_depozit", "dobanda_compusa", "gone_since"},
		"lessonProgress":     map[string]any{"titluri_stat": map[string]any{"step": 2, "results": []any{true}, "of": 5}},
		"learnedDays":        days,
		"game":               map[string]any{"xp": 40},
	}
	if edit != nil {
		edit(p)
	}
	b, _ := json.Marshal(p)
	return string(b)
}

func TestImportLegacyProfile(t *testing.T) {
	h, st := testServerWithStore(fakeDB{}, config.Config{})
	ctx := context.Background()
	c := &client{t: t, h: h}
	// a user from main: POST /api/users at onboarding, the profile in the cookie
	c.do("POST", "/api/users", `{"situations":["employed"],"grossMonthly":7000}`)
	id := c.id()

	if code, out := c.do("POST", "/api/me/import", legacyCookie(nil)); code != 200 || out["imported"] != true {
		t.Fatalf("import = %d %v", code, out)
	}
	_, me := c.do("GET", "/api/me", "")
	p := me["profile"].(map[string]any)
	// the level the old app worked out, above what the quiz and lessons give
	if p["level"] != 2.0 || p["quizLevel"] != 0.0 || p["quizScore"] != 1.0 || p["riskProfile"] != "echilibrat" {
		t.Errorf("level = %v %v %v %v", p["level"], p["quizLevel"], p["quizScore"], p["riskProfile"])
	}
	if p["ageBand"] != "25_29" || p["situation"] != "employed" || p["bufferMonths"] != 2.0 || p["expensiveDebt"] != true || p["horizon"] != "peste_3_ani" {
		t.Errorf("answers = %v", p)
	}
	done := p["completedMomentIds"].([]any)
	if len(done) != 3 || slices.Contains(done, any("gone_since")) {
		t.Errorf("lessons = %v", done)
	}
	days := p["learnedDays"].([]any)
	if len(days) != 14 || days[0] != "2026-10-03" || days[13] != "2026-10-16" {
		t.Errorf("days = %v", days)
	}
	if len(p["lessonProgress"].(map[string]any)) != 0 {
		t.Errorf("progress without answers is dropped: %v", p["lessonProgress"])
	}
	money := p["money"].(map[string]any)
	if money["fuelLei"] != 300.0 || money["electricityLei"] != 150.0 || money["savedLei"] != 2000.0 || money["expensesLei"] != 3500.0 ||
		jsonString(money["known"]) != `["fuelLei","savedLei"]` {
		t.Errorf("money = %v", money)
	}
	// what POST /api/users kept stays
	if get(me, "user", "grossMonthly") != 7000.0 || jsonString(get(me, "user", "situations")) != `["employed"]` {
		t.Errorf("user = %v", me["user"])
	}

	cs, _ := st.ListCompletions(ctx, id)
	for _, c := range cs {
		if c.Correct != 1 || c.Total != 1 || !learning.Passed(c.Correct, c.Total) || c.Answers[0]["imported"] != true {
			t.Errorf("completion = %+v", c)
		}
	}

	// once: a second import never overwrites
	if code, _ := c.do("POST", "/api/me/import", legacyCookie(func(p map[string]any) { p["level"] = 0; p["ageBand"] = "sub_25" })); code != 409 {
		t.Errorf("second import = %d", code)
	}
	if _, me := c.do("GET", "/api/me", ""); get(me, "profile", "ageBand") != "25_29" || get(me, "profile", "level") != 2.0 {
		t.Errorf("after a second import = %v", me["profile"])
	}
	if cs2, _ := st.ListCompletions(ctx, id); len(cs2) != len(cs) {
		t.Errorf("completions = %v", cs2)
	}
}

func TestImportNeverOverwritesAQuiz(t *testing.T) {
	h, _ := testServerWithStore(fakeDB{}, config.Config{})
	c := &client{t: t, h: h}
	c.do("POST", "/api/quiz", quizAllNuStiu)
	_, before := c.do("GET", "/api/me", "")
	if code, _ := c.do("POST", "/api/me/import", legacyCookie(nil)); code != 409 {
		t.Errorf("import over a quiz = %d", code)
	}
	if _, after := c.do("GET", "/api/me", ""); jsonString(after["profile"]) != jsonString(before["profile"]) {
		t.Errorf("profile changed: %v", after["profile"])
	}
}

func TestImportValidates(t *testing.T) {
	h, st := testServerWithStore(fakeDB{}, config.Config{})
	ctx := context.Background()
	users, _ := st.ListUsers(ctx)
	for name, edit := range map[string]func(p map[string]any){
		"unknown age band":  func(p map[string]any) { p["ageBand"] = "40_plus" },
		"unknown situation": func(p map[string]any) { p["situation"] = "retired" },
		"unknown horizon":   func(p map[string]any) { p["horizon"] = "forever" },
		"level 3":           func(p map[string]any) { p["level"] = 3 },
		"no quiz level":     func(p map[string]any) { delete(p, "quizLevel") },
		"score too high":    func(p map[string]any) { p["quizScore"] = 9 },
		"negative buffer":   func(p map[string]any) { p["bufferMonths"] = -1 },
		"no debt answer":    func(p map[string]any) { delete(p, "expensiveDebt") },
		"negative fuel":     func(p map[string]any) { p["money"].(map[string]any)["fuelLei"] = -5 },
		"no money":          func(p map[string]any) { delete(p, "money") },
		"zero expenses":     func(p map[string]any) { p["money"].(map[string]any)["expensesLei"] = 0 },
		"unknown line":      func(p map[string]any) { p["money"].(map[string]any)["known"] = []any{"rentLei"} },
		"no lessons":        func(p map[string]any) { delete(p, "completedMomentIds") },
		"lesson not a text": func(p map[string]any) { p["completedMomentIds"] = []any{1} },
		"bad day":           func(p map[string]any) { p["learnedDays"] = []any{"2026-13-01"} },
		"day as a number":   func(p map[string]any) { p["learnedDays"] = []any{20261001} },
	} {
		c := &client{t: t, h: h}
		if code, _ := c.do("POST", "/api/me/import", legacyCookie(edit)); code != 400 || c.cookies[SessionCookie] != nil {
			t.Errorf("%s = %d %v", name, code, c.cookies)
		}
	}
	c := &client{t: t, h: h}
	if code, _ := c.do("POST", "/api/me/import", `not json`); code != 400 {
		t.Errorf("not JSON = %d", code)
	}
	if after, _ := st.ListUsers(ctx); len(after) != len(users) {
		t.Errorf("a bad cookie made a user: %d → %d", len(users), len(after))
	}
}

// A cookie without any session: someone whose POST /api/users failed on main. The import makes the
// user and signs the browser in.
func TestImportWithoutASession(t *testing.T) {
	h, _ := testServerWithStore(fakeDB{}, config.Config{})
	c := &client{t: t, h: h}
	code, _ := c.do("POST", "/api/me/import", legacyCookie(func(p map[string]any) { p["horizon"] = nil }))
	if code != 200 || c.cookies[SessionCookie] == nil {
		t.Fatalf("import = %d %v", code, c.cookies)
	}
	_, me := c.do("GET", "/api/me", "")
	if get(me, "profile", "level") != 2.0 || get(me, "profile", "horizon") != "1_3_ani" || jsonString(get(me, "user", "situations")) != `["employed"]` {
		t.Errorf("me = %v", me)
	}
}

func TestImportIsRateLimited(t *testing.T) {
	h, _ := testServerWithStore(fakeDB{}, config.Config{})
	codes := map[int]int{}
	for range rateLimits["users"].Burst + 1 {
		rec := (&client{t: t, h: h}).send("POST", "/api/me/import", legacyCookie(nil))
		codes[rec.Code]++
	}
	if codes[http.StatusTooManyRequests] != 1 {
		t.Errorf("codes = %v", codes)
	}
}
