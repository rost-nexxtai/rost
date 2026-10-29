package server

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"rost/backend/internal/config"
	"rost/backend/internal/reference"
	"rost/backend/internal/store/storetest"
)

// logBuffer is a logger whose lines a test can read.
type logBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *logBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *logBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func (b *logBuffer) logger() *slog.Logger { return slog.New(slog.NewJSONHandler(b, nil)) }

func send(h http.Handler, method, path, body string, header map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range header {
		if k == "RemoteAddr" {
			req.RemoteAddr = v
		} else {
			req.Header.Set(k, v)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func errorOf(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var out apiError
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("not a JSON error: %q", rec.Body)
	}
	return out.Error
}

func TestPanicAnswers500AndIsLogged(t *testing.T) {
	var logs logBuffer
	boom := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic("boom") })
	h := withRequestID(logRequests(logs.logger(), recoverPanics(logs.logger(), boom)))

	rec := send(h, "GET", "/api/today", "", map[string]string{requestIDHeader: "trace-1"})
	if rec.Code != 500 || errorOf(t, rec) != "internal error" {
		t.Fatalf("panic = %d %s", rec.Code, rec.Body)
	}
	got := logs.String()
	for _, want := range []string{`"msg":"panic"`, `"err":"boom"`, `"requestId":"trace-1"`, "goroutine", `"status":500`} {
		if !strings.Contains(got, want) {
			t.Errorf("log lacks %s:\n%s", want, got)
		}
	}
}

func TestPanicAfterTheResponseStartedIsOnlyLogged(t *testing.T) {
	var logs logBuffer
	h := recoverPanics(logs.logger(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		panic("late")
	}))
	rec := send(h, "GET", "/api/today", "", nil)
	if rec.Code != 200 || strings.Contains(rec.Body.String(), "internal error") {
		t.Errorf("late panic = %d %s", rec.Code, rec.Body)
	}
	if !strings.Contains(logs.String(), `"err":"late"`) {
		t.Errorf("late panic not logged")
	}
}

func TestRequestID(t *testing.T) {
	var logs logBuffer
	h := New(Deps{Logger: logs.logger(), DB: fakeDB{}, Store: storetest.New(reference.DemoUsers()...)})

	if got := send(h, "GET", "/api/health", "", map[string]string{requestIDHeader: "abc-123.X_y"}).Header().Get(requestIDHeader); got != "abc-123.X_y" {
		t.Errorf("sane id = %q", got)
	}
	if !strings.Contains(logs.String(), `"requestId":"abc-123.X_y"`) {
		t.Errorf("request log lacks the id:\n%s", logs.String())
	}
	for _, bad := range []string{"", "has space", "<script>", "a\"b", strings.Repeat("a", 65)} {
		got := send(h, "GET", "/api/health", "", map[string]string{requestIDHeader: bad}).Header().Get(requestIDHeader)
		if got == bad || !validRequestID(got) || len(got) != 16 {
			t.Errorf("id for %q = %q, want a fresh one", bad, got)
		}
	}
	a := send(h, "GET", "/api/health", "", nil).Header().Get(requestIDHeader)
	b := send(h, "GET", "/api/health", "", nil).Header().Get(requestIDHeader)
	if a == b {
		t.Errorf("generated ids repeat: %q", a)
	}
}

func TestInternalErrorLogsTheRequestID(t *testing.T) {
	var logs logBuffer
	s := &server{Deps: Deps{Logger: logs.logger()}}
	h := withRequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.internal(w, r, io.ErrUnexpectedEOF)
	}))
	send(h, "GET", "/api/me", "", map[string]string{requestIDHeader: "trace-2"})
	if got := logs.String(); !strings.Contains(got, `"requestId":"trace-2"`) || !strings.Contains(got, "request failed") {
		t.Errorf("internal log = %s", got)
	}
}

func TestCrossSiteGuard(t *testing.T) {
	h := testServer(fakeDB{}, config.Config{})
	demo := `{"demo":"maria"}`
	cases := []struct {
		name, method, path, body, site string
		want                           int
	}{
		{"cross-site create refused", "POST", "/api/users", demo, "cross-site", 403},
		{"cross-site sign-out refused", "DELETE", "/api/users", "", "cross-site", 403},
		{"cross-site salary refused", "PUT", "/api/me/salary", `{}`, "cross-site", 403},
		{"cross-site profile edit refused", "PATCH", "/api/me", `{}`, "cross-site", 403},
		{"same-origin passes", "POST", "/api/users", demo, "same-origin", 200},
		{"same-site passes", "POST", "/api/users", demo, "same-site", 200},
		{"typed in passes", "POST", "/api/users", demo, "none", 200},
		{"no header passes", "POST", "/api/users", demo, "", 200},
		{"cross-site read passes", "GET", "/api/health", "", "cross-site", 200},
		// Allow-listed: answered by the handler (unknown click), not the guard.
		{"postback passes", "POST", "/api/referrals/postback", `{"clickId":"nope","status":"opened"}`, "cross-site", 404},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			hdr := map[string]string{}
			if c.site != "" {
				hdr["Sec-Fetch-Site"] = c.site
			}
			rec := send(h, c.method, c.path, c.body, hdr)
			if rec.Code != c.want {
				t.Fatalf("%s %s = %d %s, want %d", c.method, c.path, rec.Code, rec.Body, c.want)
			}
			if c.want == 403 && errorOf(t, rec) != "cross-site request refused" {
				t.Errorf("body = %s", rec.Body)
			}
		})
	}
}

