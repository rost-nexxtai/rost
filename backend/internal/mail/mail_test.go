package mail

import (
	"context"
	"io"
	"log/slog"
	"mime"
	"mime/quotedprintable"
	netmail "net/mail"
	"strings"
	"testing"

	"rost/backend/internal/config"
)

func TestCompose(t *testing.T) {
	link := "https://rost.test/api/auth/verify?token=abc_DEF-123"
	raw := SMTP{From: "Rost <noreply@rost.test>"}.compose(Message{To: "ana@example.ro", Subject: "Linkul tău", Body: "Deschide:\n\n" + link + "\n"})
	m, err := netmail.ReadMessage(strings.NewReader(string(raw)))
	if err != nil {
		t.Fatal(err)
	}
	if to, _ := m.Header.AddressList("To"); len(to) != 1 || to[0].Address != "ana@example.ro" || m.Header.Get("Date") == "" {
		t.Errorf("header = %v", m.Header)
	}
	if subj, _ := new(mime.WordDecoder).DecodeHeader(m.Header.Get("Subject")); subj != "Linkul tău" {
		t.Errorf("subject = %q", subj)
	}
	body, _ := io.ReadAll(quotedprintable.NewReader(m.Body))
	if !strings.Contains(string(body), link) {
		t.Errorf("body = %q", body)
	}
}

// Without SMTP, a production server (no demo tools) logs only that a mail would have gone: never the
// link, the token in it or the address.
func TestLogMailerHidesLinksWithoutDemoTools(t *testing.T) {
	for _, demo := range []bool{false, true} {
		var logs strings.Builder
		m := FromConfig(config.Config{AllowDemoTools: demo}, slog.New(slog.NewTextHandler(&logs, nil)))
		_ = m.Send(context.Background(), Message{To: "ana@example.ro", Subject: "Login", Body: "https://rost.test/api/auth/verify?token=s3cret"})
		if leaked := strings.Contains(logs.String(), "s3cret") || strings.Contains(logs.String(), "ana@"); leaked != demo {
			t.Errorf("demo tools %v: log = %s", demo, logs.String())
		}
	}
}
