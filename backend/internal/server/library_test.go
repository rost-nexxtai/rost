package server

import (
	"encoding/json"
	"strings"
	"testing"

	"rost/backend/internal/config"
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

// the three L0 core lessons, the last one levels up
func completeL0(c *client) map[string]any {
	c.t.Helper()
	var out map[string]any
	for _, id := range []string{"fondul_urgenta", "economii_vs_depozit", "dobanda_compusa"} {
		var code int
		if code, out = c.do("POST", "/api/library/"+id+"/complete", ""); code != 200 {
			c.t.Fatalf("complete %s = %d %v", id, code, out)
		}
	}
	return out
}

// quiz -> momente -> lesson -> level up -> stiri
func TestQuizToLevelUpOverHTTP(t *testing.T) {
	h, _ := testServerWithStore(fakeDB{}, config.Config{})
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
	if r := out["results"].([]any)[0].(map[string]any); r["correct"] != false || r["correctIndex"] != 2.0 || r["explain"] != nil {
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

	if code, _ := c.do("POST", "/api/library/actiuni/complete", ""); code != 409 {
		t.Errorf("complete a lesson not written yet = %d", code)
	}
	if code, _ := c.do("POST", "/api/library/nu_exista/complete", ""); code != 404 {
		t.Errorf("complete unknown = %d", code)
	}
	if code, _ := c.do("POST", "/api/library/fondul_urgenta/complete", `{"answers":[{"step":2,"picked":0}]}`); code != 400 {
		t.Errorf("answer on an explore step = %d", code)
	}
	c.do("POST", "/api/track", `{"events":[{"name":"moment_open","props":{"momentId":"fondul_urgenta"},"path":"/moment/lib/fondul_urgenta?from=acasa"}]}`)
	// sort, predict (4 is close to 3) and choice, all right
	code, done := c.do("POST", "/api/library/fondul_urgenta/complete", `{"answers":[{"step":0,"buckets":[0,1,0,1,0]},{"step":1,"value":4},{"step":3,"picked":0}]}`)
	if code != 200 || done["levelUp"] != false || get(done, "profile", "level") != 0.0 || done["correct"] != 3.0 || done["total"] != 3.0 {
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
