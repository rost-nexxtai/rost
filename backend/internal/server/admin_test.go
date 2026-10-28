package server

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"rost/backend/internal/app"
	"rost/backend/internal/config"
)

const adminPassword = "o-parola-destul-de-lunga"

// fresh server with one admin, not logged in
func adminClient(t *testing.T) *client {
	t.Helper()
	h, st := testServerWithStore(fakeDB{}, config.Config{})
	if _, err := (app.Service{Store: st}).CreateAdmin(context.Background(), "Admin@Rost.ro", adminPassword); err != nil {
		t.Fatal(err)
	}
	return &client{t: t, h: h}
}

func (c *client) login() {
	c.t.Helper()
	if code, out := c.do("POST", "/api/admin/login", `{"email":"admin@rost.ro","password":"`+adminPassword+`"}`); code != 200 {
		c.t.Fatalf("login = %d %v", code, out)
	}
}

const newMoment = `{"id":"buget_50_30_20","title":"Bugetul 50/30/20","hook":"O regulă simplă pentru salariu.","series":"Fundația",
"level":0,"core":false,"minutes":3,"assetIds":[],
"steps":[{"type":"choice","question":"Cât merge la economii?","options":["20%","50%"],"correct":0,"explain":"20% economii."},
{"type":"predict","question":"Din 5.000 lei, cât pui deoparte?","answerValue":1000,"min":0,"max":5000,"step":100,"unit":"lei"},
{"type":"finish","cta":{"label":"Înapoi la momente","href":"/momente"}}],
"takeaways":["50% nevoi, 30% dorințe.","20% economii."]}`

func TestAdminLoginAndSessions(t *testing.T) {
	c := adminClient(t)
	if code, _ := c.do("GET", "/api/admin/me", ""); code != 401 {
		t.Errorf("me without login = %d", code)
	}
	if code, _ := c.do("POST", "/api/admin/login", `{"email":"admin@rost.ro","password":"gresit-gresit-gresit"}`); code != 401 {
		t.Errorf("wrong password = %d", code)
	}
	if code, _ := c.do("POST", "/api/admin/login", `{"email":"nimeni@rost.ro","password":"`+adminPassword+`"}`); code != 401 {
		t.Errorf("unknown email = %d", code)
	}
	c.login()
	ck := c.cookies[AdminCookie]
	if ck == nil || !ck.HttpOnly || ck.Path != "/api/admin" || ck.SameSite != http.SameSiteStrictMode {
		t.Fatalf("admin cookie = %+v", ck)
	}
	if _, out := c.do("GET", "/api/admin/me", ""); out["admin"].(map[string]any)["email"] != "admin@rost.ro" {
		t.Errorf("me = %v", out)
	}
	if _, out := c.do("GET", "/api/admin/me", ""); strings.Contains(strings.ToLower(jsonString(out)), "pbkdf2") {
		t.Error("password hash leaked")
	}

	if code, _ := c.do("POST", "/api/admin/admins", `{"email":"nou@rost.ro","password":"scurta"}`); code != 400 {
		t.Errorf("weak password = %d", code)
	}
	if code, _ := c.do("POST", "/api/admin/admins", `{"email":"nou@rost.ro","password":"o-alta-parola-lunga"}`); code != 201 {
		t.Errorf("create admin = %d", code)
	}
	if code, _ := c.do("POST", "/api/admin/admins", `{"email":"NOU@rost.ro","password":"o-alta-parola-lunga"}`); code != 409 {
		t.Errorf("duplicate admin = %d", code)
	}
	if _, out := c.do("GET", "/api/admin/admins", ""); len(out["admins"].([]any)) != 2 {
		t.Errorf("admins = %v", out)
	}

	c.do("POST", "/api/admin/logout", "")
	if c.cookies[AdminCookie] != nil {
		t.Error("cookie kept after logout")
	}
	if code, _ := c.do("GET", "/api/admin/me", ""); code != 401 {
		t.Errorf("me after logout = %d", code)
	}
	// old token is dead after logout
	c.cookies[AdminCookie] = ck
	if code, _ := c.do("GET", "/api/admin/me", ""); code != 401 {
		t.Errorf("old token after logout = %d", code)
	}
}

