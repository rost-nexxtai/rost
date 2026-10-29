package server

import (
	"testing"

	"rost/backend/internal/clock"
	"rost/backend/internal/config"
)

func TestPayslipPreview(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	// 6,000 lei is 34 steps of 50 lei above the 4,325 minimum wage: a 3% deduction, 130 lei
	code, p := c.do("GET", "/api/payslip?gross=6000", "")
	if code != 200 || p["pension"] != 1500.0 || p["health"] != 600.0 || p["personalDeduction"] != 130.0 || p["net"] != 3523.0 {
		t.Errorf("payslip = %d %v", code, p)
	}
	// under 26: another 15% of the minimum wage
	if code, p := c.do("GET", "/api/payslip?gross=6000&young=true", ""); code != 200 || p["personalDeduction"] != 779.0 || p["net"] != 3588.0 {
		t.Errorf("young payslip = %d %v", code, p)
	}
	// with a session, the user's age band decides: Maria is under 25
	c.do("POST", "/api/users", `{"demo":"maria"}`)
	if code, p := c.do("GET", "/api/payslip?gross=6000", ""); code != 200 || p["personalDeduction"] != 779.0 {
		t.Errorf("Maria's payslip = %d %v", code, p)
	}
	for _, q := range []string{"", "?gross=abc", "?gross=10", "?gross=900000"} {
		if code, _ := c.do("GET", "/api/payslip"+q, ""); code != 400 {
			t.Errorf("GET /api/payslip%s = %d", q, code)
		}
	}
}

func TestSalaryChangeOverHTTP(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{AllowDemoTools: true})}
	if code, _ := c.do("PUT", "/api/me/salary", `{"grossMonthly":7000}`); code != 401 {
		t.Fatalf("without a session = %d", code)
	}
	c.do("POST", "/api/users", `{"demo":"maria"}`)
	for _, bad := range []string{`{}`, `{"grossMonthly":"7000"}`, `{"grossMonthly":50}`} {
		if code, _ := c.do("PUT", "/api/me/salary", bad); code != 400 {
			t.Errorf("%s = %d", bad, code)
		}
	}

	// A raise: dated today, and the payslip moment opens again with the new numbers.
	code, up := c.do("PUT", "/api/me/salary", `{"grossMonthly":7000}`)
	if code != 200 || up["raise"] != true || up["before"] != 6000.0 || get(up, "payslip", "pension") != 1750.0 {
		t.Fatalf("raise = %d %v", code, up)
	}
	if get(up, "user", "lastRaiseDate") != clock.TodayISO() {
		t.Errorf("lastRaiseDate = %v", get(up, "user", "lastRaiseDate"))
	}
	runs := up["runs"].([]any)
	if len(runs) != 1 || runs[0].(map[string]any)["momentId"] != "payslip_explained" {
		t.Fatalf("runs = %v", runs)
	}
	_, moment := c.do("GET", "/api/moments/"+runs[0].(map[string]any)["id"].(string), "")
	if get(moment, "view", "payslip", "gross") != 7000.0 {
		t.Errorf("moment payslip = %v", get(moment, "view", "payslip"))
	}

	// Another raise while that moment is still open: it points to the same run, now with the new numbers.
	_, again := c.do("PUT", "/api/me/salary", `{"grossMonthly":7500}`)
	if r := again["runs"].([]any); len(r) != 1 || r[0].(map[string]any)["id"] != runs[0].(map[string]any)["id"] {
		t.Errorf("second raise runs = %v", again["runs"])
	}

	// A cut: saved and shown, no raise, nothing reopened.
	_, down := c.do("PUT", "/api/me/salary", `{"grossMonthly":6500}`)
	if down["raise"] != false || down["before"] != 7500.0 || len(down["runs"].([]any)) != 0 || get(down, "user", "grossMonthly") != 6500.0 {
		t.Errorf("cut = %v", down)
	}
	_, me := c.do("GET", "/api/me", "")
	if get(me, "user", "grossMonthly") != 6500.0 {
		t.Errorf("me = %v", me["user"])
	}
}

func TestFirstSalaryIsNotARaise(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	c.do("POST", "/api/users", `{"situations":["employed"]}`)
	_, out := c.do("PUT", "/api/me/salary", `{"grossMonthly":5000}`)
	if out["raise"] != false || out["before"] != nil || len(out["runs"].([]any)) != 0 {
		t.Errorf("first salary = %v", out)
	}
}
