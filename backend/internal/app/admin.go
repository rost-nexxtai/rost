package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/mail"
	"strings"
	"sync"
	"time"

	"rost/backend/internal/auth"
	"rost/backend/internal/clock"
	"rost/backend/internal/content"
	"rost/backend/internal/domain"
	"rost/backend/internal/store"
)

// real time, not the demo clock
const AdminSessionTTL = 12 * time.Hour

var (
	ErrBadLogin  = errors.New("wrong email or password")
	ErrBadEmail  = errors.New("invalid email")
	ErrNoSession = errors.New("not signed in")
)

func NormalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }

func validEmail(email string) bool {
	a, err := mail.ParseAddress(email)
	return err == nil && a.Address == email
}

func (s Service) CreateAdmin(ctx context.Context, email, password string) (domain.Admin, error) {
	email = NormalizeEmail(email)
	if !validEmail(email) {
		return domain.Admin{}, ErrBadEmail
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return domain.Admin{}, err
	}
	return s.Store.CreateAdmin(ctx, domain.Admin{Email: email, PasswordHash: hash})
}

// first admin from env, leaves it alone if it exists
func (s Service) EnsureAdmin(ctx context.Context, email, password string) (created bool, err error) {
	_, err = s.Store.GetAdminByEmail(ctx, NormalizeEmail(email))
	if err == nil {
		return false, nil
	}
	if !errors.Is(err, store.ErrNotFound) {
		return false, err
	}
	_, err = s.CreateAdmin(ctx, email, password)
	return err == nil, err
}

var (
	dummyOnce sync.Once
	dummyHash string
)

// unknown email takes as long as a wrong password
func (s Service) Login(ctx context.Context, email, password string) (token string, a domain.Admin, err error) {
	a, err = s.Store.GetAdminByEmail(ctx, NormalizeEmail(email))
	if errors.Is(err, store.ErrNotFound) {
		dummyOnce.Do(func() { dummyHash, _ = auth.HashPassword("not-a-real-password") })
		auth.CheckPassword(dummyHash, password)
		return "", a, ErrBadLogin
	}
	if err != nil {
		return "", a, err
	}
	if !auth.CheckPassword(a.PasswordHash, password) {
		return "", a, ErrBadLogin
	}
	token, hash, err := auth.NewToken()
	if err != nil {
		return "", a, err
	}
	err = s.Store.CreateAdminSession(ctx, domain.AdminSession{
		TokenHash: hash, AdminID: a.ID, ExpiresAt: clock.ISO(time.Now().Add(AdminSessionTTL)),
	})
	return token, a, err
}

func (s Service) AdminForToken(ctx context.Context, token string) (domain.Admin, error) {
	if token == "" {
		return domain.Admin{}, ErrNoSession
	}
	hash := auth.HashToken(token)
	sess, err := s.Store.GetAdminSession(ctx, hash)
	if errors.Is(err, store.ErrNotFound) {
		return domain.Admin{}, ErrNoSession
	}
	if err != nil {
		return domain.Admin{}, err
	}
	if exp, err := clock.Parse(sess.ExpiresAt); err != nil || !time.Now().Before(exp) {
		_ = s.Store.DeleteAdminSession(ctx, hash)
		return domain.Admin{}, ErrNoSession
	}
	a, err := s.Store.GetAdmin(ctx, sess.AdminID)
	if errors.Is(err, store.ErrNotFound) {
		return a, ErrNoSession
	}
	return a, err
}

func (s Service) Logout(ctx context.Context, token string) error {
	return s.Store.DeleteAdminSession(ctx, auth.HashToken(token))
}

// ---- content ----

type ContentInput struct {
	Status   domain.ContentStatus `json:"status"`
	Position *int                 `json:"position"`
	Doc      json.RawMessage      `json:"doc"`
}

func checkInput(kind domain.ContentKind, in ContentInput) (string, json.RawMessage, error) {
	if in.Status != domain.StatusDraft && in.Status != domain.StatusPublished {
		return "", nil, content.ValidationError{Msg: "status must be draft or published"}
	}
	if len(in.Doc) == 0 {
		return "", nil, content.ValidationError{Msg: "doc is required"}
	}
	return content.Validate(kind, in.Doc)
}

// no position = goes last
func (s Service) CreateContent(ctx context.Context, kind domain.ContentKind, in ContentInput, by domain.Admin) (domain.ContentItem, error) {
	id, doc, err := checkInput(kind, in)
	if err != nil {
		return domain.ContentItem{}, err
	}
	pos := 0
	if in.Position != nil {
		pos = *in.Position
	} else {
		items, err := s.Store.ListContent(ctx, kind, true)
		if err != nil {
			return domain.ContentItem{}, err
		}
		for _, c := range items {
			pos = max(pos, c.Position)
		}
		pos += 10
	}
	return s.Store.CreateContent(ctx, domain.ContentItem{Kind: kind, ID: id, Status: in.Status, Position: pos, Doc: doc, UpdatedBy: by.Email})
}

// ids can't change, completions point to them
func (s Service) UpdateContent(ctx context.Context, kind domain.ContentKind, id string, in ContentInput, by domain.Admin) (domain.ContentItem, error) {
	docID, doc, err := checkInput(kind, in)
	if err != nil {
		return domain.ContentItem{}, err
	}
	if docID != id {
		return domain.ContentItem{}, content.ValidationError{Msg: "the id in doc must match the URL; ids can't be changed"}
	}
	cur, err := s.Store.GetContent(ctx, kind, id)
	if err != nil {
		return domain.ContentItem{}, err
	}
	pos := cur.Position
	if in.Position != nil {
		pos = *in.Position
	}
	return s.Store.UpdateContent(ctx, domain.ContentItem{Kind: kind, ID: id, Status: in.Status, Position: pos, Doc: doc, UpdatedBy: by.Email})
}