func TestAdminLoginIsRateLimited(t *testing.T) {
	c := adminClient(t)
	for i := 0; i < 5; i++ {
		c.do("POST", "/api/admin/login", `{"email":"admin@rost.ro","password":"gresit-gresit-gresit"}`)
	}
	if code, _ := c.do("POST", "/api/admin/login", `{"email":"admin@rost.ro","password":"`+adminPassword+`"}`); code != 429 {
		t.Errorf("after 5 failures = %d, want 429 even with the right password", code)
	}
}

func TestAdminEditsContent(t *testing.T) {
	c := adminClient(t)
	if code, _ := c.do("GET", "/api/admin/content/moments", ""); code != 401 {
		t.Fatalf("content without login = %d", code)
	}
	c.login()

	if _, out := c.do("GET", "/api/admin/content/moments", ""); len(out["items"].([]any)) != 7 {
		t.Fatalf("seeded moments = %v", out)
	}
	if code, _ := c.do("GET", "/api/admin/content/games", ""); code != 404 {
		t.Errorf("unknown kind = %d", code)
	}

	code, out := c.do("POST", "/api/admin/content/moments", `{"status":"draft","doc":`+newMoment+`}`)
	if code != 201 {
		t.Fatalf("create = %d %v", code, out)
	}
	item := out["item"].(map[string]any)
	if item["updatedBy"] != "admin@rost.ro" || item["position"] != 80.0 {
		t.Errorf("created = %v", item)
	}
	if code, _ := c.do("POST", "/api/admin/content/moments", `{"status":"draft","doc":`+newMoment+`}`); code != 409 {
		t.Errorf("duplicate = %d", code)
	}
	if code, out := c.do("POST", "/api/admin/content/moments", `{"status":"draft","doc":{"id":"x"}}`); code != 400 || out["error"] == "" {
		t.Errorf("invalid doc = %d %v", code, out)
	}
	if code, _ := c.do("POST", "/api/admin/content/moments", `{"status":"live","doc":`+newMoment+`}`); code != 400 {
		t.Errorf("bad status = %d", code)
	}

	// drafts are not public
	if code, _ := c.do("GET", "/api/library/buget_50_30_20", ""); code != 404 {
		t.Errorf("draft is public: %d", code)
	}
	if _, out := c.do("GET", "/api/library", ""); len(out["moments"].([]any)) != 7 {
		t.Errorf("library with a draft = %d moments", len(out["moments"].([]any)))
	}

	if code, out := c.do("PUT", "/api/admin/content/moments/buget_50_30_20", `{"status":"published","position":5,"doc":`+newMoment+`}`); code != 200 {
		t.Fatalf("publish = %d %v", code, out)
	}
	_, lib := c.do("GET", "/api/library", "")
	if first := lib["moments"].([]any)[0].(map[string]any); first["id"] != "buget_50_30_20" {
		t.Errorf("position 5 should come first, got %v", first["id"])
	}
	renamed := strings.Replace(newMoment, `"id":"buget_50_30_20"`, `"id":"alt_id"`, 1)
	if code, _ := c.do("PUT", "/api/admin/content/moments/buget_50_30_20", `{"status":"published","doc":`+renamed+`}`); code != 400 {
		t.Errorf("id change = %d", code)
	}
	if code, _ := c.do("PUT", "/api/admin/content/moments/nu_exista", `{"status":"published","doc":`+strings.Replace(newMoment, "buget_50_30_20", "nu_exista", 1)+`}`); code != 404 {
		t.Errorf("update unknown = %d", code)
	}

	if code, _ := c.do("DELETE", "/api/admin/content/moments/buget_50_30_20", ""); code != 200 {
		t.Errorf("delete = %d", code)
	}
	if code, _ := c.do("GET", "/api/admin/content/moments/buget_50_30_20", ""); code != 404 {
		t.Errorf("after delete = %d", code)
	}

	// unpublished news disappears from stiri
	_, news := c.do("GET", "/api/admin/content/news/bnr", "")
	doc := jsonString(news["item"].(map[string]any)["doc"])
	if code, out := c.do("PUT", "/api/admin/content/news/bnr", `{"status":"draft","doc":`+doc+`}`); code != 200 {
		t.Fatalf("unpublish news = %d %v", code, out)
	}
	c.do("POST", "/api/users", `{"demo":"maria"}`)
	if _, out := c.do("GET", "/api/stiri", ""); len(out["items"].([]any)) != 2 {
		t.Errorf("stiri after unpublishing = %v", out["items"])
	}
}
