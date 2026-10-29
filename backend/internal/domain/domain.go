// Package domain holds the runtime records the API reads and writes.
// JSON tags match the shapes the frontend expects (frontend/src/contract.ts).
package domain

type Situation string

const (
	Student     Situation = "student"
	Graduate    Situation = "graduate"
	Employed    Situation = "employed"
	Freelance   Situation = "freelance"
	BetweenJobs Situation = "between_jobs"
)

type FirstDone string

type EventType string

const (
	SalaryReceived      EventType = "salary_received"
	PayslipUploaded     EventType = "payslip_uploaded"
	Pillar2DeadlineNear EventType = "pillar2_deadline_near"
	InflationPublished  EventType = "inflation_published"
	ShockScenario       EventType = "shock_scenario"
	Graduated           EventType = "graduated"
	Raise               EventType = "raise"
	CatchUp             EventType = "catch_up"
)

// EventTypes is every event a client may fire.
var EventTypes = []EventType{
	SalaryReceived, PayslipUploaded, Pillar2DeadlineNear, InflationPublished, ShockScenario, Graduated, Raise, CatchUp,
}

type EventSource string

const (
	SourceSimulator EventSource = "simulator"
	SourceCalendar  EventSource = "calendar"
	SourceBank      EventSource = "bank"
	SourceUser      EventSource = "user"
	SourceEditor    EventSource = "editor"
)

// CategoryShares are spending shares (or rates) in INS's three main groups.
type CategoryShares struct {
	Services float64 `json:"services"`
	NonFood  float64 `json:"nonFood"`
	Food     float64 `json:"food"`
}

// MonthlyLines are monthly lei for the lines a scenario can shock.
type MonthlyLines struct {
	Fuel      *float64 `json:"fuel,omitempty"`
	Utilities *float64 `json:"utilities,omitempty"`
	Food      *float64 `json:"food,omitempty"`
}

// Line returns the monthly lei for a spend line, or 0 when unknown.
func (m MonthlyLines) Line(name string) float64 {
	var p *float64
	switch name {
	case "fuel":
		p = m.Fuel
	case "utilities":
		p = m.Utilities
	case "food":
		p = m.Food
	}
	if p == nil {
		return 0
	}
	return *p
}

type SpendingProfile struct {
	Shares  CategoryShares `json:"shares"`
	Monthly MonthlyLines   `json:"monthly"`
	Source  string         `json:"source"`
}

type User struct {
	ID              string           `json:"id"`
	Name            *string          `json:"name,omitempty"`
	Situations      []Situation      `json:"situations"`
	Payday          *int             `json:"payday,omitempty"`
	HireDate        *string          `json:"hireDate,omitempty"`
	GrossMonthly    *float64         `json:"grossMonthly,omitempty"`
	LastRaiseDate   *string          `json:"lastRaiseDate,omitempty"`
	MonthlyExpenses *float64         `json:"monthlyExpenses,omitempty"`
	FirstsDone      []FirstDone      `json:"firstsDone"`
	Spending        *SpendingProfile `json:"spending,omitempty"`
	// nil until the quiz
	Quiz *QuizProfile `json:"quiz,omitempty"`
	// max level reached, never goes down
	LevelEarned Level `json:"levelEarned"`
	// lessons left halfway and the days with a finished lesson; nil until the first lesson
	Learning  *Learning `json:"learning,omitempty"`
	CreatedAt string    `json:"createdAt"`
}

// One answer in a lesson: picked for choice, value for predict, buckets for sort (one per item),
// order for order (the items as the user left them, top to bottom, as indexes into the step's list).
type LessonAnswer struct {
	Step    int      `json:"step"`
	Picked  *int     `json:"picked,omitempty"`
	Value   *float64 `json:"value,omitempty"`
	Buckets []int    `json:"buckets,omitempty"`
	Order   []int    `json:"order,omitempty"`
}

// A lesson left halfway: the screen to resume on and the graded answers so far.
type LessonProgress struct {
	Step    int    `json:"step"`
	Results []bool `json:"results"`
	// the answers behind results, so a resumed lesson is scored on all of them at the end
	Answers []LessonAnswer `json:"answers"`
	// how many screens the lesson had, so a lesson edited since starts over
	Of int `json:"of"`
	// when it was saved, so the oldest is dropped first
	SavedAt string `json:"savedAt,omitempty"`
}

type Learning struct {
	LessonProgress map[string]LessonProgress `json:"lessonProgress,omitempty"`
	// YYYY-MM-DD in Romanian time, oldest first, the last two weeks only
	LearnedDays []string `json:"learnedDays,omitempty"`
}

// AgeBand from the quiz, "" before it.
func (u User) AgeBand() string {
	if u.Quiz == nil {
		return ""
	}
	return u.Quiz.AgeBand
}

func (u User) HasSituation(s Situation) bool {
	for _, x := range u.Situations {
		if x == s {
			return true
		}
	}
	return false
}

type AppEvent struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	Type      EventType      `json:"type"`
	Payload   map[string]any `json:"payload"`
	Source    EventSource    `json:"source"`
	CreatedAt string         `json:"createdAt"`
}

type RunState string

const (
	RunPending   RunState = "pending"
	RunStarted   RunState = "started"
	RunCompleted RunState = "completed"
	RunDismissed RunState = "dismissed"
)

type MomentRun struct {
	ID             string         `json:"id"`
	UserID         string         `json:"userId"`
	MomentID       string         `json:"momentId"`
	TriggerEventID *string        `json:"triggerEventId,omitempty"`
	State          RunState       `json:"state"`
	Guess          *float64       `json:"guess,omitempty"`
	Result         map[string]any `json:"result,omitempty"`
	CreatedAt      string         `json:"createdAt"`
	StartedAt      *string        `json:"startedAt,omitempty"`
	CompletedAt    *string        `json:"completedAt,omitempty"`
}

type ActionStatus string

const (
	ActionSet       ActionStatus = "set"
	ActionConfirmed ActionStatus = "confirmed"
	ActionSkipped   ActionStatus = "skipped"
)

type Action struct {
	ID          string         `json:"id"`
	UserID      string         `json:"userId"`
	MomentRunID string         `json:"momentRunId"`
	Type        string         `json:"type"`
	Params      map[string]any `json:"params"`
	Status      ActionStatus   `json:"status"`
	FollowUpAt  string         `json:"followUpAt"`
	CreatedAt   string         `json:"createdAt"`
}

type ReferralStatus string

const (
	ReferralClicked ReferralStatus = "clicked"
	ReferralOpened  ReferralStatus = "opened"
	ReferralFunded  ReferralStatus = "funded"
)

type Referral struct {
	ID        string         `json:"id"`
	ClickID   string         `json:"clickId"`
	UserID    *string        `json:"userId,omitempty"`
	OfferID   string         `json:"offerId"`
	PartnerID *string        `json:"partnerId,omitempty"`
	Status    ReferralStatus `json:"status"`
	FeeLei    float64        `json:"feeLei"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
}

// Ptr returns a pointer to v, for optional fields.
func Ptr[T any](v T) *T { return &v }