// fakeClock is a clock a test moves by hand.
type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time { return c.t }

func TestRateLimiterBucket(t *testing.T) {
	clk := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	l := newRateLimiter(rateLimit{Per: 10 * time.Minute, Burst: 5}, clk.now)
	for i := range 5 {
		if ok, _ := l.allow("a"); !ok {
			t.Fatalf("call %d refused inside the burst", i+1)
		}
	}
	ok, wait := l.allow("a")
	if ok || wait != 2*time.Minute {
		t.Fatalf("6th = %v, wait %v; want refused for 2m", ok, wait)
	}
	if ok, _ := l.allow("b"); !ok {
		t.Error("another key shares the bucket")
	}
	clk.t = clk.t.Add(time.Minute)
	if ok, wait := l.allow("a"); ok || wait != time.Minute {
		t.Errorf("after 1m = %v, wait %v", ok, wait)
	}
	clk.t = clk.t.Add(time.Minute)
	if ok, _ := l.allow("a"); !ok {
		t.Error("a token should be back after 2m")
	}
	// Idle buckets are swept once a full period has passed.
	clk.t = clk.t.Add(11 * time.Minute)
	l.allow("c")
	if len(l.buckets) != 1 {
		t.Errorf("buckets after sweep = %d, want 1", len(l.buckets))
	}
}

func TestRateLimitsOverHTTP(t *testing.T) {
	read := func(h http.Handler, hdr map[string]string) *httptest.ResponseRecorder {
		return send(h, "POST", "/api/payslip/read", "", hdr)
	}
	burst := rateLimits["payslip"].Burst

	t.Run("429 with Retry-After, per IP", func(t *testing.T) {
		h := testServer(fakeDB{}, config.Config{})
		one := map[string]string{"RemoteAddr": "203.0.113.1:5000"}
		for range burst {
			if rec := read(h, one); rec.Code != http.StatusNotImplemented {
				t.Fatalf("inside the burst = %d", rec.Code)
			}
		}
		rec := read(h, one)
		if rec.Code != 429 || rec.Header().Get("Retry-After") != "120" || errorOf(t, rec) != "too many requests" {
			t.Fatalf("over the limit = %d, Retry-After %q, %s", rec.Code, rec.Header().Get("Retry-After"), rec.Body)
		}
		if rec := read(h, map[string]string{"RemoteAddr": "203.0.113.2:5000"}); rec.Code == 429 {
			t.Error("another IP is limited too")
		}
		// Other limited routes keep their own buckets.
		if rec := send(h, "POST", "/api/users", `{"demo":"maria"}`, one); rec.Code != 200 {
			t.Errorf("users after payslip limit = %d", rec.Code)
		}
	})

	t.Run("X-Forwarded-For ignored unless trusted", func(t *testing.T) {
		h := testServer(fakeDB{}, config.Config{})
		for i := range burst + 1 {
			rec := read(h, map[string]string{"RemoteAddr": "10.0.0.2:5000", "X-Forwarded-For": "198.51.100." + strconv.Itoa(i+1)})
			if i == burst && rec.Code != 429 {
				t.Fatalf("spoofed XFF escaped the limit: %d", rec.Code)
			}
		}
	})

	t.Run("X-Forwarded-For keys the bucket behind a trusted proxy", func(t *testing.T) {
		h := testServer(fakeDB{}, config.Config{TrustProxy: true})
		proxied := func(xff string) map[string]string {
			return map[string]string{"RemoteAddr": "10.0.0.2:5000", "X-Forwarded-For": xff}
		}
		for range burst {
			read(h, proxied("198.51.100.7"))
		}
		if rec := read(h, proxied("198.51.100.7")); rec.Code != 429 {
			t.Fatalf("same client = %d", rec.Code)
		}
		if rec := read(h, proxied("198.51.100.8")); rec.Code == 429 {
			t.Error("another client shares the bucket")
		}
		// A client can't escape by prepending its own entries.
		if rec := read(h, proxied("1.2.3.4, 198.51.100.7")); rec.Code != 429 {
			t.Errorf("prepended XFF escaped the limit: %d", rec.Code)
		}
	})

	t.Run("off", func(t *testing.T) {
		h := testServer(fakeDB{}, config.Config{RateLimitsOff: true})
		for range burst + 3 {
			if rec := read(h, nil); rec.Code == 429 {
				t.Fatal("limited with RATE_LIMITS=off")
			}
		}
	})
}

