package server

import (
	"testing"

	"rost/backend/internal/config"
)

// After the quiz: save the account with an email and a password, then open it in another browser.
func TestSaveAccountAndLogIn(t *testing.T) {
	h := testServer(fakeDB{}, config.Config{AllowDemoTools: true})
	phone := &client{t: t, h: h}
	if code, out := phone.do("POST", "/api/auth/register", `{"email":"ana@example.com","password":"parola-buna"}`); code != 401 {
		t.Fatalf("save without a session = %d %v", code, out)
	}
	phone.do("POST", "/api/quiz", quizAllNuStiu)
	id := phone.id()

	for name, c := range map[string]struct {
		body string
		code int
		err  string
	}{
		"bad email":      {`{"email":"ana","password":"parola-buna"}`, 400, "invalid_email"},
		"short password": {`{"email":"ana@example.com","password":"scurta"}`, 400, "weak_password"},
	} {
		if code, out := phone.do("POST", "/api/auth/register", c.body); code != c.code || out["error"] != c.err {
			t.Errorf("%s = %d %v", name, code, out)
		}
	}
	if code, out := phone.do("POST", "/api/auth/register", `{"email":" Ana@Example.com ","password":"parola-buna"}`); code != 200 || out["email"] != "ana@example.com" {
		t.Fatalf("save = %d %v", code, out)
	}
	if code, out := phone.do("POST", "/api/auth/register", `{"email":"ana@example.com","password":"alta-parola"}`); code != 409 || out["error"] != "account_saved" {
		t.Errorf("save twice = %d %v", code, out)
	}

	// someone else can't take the email
	other := &client{t: t, h: h}
	other.do("POST", "/api/quiz", quizAllNuStiu)
	if code, out := other.do("POST", "/api/auth/register", `{"email":"ana@example.com","password":"parola-buna"}`); code != 409 || out["error"] != "email_taken" {
		t.Errorf("taken = %d %v", code, out)
	}

	// a new browser logs in; wrong password and unknown email answer the same
	laptop := &client{t: t, h: h}
	for _, body := range []string{`{"email":"ana@example.com","password":"gresita!"}`, `{"email":"nimeni@example.com","password":"parola-buna"}`} {
		if code, out := laptop.do("POST", "/api/auth/login", body); code != 401 || out["error"] != "bad_login" {
			t.Errorf("bad login %s = %d %v", body, code, out)
		}
	}
	if code, _ := laptop.do("POST", "/api/auth/login", `{"email":"ANA@example.com","password":"parola-buna"}`); code != 200 {
		t.Fatalf("login = %d", code)
	}
	if laptop.id() != id {
		t.Errorf("logged into %s, want %s", laptop.id(), id)
	}
	_, me := laptop.do("GET", "/api/me", "")
	if get(me, "user", "email") != "ana@example.com" || me["profile"] == nil {
		t.Errorf("me after login = %v", me)
	}
	if _, ok := get(me, "user").(map[string]any)["passwordHash"]; ok {
		t.Error("the password hash must never leave the server")
	}

	// signing out on the laptop leaves the phone signed in
	laptop.do("DELETE", "/api/users", "")
	if laptop.id() != "" || phone.id() != id {
		t.Error("sign-out should end only the laptop's session")
	}

	// the demo persona can't be saved under someone's email
	demo := &client{t: t, h: h}
	demo.do("POST", "/api/users", `{"demo":"maria"}`)
	if code, out := demo.do("POST", "/api/auth/register", `{"email":"maria@example.com","password":"parola-buna"}`); code != 403 || out["error"] != "demo_account" {
		t.Errorf("demo save = %d %v", code, out)
	}
}

func TestPasswordLoginLimit(t *testing.T) {
	h := testServer(fakeDB{}, config.Config{RateLimitsOff: true})
	c := &client{t: t, h: h}
	c.do("POST", "/api/quiz", quizAllNuStiu)
	c.do("POST", "/api/auth/register", `{"email":"ion@example.com","password":"parola-buna"}`)
	other := &client{t: t, h: h}
	code := 0
	for i := 0; i < 20 && code != 429; i++ {
		code, _ = other.do("POST", "/api/auth/login", `{"email":"ion@example.com","password":"nu-e-buna"}`)
	}
	if code != 429 {
		t.Fatalf("guessing passwords never stopped: %d", code)
	}
	// the right password waits too, until the window passes
	if code, _ := other.do("POST", "/api/auth/login", `{"email":"ion@example.com","password":"parola-buna"}`); code != 429 {
		t.Errorf("right password while limited = %d", code)
	}
}
