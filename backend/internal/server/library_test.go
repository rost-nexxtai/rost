package server

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"rost/backend/internal/config"
	"rost/backend/internal/domain"
)

func jsonString(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func get(m map[string]any, path ...string) any {
	var v any = m
	for _, k := range path {
		v = v.(map[string]any)[k]
	}
	return v
}

// no horizon / expensiveDebt, onboarding doesn't ask them anymore
const quizAllNuStiu = `{"knowledge":["nu_stiu","nu_stiu","nu_stiu","nu_stiu"],
"ageBand":"30_plus","situation":"student","bufferMonths":0,"fuelLei":200}`

// right answers to the three L0 core lessons; only passed lessons count toward a level
var l0Right = []struct{ id, body string }{
	{"fondul_urgenta", `{"answers":[{"step":0,"buckets":[0,1,0,1,0]},{"step":1,"value":4},{"step":3,"picked":0},{"step":4,"order":[0,1,2,3]}]}`},
	{"economii_vs_depozit", `{"answers":[{"step":0,"value":450},{"step":2,"buckets":[0,1,0,1]}]}`},
	{"dobanda_compusa", `{"answers":[{"step":0,"value":1967},{"step":2,"picked":1}]}`},
}

// the three L0 core lessons, passed; the last one levels up
func completeL0(c *client) map[string]any {
	c.t.Helper()
	var out map[string]any
	for _, l := range l0Right {
		id := l.id
		var code int
		if code, out = c.do("POST", "/api/library/"+id+"/complete", l.body); code != 200 {
			c.t.Fatalf("complete %s = %d %v", id, code, out)
		}
	}
	return out
}

// quiz -> momente -> lesson -> level up -> stiri
func TestQuizToLevelUpOverHTTP(t *testing.T) {
	h, st := testServerWithStore(fakeDB{}, config.Config{})
	// every seeded lesson is written now, so add one that isn't
	soon := domain.ContentItem{Kind: domain.KindMoment, ID: "in_curand", Status: domain.StatusPublished, Position: 99, UpdatedBy: "test",
		Doc: []byte(`{"id":"in_curand","title":"În curând","hook":"H","series":"S","level":2,"core":false,"minutes":4,"assetIds":[],"steps":[],"takeaways":[]}`)}
	if _, err := st.CreateContent(context.Background(), soon); err != nil {
		t.Fatal(err)
	}
	c := &client{t: t, h: h}

	_, quiz := c.do("GET", "/api/quiz", "")
	if qs := quiz["knowledge"].([]any); len(qs) != 4 || strings.Contains(jsonString(qs), "correct") {
		t.Fatalf("quiz must list 4 questions without answers: %v", qs)
	}
	if code, _ := c.do("POST", "/api/track", `{"events":[{"name":"quiz_start","path":"/quiz"}]}`); code != 202 {
		t.Errorf("track before onboarding = %d", code)
	}

	for name, body := range map[string]string{
		"too few answers": strings.Replace(quizAllNuStiu, `"nu_stiu",`, ``, 1),
		"bad answer":      strings.Replace(quizAllNuStiu, `"nu_stiu",`, `7,`, 1),
		"bad age band":    strings.Replace(quizAllNuStiu, `30_plus`, `40`, 1),
		"no buffer":       strings.Replace(quizAllNuStiu, `"bufferMonths":0,`, ``, 1),
	} {
		if code, _ := c.do("POST", "/api/quiz", body); code != 400 {
			t.Errorf("%s = %d", name, code)
		}
	}
	code, out := c.do("POST", "/api/quiz", quizAllNuStiu)
	if code != 200 || c.cookies[UIDCookie] == nil {
		t.Fatalf("quiz = %d %v", code, out)
	}
	if p := out["profile"].(map[string]any); p["level"] != 0.0 || p["riskProfile"] != "prudent" || p["horizon"] != "1_3_ani" || p["expensiveDebt"] != false ||
		get(p, "money", "fuelLei") != 200.0 || get(p, "money", "inflationPct") != 6.61 {
		t.Errorf("profile = %v", p)
	}
	if r := out["results"].([]any)[0].(map[string]any); r["correct"] != false || r["correctIndex"] != 2.0 || r["explain"] == "" {
		t.Errorf("results = %v", r)
	}

	_, momente := c.do("GET", "/api/momente", "")
	for _, m := range momente["forYourLevel"].([]any) {
		if m.(map[string]any)["level"] != 0.0 {
			t.Errorf("L0 user sees %v", m)
		}
	}
	if p := momente["progress"].(map[string]any); p["coreDone"] != 0.0 || p["coreTotal"] != 3.0 || p["nextLevel"] != 1.0 {
		t.Errorf("progress = %v", p)
	}

	if code, _ := c.do("POST", "/api/library/in_curand/complete", ""); code != 409 {
		t.Errorf("complete a lesson not written yet = %d", code)
	}
	if code, _ := c.do("POST", "/api/library/nu_exista/complete", ""); code != 404 {
		t.Errorf("complete unknown = %d", code)
	}
	if code, _ := c.do("POST", "/api/library/fondul_urgenta/complete", `{"answers":[{"step":2,"picked":0}]}`); code != 400 {
		t.Errorf("answer on an explore step = %d", code)
	}
	c.do("POST", "/api/track", `{"events":[{"name":"moment_open","props":{"momentId":"fondul_urgenta"},"path":"/moment/lib/fondul_urgenta?from=acasa"}]}`)
	// 1 of 4 right: finished, but not passed, so it doesn't count yet
	code, failed := c.do("POST", "/api/library/fondul_urgenta/complete", `{"answers":[{"step":0,"buckets":[1,0,1,0,1]},{"step":1,"value":20},{"step":3,"picked":0}]}`)
	if code != 200 || failed["passed"] != false || failed["correct"] != 1.0 || len(get(failed, "profile", "completedMomentIds").([]any)) != 0 {
		t.Fatalf("failed attempt = %d %v", code, failed)
	}
	// sort, predict (4 is inside 3–6 months), choice and order, all right: the retake replaces the attempt
	code, done := c.do("POST", "/api/library/fondul_urgenta/complete", l0Right[0].body)
	if code != 200 || done["passed"] != true || done["alreadyDone"] != false || done["levelUp"] != false || get(done, "profile", "level") != 0.0 || done["correct"] != 4.0 || done["total"] != 4.0 {
		t.Fatalf("complete = %d %v", code, done)
	}
	if _, again := c.do("POST", "/api/library/fondul_urgenta/complete", ""); again["alreadyDone"] != true || again["levelUp"] != false {
		t.Errorf("complete twice = %v", again)
	}
	if last := completeL0(c); last["levelUp"] != true || get(last, "profile", "level") != 1.0 {
		t.Errorf("all L0 lessons = %v", last)
	}
	if _, me := c.do("GET", "/api/me", ""); get(me, "profile", "level") != 1.0 || len(get(me, "profile", "completedMomentIds").([]any)) != 3 {
		t.Errorf("me = %v", me)
	}

	_, stiri := c.do("GET", "/api/stiri", "")
	if items := stiri["items"].([]any); len(items) != 3 || items[0].(map[string]any)["id"] != "motorina" {
		t.Errorf("stiri = %v", items)
	}

	for name, body := range map[string]string{
		"unknown event":   `{"events":[{"name":"level_up"}]}`,
		"nested props":    `{"events":[{"name":"page_view","props":{"user":{"email":"x"}}}]}`,
		"relative path":   `{"events":[{"name":"page_view","path":"acasa"}]}`,
		"empty batch":     `{"events":[]}`,
		"not JSON at all": `nope`,
	} {
		if code, _ := c.do("POST", "/api/track", body); code != 400 {
			t.Errorf("track %s = %d", name, code)
		}
	}
}

func TestMomenteNeedsTheQuiz(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	if code, _ := c.do("GET", "/api/momente", ""); code != 401 {
		t.Errorf("no session = %d", code)
	}
	c.do("POST", "/api/users", `{"situations":["student"]}`)
	for _, path := range []string{"/api/momente", "/api/stiri"} {
		if code, out := c.do("GET", path, ""); code != 404 || out["error"] != "no profile" {
			t.Errorf("%s before the quiz = %d %v", path, code, out)
		}
	}
	if _, me := c.do("GET", "/api/me", ""); me["profile"] != nil {
		t.Errorf("profile before the quiz: %v", me)
	}
}

func TestMariaMomente(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	c.do("POST", "/api/users", `{"demo":"maria"}`)
	_, me := c.do("GET", "/api/me", "")
	if p := me["profile"].(map[string]any); p["level"] != 1.0 || p["riskProfile"] != "echilibrat" || get(p, "money", "inflationPct") != 8.48 {
		t.Errorf("maria = %v", p)
	}
	c.do("POST", "/api/events", `{"type":"salary_received"}`)
	_, m := c.do("GET", "/api/momente", "")
	if tr := m["triggered"].([]any); len(tr) != 1 || !strings.HasPrefix(tr[0].(map[string]any)["href"].(string), "/moment/") {
		t.Errorf("triggered = %v", tr)
	}
	ids := []string{}
	for _, x := range m["forYourLevel"].([]any) {
		ids = append(ids, x.(map[string]any)["id"].(string))
	}
	if strings.Join(ids, ",") != "titluri_stat,etf,fondul_urgenta,economii_vs_depozit,dobanda_compusa" {
		t.Errorf("for your level = %v", ids)
	}
}

func TestAdminStats(t *testing.T) {
	c := adminClient(t)
	c.do("POST", "/api/track", `{"events":[{"name":"quiz_start"},{"name":"page_view","path":"/embed?token=secret"}]}`)
	c.do("POST", "/api/quiz", quizAllNuStiu)
	c.do("POST", "/api/track", `{"events":[{"name":"moment_open","props":{"momentId":"fondul_urgenta"}},{"name":"moment_open","props":{"momentId":"fondul_urgenta"}},{"name":"asset_view","props":{"assetId":"etf"}}]}`)
	c.do("POST", "/api/library/fondul_urgenta/complete", `{"answers":[{"step":3,"picked":1}]}`)

	if code, _ := c.do("GET", "/api/admin/stats", ""); code != 401 {
		t.Errorf("stats without login = %d", code)
	}
	c.login()
	if code, _ := c.do("GET", "/api/admin/stats?days=0", ""); code != 400 {
		t.Errorf("days=0 = %d", code)
	}
	code, st := c.do("GET", "/api/admin/stats?days=7", "")
	if code != 200 {
		t.Fatalf("stats = %d %v", code, st)
	}
	users := st["users"].(map[string]any)
	// maria + the new user, only the new one has events
	if users["total"] != 2.0 || users["withQuiz"] != 2.0 || users["active"] != 1.0 || users["new"] != 2.0 {
		t.Errorf("users = %v", users)
	}
	if q := st["quiz"].(map[string]any); q["started"] != 1.0 || q["completed"] != 1.0 || q["avgScore"] != 0.0 {
		t.Errorf("quiz = %v", q)
	}
	if st["levelUps"] != 0.0 || len(st["daily"].([]any)) != 7 {
		t.Errorf("levelUps = %v, days = %d", st["levelUps"], len(st["daily"].([]any)))
	}
	// maria L1, the new user still L0 after one lesson
	if lv := st["levels"].(map[string]any); lv["0"] != 1.0 || lv["1"] != 1.0 {
		t.Errorf("levels = %v", lv)
	}
	lib := st["library"].([]any)[0].(map[string]any)
	if lib["momentId"] != "fondul_urgenta" || lib["opened"] != 2.0 || lib["completed"] != 1.0 || lib["completionRate"] != 0.5 || lib["correctRate"] != 0.0 {
		t.Errorf("library = %v", lib)
	}
	if pages := jsonString(st["pages"]); strings.Contains(pages, "secret") || !strings.Contains(pages, `"/embed"`) {
		t.Errorf("pages must drop query strings: %s", pages)
	}
	if a := st["assets"].([]any)[0].(map[string]any); a["assetId"] != "etf" || a["views"] != 1.0 {
		t.Errorf("assets = %v", a)
	}
	if strings.Contains(jsonString(st), `"userId"`) {
		t.Error("stats must not list user ids")
	}
}

// new core lesson shouldn't demote anyone
func TestNewCoreLessonDoesNotDemote(t *testing.T) {
	c := adminClient(t)
	c.do("POST", "/api/quiz", quizAllNuStiu)
	if out := completeL0(c); out["levelUp"] != true {
		t.Fatalf("complete = %v", out)
	}
	c.login()
	core := strings.Replace(newMoment, `"core":false`, `"core":true`, 1)
	if code, out := c.do("POST", "/api/admin/content/moments", `{"status":"published","doc":`+core+`}`); code != 201 {
		t.Fatalf("publish core lesson = %d %v", code, out)
	}
	_, me := c.do("GET", "/api/me", "")
	if get(me, "profile", "level") != 1.0 {
		t.Errorf("level after a new L0 core lesson = %v, want 1", get(me, "profile", "level"))
	}
	// still shows up, not done yet
	if _, m := c.do("GET", "/api/momente", ""); !strings.Contains(jsonString(m["forYourLevel"]), `"buget_50_30_20"`) {
		t.Errorf("new lesson missing from forYourLevel: %v", m["forYourLevel"])
	}
}

func TestLessonsInBothLanguages(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	for lang, want := range map[string][2]string{
		"":   {"Fondul de urgență", "Ți se strică mașina cu care mergi la job"},
		"ro": {"Fondul de urgență", "Ți se strică mașina cu care mergi la job"},
		"en": {"Your emergency fund", "The car you drive to work breaks down"},
	} {
		c.lang = lang
		code, out := c.do("GET", "/api/library/fondul_urgenta", "")
		m, _ := out["moment"].(map[string]any)
		if code != 200 || m["title"] != want[0] {
			t.Errorf("lang %q: %d %v", lang, code, m["title"])
			continue
		}
		if _, leaked := m["en"]; leaked {
			t.Errorf("lang %q: translation block in the response", lang)
		}
		item := m["steps"].([]any)[0].(map[string]any)["items"].([]any)[0].(map[string]any)
		if item["label"] != want[1] || item["bucket"] != 0.0 {
			t.Errorf("lang %q: first card = %v", lang, item)
		}
		_, list := c.do("GET", "/api/library", "")
		if first := list["moments"].([]any)[0].(map[string]any); first["title"] != want[0] {
			t.Errorf("lang %q: library title = %v", lang, first["title"])
		}
	}
}

func TestQuizPlacementOverHTTP(t *testing.T) {
	for _, c := range []struct {
		name, knowledge string
		level           float64
	}{
		{"basics and tier 1", `[2,1,0,1]`, 2},
		{"basics only", `[2,1,"nu_stiu","nu_stiu"]`, 1},
		{"hard ones right, a basic wrong", `[0,1,0,1]`, 0},
	} {
		cl := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
		code, out := cl.do("POST", "/api/quiz", `{"knowledge":`+c.knowledge+`,"ageBand":"25_29","situation":"employed","bufferMonths":3}`)
		if code != 200 {
			t.Fatalf("%s: %d %v", c.name, code, out)
		}
		if got := get(out, "profile", "quizLevel"); got != c.level {
			t.Errorf("%s: quizLevel %v, want %v", c.name, got, c.level)
		}
	}
}

// A quiz-only user has no salary or spending. The payslip moment is still offered: Momente asks
// for a gross salary and the catch-up brings it. The inflation moments need spending, so they aren't.
func TestCatchUpOnlyWhatCanOpen(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	c.do("POST", "/api/quiz", quizAllNuStiu)
	_, today := c.do("GET", "/api/today", "")
	if ids := jsonString(today["catchUpMomentIds"]); ids != `["payslip_explained"]` {
		t.Errorf("quiz-only user can catch up on %s", ids)
	}
	if needs := jsonString(today["catchUpNeeds"]); needs != `{"payslip_explained":["grossMonthly"]}` {
		t.Errorf("needs = %s", needs)
	}
	// without the salary nothing opens; a silly salary is refused
	if _, ev := c.do("POST", "/api/events", `{"type":"catch_up","payload":{"momentId":"payslip_explained"}}`); len(ev["runs"].([]any)) != 0 {
		t.Errorf("opened without a salary: %v", ev)
	}
	if code, _ := c.do("POST", "/api/events", `{"type":"catch_up","payload":{"momentId":"payslip_explained","grossMonthly":5}}`); code != 400 {
		t.Errorf("salary of 5 lei = %d", code)
	}
	_, ev := c.do("POST", "/api/events", `{"type":"catch_up","payload":{"momentId":"payslip_explained","grossMonthly":6000}}`)
	runs, _ := ev["runs"].([]any)
	if len(runs) != 1 {
		t.Fatalf("catch-up with a salary didn't open: %v", ev)
	}
	if code, m := c.do("GET", "/api/moments/"+runs[0].(map[string]any)["id"].(string), ""); code != 200 {
		t.Errorf("payslip moment = %d %v", code, m)
	}
	if _, today = c.do("GET", "/api/today", ""); jsonString(today["catchUpNeeds"]) != `{}` {
		t.Errorf("still asks for a salary: %v", today["catchUpNeeds"])
	}

	m := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	m.do("POST", "/api/users", `{"demo":"maria"}`)
	_, today = m.do("GET", "/api/today", "")
	if !strings.Contains(jsonString(today["catchUpMomentIds"]), "personal_inflation") || jsonString(today["catchUpNeeds"]) != `{}` {
		t.Errorf("maria's catch-ups = %v %v", today["catchUpMomentIds"], today["catchUpNeeds"])
	}
}

// The profile lives on the server now: lessons left halfway, the days with a finished lesson and
// the money lines the user gave, kept across a quiz retake.
func TestProgressOnTheServer(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	if code, _ := c.do("PUT", "/api/library/fondul_urgenta/progress", `{"step":2,"results":[true],"of":6}`); code != 401 {
		t.Errorf("progress without a session = %d", code)
	}
	if code, _ := c.do("POST", "/api/quiz", quizAllNuStiu); code != 200 {
		t.Fatalf("quiz = %d", code)
	}

	code, out := c.do("PUT", "/api/library/fondul_urgenta/progress", `{"step":2,"results":[true],"answers":[{"step":0,"buckets":[0,1,0,1,0]}],"of":6}`)
	if code != 200 || jsonString(get(out, "profile", "lessonProgress", "fondul_urgenta", "results")) != "[true]" ||
		jsonString(get(out, "profile", "lessonProgress", "fondul_urgenta", "answers")) != `[{"buckets":[0,1,0,1,0],"step":0}]` {
		t.Fatalf("progress = %d %v", code, out)
	}
	for name, body := range map[string]string{
		"lesson edited since":        `{"step":2,"results":[true],"of":5}`,
		"on the first screen":        `{"step":0,"results":[],"of":6}`,
		"on the finish screen":       `{"step":5,"results":[],"of":6}`,
		"more results than graded":   `{"step":2,"results":[true,true,true],"of":6}`,
		"an answer that doesn't fit": `{"step":2,"results":[true],"answers":[{"step":0,"picked":1}],"of":6}`,
		"an answer from later on":    `{"step":2,"results":[true],"answers":[{"step":3,"picked":0}],"of":6}`,
	} {
		if code, _ := c.do("PUT", "/api/library/fondul_urgenta/progress", body); code != 400 {
			t.Errorf("%s = %d", name, code)
		}
	}
	if code, _ := c.do("PUT", "/api/library/nu_exista/progress", `{"step":1,"of":3}`); code != 404 {
		t.Errorf("unknown lesson = %d", code)
	}

	// finishing it, even failed, clears the progress and counts today
	code, done := c.do("POST", "/api/library/fondul_urgenta/complete", `{"answers":[]}`)
	if code != 200 || done["passed"] != false {
		t.Fatalf("complete = %d %v", code, done)
	}
	if lp := get(done, "profile", "lessonProgress").(map[string]any); len(lp) != 0 {
		t.Errorf("progress after finishing = %v", lp)
	}
	if days := get(done, "profile", "learnedDays").([]any); len(days) != 1 {
		t.Errorf("learned days = %v", days)
	}

	// money lines: a number sets it, null forgets it, and the profile says which are known
	code, me := c.do("PATCH", "/api/me", `{"moneyLines":{"fuelLei":350,"savedLei":0}}`)
	if code != 200 || get(me, "profile", "money", "fuelLei") != 350.0 || jsonString(get(me, "profile", "money", "known")) != `["fuelLei","savedLei"]` {
		t.Fatalf("money lines = %d %v", code, me)
	}
	_, me = c.do("PATCH", "/api/me", `{"moneyLines":{"fuelLei":null}}`)
	if get(me, "profile", "money", "fuelLei") != 0.0 || jsonString(get(me, "profile", "money", "known")) != `["savedLei"]` {
		t.Errorf("forget fuel = %v", get(me, "profile", "money"))
	}
	if code, _ := c.do("PATCH", "/api/me", `{"moneyLines":{"rentLei":1}}`); code != 400 {
		t.Errorf("unknown line = %d", code)
	}

	// a retake keeps the lines it doesn't ask and the days; the quiz's fuel (200) is answered again
	_, again := c.do("POST", "/api/quiz", quizAllNuStiu)
	if jsonString(get(again, "profile", "money", "known")) != `["savedLei","fuelLei"]` || len(get(again, "profile", "learnedDays").([]any)) != 1 {
		t.Errorf("after a retake = %v", get(again, "profile"))
	}
}
