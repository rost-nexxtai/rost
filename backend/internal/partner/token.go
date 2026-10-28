// Package partner signs and verifies the token a partner bank uses to open a Rost moment
// inside its app. The token carries no customer identity and no transactions: only an age band,
// the triggering event and category SHARES the bank computed on its side.
package partner

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
)

type Claims struct {
	PartnerID       string                `json:"partnerId"`
	AgeBand         string                `json:"ageBand"`
	Event           string                `json:"event"`
	Shares          domain.CategoryShares `json:"shares"`
	Monthly         *domain.MonthlyLines  `json:"monthly,omitempty"`
	GrossMonthly    *float64              `json:"grossMonthly,omitempty"`
	MonthlyExpenses *float64              `json:"monthlyExpenses,omitempty"`
	jwt.RegisteredClaims
}

const devSecret = "dev-secret-change-me"

// secretFor reads the partner's secret from the env var named in partners.json. With demo tools
// on (allowDemo) and no secret set, the stage demo falls back to the dev secret.
func secretFor(partnerID string, allowDemo bool) ([]byte, error) {
	p, ok := reference.GetPartner(&partnerID)
	if !ok || p.SecretEnv == nil {
		return nil, fmt.Errorf("unknown partner %s", partnerID)
	}
	secret := os.Getenv(*p.SecretEnv)
	if secret == "" && allowDemo {
		secret = devSecret
	}
	if secret == "" {
		return nil, fmt.Errorf("no secret configured for %s", partnerID)
	}
	return []byte(secret), nil
}

// Sign is what a bank does on its own side. Rost exposes it only for the stage demo.
func Sign(c Claims, ttl time.Duration, allowDemo bool) (string, error) {
	key, err := secretFor(c.PartnerID, allowDemo)
	if err != nil {
		return "", err
	}
	now := time.Now()
	c.RegisteredClaims = jwt.RegisteredClaims{
		Issuer:    c.PartnerID,
		Audience:  jwt.ClaimStrings{"rost"},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(key)
}

// Verify checks the signature with the claimed partner's secret, the issuer, the audience and the expiry.
func Verify(token string, allowDemo bool) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, errors.New("malformed token")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, errors.New("malformed token")
	}
	var unverified struct {
		PartnerID string `json:"partnerId"`
	}
	if err := json.Unmarshal(raw, &unverified); err != nil || unverified.PartnerID == "" {
		return Claims{}, errors.New("token has no partnerId")
	}
	key, err := secretFor(unverified.PartnerID, allowDemo)
	if err != nil {
		return Claims{}, err
	}
	var c Claims
	_, err = jwt.ParseWithClaims(token, &c, func(*jwt.Token) (any, error) { return key, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithIssuer(unverified.PartnerID),
		jwt.WithAudience("rost"),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return Claims{}, err
	}
	return c, nil
}
