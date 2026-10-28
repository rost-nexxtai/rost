package server

import (
	"testing"

	"rost/backend/internal/config"
)

func TestUpdateMeOverHTTP(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	if code, _ := c.do("PATCH", "/api/me", `{"payday":10}`); code != 401 {
		t.Fatalf("without a session = %d", code)
	}
	c.do("POST", "/api/users", `{"situations":["employed"],"grossMonthly":6000}`)

	for _, bad := range []string{
		`{"situations":[]}`,
		`{"situations":["pirate"]}`,
		`{"payday":32}`,
		`{"payday":-1}`,
		`{"hireDate":"last spring"}`,
		`{"monthlyExpenses":-5}`,
		`{"monthlyExpenses":5000000}`,
		`{"spendingShares":{"services":0,"nonFood":0,"food":0}}`,
		`{"spendingShares":{"services":-1,"nonFood":1,"food":1}}`,
	} {
		if code, _ := c.do("PATCH", "/api/me", bad); code != 400 {
			t.Errorf("%s = %d", bad, code)
		}
	}

	// Without a spending mix, inflation is the national figure.
	code, out := c.do("PATCH", "/api/me", `{"payday":10,"hireDate":"2026-09-01","monthlyExpenses":2800}`)
	if code != 200 || get(out, "user", "payday") != 10.0 || get(out, "user", "hireDate") != "2026-09-01" || get(out, "user", "monthlyExpenses") != 2800.0 {
		t.Fatalf("update = %d %v", code, out["user"])
	}
	if get(out, "user", "grossMonthly") != 6000.0 {
		t.Errorf("an update that doesn't mention the salary keeps it: %v", get(out, "user", "grossMonthly"))
	}
	national, _ := get(out, "inflation", "headlinePct").(float64)
	if national <= 0 || get(out, "inflation", "personalPct") != nil {
		t.Errorf("inflation without spending = %v", out["inflation"])
	}

	// A spending mix gives a personal inflation; more on services (which rose most) means higher.
	_, mix := c.do("PATCH", "/api/me", `{"spendingShares":{"services":70,"nonFood":15,"food":15}}`)
	personal, _ := get(mix, "inflation", "personalPct").(float64)
	if personal <= national {
		t.Errorf("services-heavy personal inflation %v should be above national %v", personal, national)
	}

	// The salary stops: a new situation, and the salary is forgotten.
	_, lost := c.do("PATCH", "/api/me", `{"situations":["between_jobs"],"noSalary":true}`)
	if s := get(lost, "user", "situations").([]any); len(s) != 1 || s[0] != "between_jobs" || get(lost, "user", "grossMonthly") != nil {
		t.Errorf("salary gone = %v", lost["user"])
	}

	// Zero and "" clear a field; GET /api/me shows the same user and inflation.
	c.do("PATCH", "/api/me", `{"payday":0,"hireDate":"","monthlyExpenses":0}`)
	_, me := c.do("GET", "/api/me", "")
	if get(me, "user", "payday") != nil || get(me, "user", "hireDate") != nil || get(me, "user", "monthlyExpenses") != nil {
		t.Errorf("cleared = %v", me["user"])
	}
	if get(me, "inflation", "personalPct") != personal {
		t.Errorf("GET /api/me inflation = %v", me["inflation"])
	}
}