func TestClientIP(t *testing.T) {
	cases := []struct {
		name, remote, xff string
		trust             bool
		want              string
	}{
		{"peer", "203.0.113.1:5000", "", false, "203.0.113.1"},
		{"XFF ignored when not trusted", "203.0.113.1:5000", "198.51.100.1", false, "203.0.113.1"},
		{"trusted without XFF", "127.0.0.1:5000", "", true, "127.0.0.1"},
		{"trusted, one hop", "10.0.0.2:5000", "198.51.100.1", true, "198.51.100.1"},
		{"right-most public entry", "10.0.0.2:5000", "1.2.3.4, 198.51.100.1, 172.18.0.5", true, "198.51.100.1"},
		{"all private: left-most", "127.0.0.1:5000", "192.168.1.20, 10.0.0.3", true, "192.168.1.20"},
		{"IPv6", "[::1]:5000", "2001:db8::1", true, "2001:db8::1"},
		{"garbage falls back to the peer", "10.0.0.2:5000", "1.2.3.4, nonsense", true, "10.0.0.2"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = c.remote
			if c.xff != "" {
				r.Header.Set("X-Forwarded-For", c.xff)
			}
			if got := clientIP(r, c.trust); got != c.want {
				t.Errorf("clientIP = %q, want %q", got, c.want)
			}
		})
	}
}

// fakeAnthropic answers like the model and keeps the media type it was sent.
type fakeAnthropic struct{ mediaType string }

func (f *fakeAnthropic) RoundTrip(r *http.Request) (*http.Response, error) {
	var body struct {
		Messages []struct {
			Content []struct {
				Source struct {
					MediaType string `json:"media_type"`
				} `json:"source"`
			} `json:"content"`
		} `json:"messages"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	f.mediaType = body.Messages[0].Content[0].Source.MediaType
	out := `{"content":[{"type":"text","text":"{\"grossLei\": 6000, \"confidence\": 0.9}"}]}`
	return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(out)), Request: r}, nil
}

func uploadPayslip(t *testing.T, h http.Handler, label string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreatePart(map[string][]string{
		"Content-Disposition": {`form-data; name="image"; filename="payslip"`},
		"Content-Type":        {label},
	})
	if err != nil {
		t.Fatal(err)
	}
	part.Write(data)
	mw.Close()
	req := httptest.NewRequestWithContext(context.Background(), "POST", "/api/payslip/read", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestPayslipUploadIsSniffed(t *testing.T) {
	fake := &fakeAnthropic{}
	saved := anthropicClient
	anthropicClient = &http.Client{Transport: fake}
	t.Cleanup(func() { anthropicClient = saved })
	h := testServer(fakeDB{}, config.Config{AnthropicAPIKey: "test", PayslipModel: "test-model"})

	var pngBytes bytes.Buffer
	if err := png.Encode(&pngBytes, image.NewGray(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	rec := uploadPayslip(t, h, "image/jpeg", pngBytes.Bytes())
	if rec.Code != 200 || fake.mediaType != "image/png" {
		t.Fatalf("PNG labelled JPEG = %d %s, sent upstream as %q", rec.Code, rec.Body, fake.mediaType)
	}

	fake.mediaType = ""
	rec = uploadPayslip(t, h, "image/png", []byte("Salariu brut: 6000 lei, honest"))
	if rec.Code != http.StatusUnsupportedMediaType || errorOf(t, rec) != "unsupported image type" || fake.mediaType != "" {
		t.Fatalf("text labelled PNG = %d %s (upstream %q)", rec.Code, rec.Body, fake.mediaType)
	}
}

func TestAPIHeaders(t *testing.T) {
	h := testServer(fakeDB{}, config.Config{})
	for _, path := range []string{"/api/health", "/api/library", "/api/nope", "/healthz"} {
		rec := send(h, "GET", path, "", nil)
		if rec.Header().Get("X-Content-Type-Options") != "nosniff" || rec.Header().Get("Cache-Control") != "no-store" {
			t.Errorf("GET %s headers = %v", path, rec.Header())
		}
	}
	// A handler's own Cache-Control wins.
	own := apiHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=60")
		writeJSON(w, 200, map[string]bool{"ok": true})
	}))
	if got := send(own, "GET", "/api/x", "", nil).Header().Get("Cache-Control"); got != "public, max-age=60" {
		t.Errorf("handler Cache-Control = %q", got)
	}
}
