package partner

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"rost/backend/internal/domain"
)

func TestTokenRoundTripAndTampering(t *testing.T) {
	t.Setenv("PARTNER_DEMO_SECRET", "")
	token, err := Sign(Claims{
		PartnerID: "demo-bank", AgeBand: "18-24", Event: "inflation_published",
		Shares: domain.CategoryShares{Services: 0.55, NonFood: 0.25, Food: 0.2},
	}, 15*time.Minute, true)
	if err != nil {
		t.Fatal(err)
	}
	c, err := Verify(token, true)
	if err != nil {
		t.Fatal(err)
	}
	if c.PartnerID != "demo-bank" || c.Shares.Services != 0.55 {
		t.Errorf("claims = %+v", c)
	}

	parts := strings.Split(token, ".")
	raw, _ := base64.RawURLEncoding.DecodeString(parts[1])
	var forged map[string]any
	_ = json.Unmarshal(raw, &forged)
	forged["shares"].(map[string]any)["services"] = 0.9
	b, _ := json.Marshal(forged)
	parts[1] = base64.RawURLEncoding.EncodeToString(b)
	if _, err := Verify(strings.Join(parts, "."), true); err == nil {
		t.Error("tampered token verified")
	}
}

func TestTokenNeedsSecretOutsideDemo(t *testing.T) {
	t.Setenv("PARTNER_DEMO_SECRET", "")
	if _, err := Sign(Claims{PartnerID: "demo-bank"}, time.Minute, false); err == nil {
		t.Error("signed with no secret and demo off")
	}
	t.Setenv("PARTNER_DEMO_SECRET", "real-secret")
	token, err := Sign(Claims{PartnerID: "demo-bank"}, time.Minute, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Verify(token, false); err != nil {
		t.Errorf("verify with configured secret: %v", err)
	}
}

func TestExpiredToken(t *testing.T) {
	token, err := Sign(Claims{PartnerID: "demo-bank"}, -time.Minute, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Verify(token, true); err == nil {
		t.Error("expired token verified")
	}
}
