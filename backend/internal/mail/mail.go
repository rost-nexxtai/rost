// Package mail sends the app's few emails (login links): over SMTP, or only to the log.
package mail

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"mime"
	"mime/quotedprintable"
	"net"
	netmail "net/mail"
	"net/smtp"
	"time"

	"rost/backend/internal/config"
)

type Message struct {
	To      string
	Subject string
	// plain text
	Body string
}

type Mailer interface {
	Send(ctx context.Context, m Message) error
}

// FromConfig picks SMTP when SMTP_HOST is set, else the log. The log shows the body (and so the
// link) only with demo tools on; in production it says a mail would have gone, nothing more.
func FromConfig(cfg config.Config, logger *slog.Logger) Mailer {
	if cfg.SMTPHost != "" {
		return SMTP{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Password: cfg.SMTPPassword, From: cfg.MailFrom}
	}
	return Log{Logger: logger, ShowBody: cfg.AllowDemoTools}
}

// Log writes to the log instead of sending.
type Log struct {
	Logger *slog.Logger
	// with the recipient and the body (links in it log you in): dev and stage only
	ShowBody bool
}

func (l Log) Send(_ context.Context, m Message) error {
	if l.ShowBody {
		l.Logger.Info("mail not sent (no SMTP)", "to", m.To, "subject", m.Subject, "body", m.Body)
	} else {
		l.Logger.Info("mail not sent (no SMTP)", "subject", m.Subject)
	}
	return nil
}

// SMTP sends through a mail server: STARTTLS on 587 (required when there's a password), TLS on 465.
type SMTP struct {
	Host, Port     string
	User, Password string
	// "noreply@rost.ro" or "Rost <noreply@rost.ro>"
	From string
}

const smtpTimeout = 15 * time.Second

func (s SMTP) Send(ctx context.Context, m Message) error {
	from, err := netmail.ParseAddress(s.From)
	if err != nil {
		return fmt.Errorf("MAIL_FROM: %w", err)
	}
	deadline := time.Now().Add(smtpTimeout)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	addr := net.JoinHostPort(s.Host, s.Port)
	dialer := &net.Dialer{Deadline: deadline}
	var conn net.Conn
	if s.Port == "465" {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: s.Host})
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	_ = conn.SetDeadline(deadline)
	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp hello: %w", err)
	}
	defer c.Close()
	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: s.Host}); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}
	if s.User != "" {
		// PlainAuth refuses to send the password without TLS (except to localhost)
		if err := c.Auth(smtp.PlainAuth("", s.User, s.Password, s.Host)); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := c.Mail(from.Address); err != nil {
		return fmt.Errorf("smtp from: %w", err)
	}
	if err := c.Rcpt(m.To); err != nil {
		return fmt.Errorf("smtp to: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(s.compose(m)); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp send: %w", err)
	}
	return c.Quit()
}

// compose writes the message: UTF-8 text, quoted-printable.
func (s SMTP) compose(m Message) []byte {
	var b bytes.Buffer
	fmt.Fprintf(&b, "From: %s\r\n", s.From)
	fmt.Fprintf(&b, "To: %s\r\n", m.To)
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", m.Subject))
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	b.WriteString("MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n")
	qp := quotedprintable.NewWriter(&b)
	_, _ = qp.Write([]byte(m.Body))
	_ = qp.Close()
	return b.Bytes()
}
