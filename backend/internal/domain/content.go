package domain

import "encoding/json"

// ---- editable content ----

type ContentKind string

const (
	KindMoment ContentKind = "moments"
	KindNews   ContentKind = "news"
)

var ContentKinds = []ContentKind{KindMoment, KindNews}

type ContentStatus string

const (
	StatusDraft     ContentStatus = "draft"
	StatusPublished ContentStatus = "published"
)

// doc = the moment/news json, exactly what the app gets
type ContentItem struct {
	Kind      ContentKind     `json:"kind"`
	ID        string          `json:"id"`
	Status    ContentStatus   `json:"status"`
	Position  int             `json:"position"`
	Doc       json.RawMessage `json:"doc"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
	UpdatedBy string          `json:"updatedBy"`
}

type Level int

// kept as raw json, the frontend renders it as is
// choice, predict, sort, order, explore, stat, asset_range, finish
type LibraryStep = map[string]any

// no steps = "în curând"
type LibraryMoment struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	// one line, why it's worth the minutes
	Hook     string        `json:"hook"`
	Series   string        `json:"series"`
	Level    Level         `json:"level"`
	Core     bool          `json:"core"`
	Minutes  int           `json:"minutes"`
	AssetIDs []string      `json:"assetIds"`
	Steps    []LibraryStep `json:"steps"`
	// shown on the finish screen
	Takeaways []string `json:"takeaways"`
	// English words for the same lesson. Numbers and answers only live in the fields above.
	EN *LessonText `json:"en,omitempty"`
}

func (m LibraryMoment) Playable() bool { return len(m.Steps) > 0 }

// LessonText is a lesson's words in another language, step by step, with the same shape as the
// lesson: title, hook, series, one takeaway per takeaway and one entry per step holding only that
// step's text (question, options, explain, buckets, item labels and reasons, title, body, value,
// label, unit, cta label).
type LessonText struct {
	Title     string        `json:"title"`
	Hook      string        `json:"hook"`
	Series    string        `json:"series"`
	Takeaways []string      `json:"takeaways"`
	Steps     []LibraryStep `json:"steps"`
}

type NewsSource struct {
	Label string `json:"label"`
	URL   string `json:"url"`
	Date  string `json:"date"`
}

type NewsShock struct {
	DefaultPct float64 `json:"defaultPct"`
	MinPct     float64 `json:"minPct"`
	MaxPct     float64 `json:"maxPct"`
}

type NewsAlternative struct {
	Label   string  `json:"label"`
	RatePct float64 `json:"ratePct"`
}

// spend (with slider) or savings
type NewsImpact struct {
	Kind        string           `json:"kind"`
	Line        string           `json:"line,omitempty"`
	Shock       *NewsShock       `json:"shock,omitempty"`
	Alternative *NewsAlternative `json:"alternative,omitempty"`
}

type NewsItem struct {
	ID         string       `json:"id"`
	Date       string       `json:"date"`
	Title      string       `json:"title"`
	Facts      []string     `json:"facts"`
	Sources    []NewsSource `json:"sources"`
	Impact     NewsImpact   `json:"impact"`
	MomentID   string       `json:"momentId"`
	MomentHref string       `json:"momentHref"`
}

// ---- quiz and profile ----

type RiskProfile string

const (
	RiskPrudent    RiskProfile = "prudent"
	RiskEchilibrat RiskProfile = "echilibrat"
	RiskDinamic    RiskProfile = "dinamic"
)

// saved from the quiz, level/risk are computed on read
type QuizProfile struct {
	Score          int     `json:"score"`
	Level          Level   `json:"level"`
	AgeBand        string  `json:"ageBand"`
	Situation      string  `json:"situation"`
	BufferMonths   float64 `json:"bufferMonths"`
	ExpensiveDebt  bool    `json:"expensiveDebt"`
	Horizon        string  `json:"horizon"`
	FuelLei        float64 `json:"fuelLei"`
	ElectricityLei float64 `json:"electricityLei"`
	SavedLei       float64 `json:"savedLei"`
	// the money lines the user answered (fuelLei, electricityLei, savedLei): an answered 0 is real
	Known   []string `json:"known,omitempty"`
	TakenAt string   `json:"takenAt"`
}

// inflation is personal if we have their spending
type MoneyLines struct {
	FuelLei        float64 `json:"fuelLei"`
	ElectricityLei float64 `json:"electricityLei"`
	SavedLei       float64 `json:"savedLei"`
	InflationPct   float64 `json:"inflationPct"`
	// lines the user answered; the others are 0 and the app asks for them
	Known []string `json:"known"`
	// monthly spending, when the user gave it
	ExpensesLei       *float64 `json:"expensesLei,omitempty"`
	InflationPersonal bool     `json:"inflationPersonal"`
}

// same as Profile in frontend data/types.ts
type Profile struct {
	Name               *string     `json:"name,omitempty"`
	QuizScore          int         `json:"quizScore"`
	QuizLevel          Level       `json:"quizLevel"`
	Level              Level       `json:"level"`
	RiskProfile        RiskProfile `json:"riskProfile"`
	AgeBand            string      `json:"ageBand"`
	Situation          string      `json:"situation"`
	BufferMonths       float64     `json:"bufferMonths"`
	ExpensiveDebt      bool        `json:"expensiveDebt"`
	Horizon            string      `json:"horizon"`
	Money              MoneyLines  `json:"money"`
	CompletedMomentIDs []string    `json:"completedMomentIds"`
	// lessons left halfway, by id
	LessonProgress map[string]LessonProgress `json:"lessonProgress"`
	// days with a finished lesson, YYYY-MM-DD, oldest first
	LearnedDays []string `json:"learnedDays"`
}

// one row per user + moment
type Completion struct {
	UserID      string           `json:"userId"`
	MomentID    string           `json:"momentId"`
	Answers     []map[string]any `json:"answers"`
	Correct     int              `json:"correct"`
	Total       int              `json:"total"`
	CompletedAt string           `json:"completedAt"`
}

// ---- tracking ----

// UserID is nil before onboarding
type TrackEvent struct {
	ID        string         `json:"id"`
	UserID    *string        `json:"userId,omitempty"`
	Name      string         `json:"name"`
	Props     map[string]any `json:"props"`
	Path      string         `json:"path,omitempty"`
	CreatedAt string         `json:"createdAt"`
}

// ---- admins ----

type Admin struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"createdAt"`
}

type AdminSession struct {
	TokenHash string
	AdminID   string
	ExpiresAt string
}

// ---- user sessions and email login ----

// One signed-in browser. The cookie holds the token; only its hash is kept.
type Session struct {
	TokenHash  string `json:"-"`
	UserID     string `json:"-"`
	CreatedAt  string `json:"createdAt"`
	LastSeenAt string `json:"lastSeenAt"`
	ExpiresAt  string `json:"expiresAt"`
}

// A one-time email login link. Only the hash of its token is kept.
type LoginToken struct {
	TokenHash string
	Email     string
	// the session's user when the link was asked for, "" without one
	UserID string
	// hash of the nonce in the asking browser's rost_login cookie
	NonceHash string
	CreatedAt string
	ExpiresAt string
}
