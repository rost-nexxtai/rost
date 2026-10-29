// Package content checks what admins save (moments, news).
package content

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"

	"rost/backend/internal/domain"
)

// same as AssetId in the frontend
var AssetIDs = []string{"cont_economii", "depozit", "titluri_stat", "etf", "actiuni", "aur"}

// Architecture.md: 5 min max
const MaxMinutes = 5

// same rules as lessons.test.ts in the frontend
const (
	maxSteps     = 7
	minGraded    = 2
	minTakeaways = 2
)

// widgets from components/lesson/widgets.tsx
var Widgets = []string{"fund_builder", "compound", "savings_vs_deposit", "diversify", "bonds_vs_deposit"}

var slug = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,63}$`)

// -> 400
type ValidationError struct{ Msg string }

func (e ValidationError) Error() string { return e.Msg }

func invalid(format string, a ...any) error { return ValidationError{fmt.Sprintf(format, a...)} }

func IsValidation(err error) bool {
	var v ValidationError
	return errors.As(err, &v)
}

// unknown fields = error, so typos don't get saved
func decodeStrict(raw []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return invalid("invalid document: %v", err)
	}
	return nil
}

func blank(s string) bool { return strings.TrimSpace(s) == "" }

// only /paths or https, no javascript: links
func safeHref(h string) bool {
	return (strings.HasPrefix(h, "/") && !strings.HasPrefix(h, "//")) || strings.HasPrefix(h, "https://")
}

// returns the id and the cleaned json
func Validate(kind domain.ContentKind, doc json.RawMessage) (string, json.RawMessage, error) {
	var (
		v   any
		id  string
		err error
	)
	switch kind {
	case domain.KindMoment:
		var m domain.LibraryMoment
		if err = decodeStrict(doc, &m); err == nil {
			err = ValidateMoment(&m)
		}
		v, id = m, m.ID
	case domain.KindNews:
		var n domain.NewsItem
		if err = decodeStrict(doc, &n); err == nil {
			err = ValidateNews(n)
		}
		v, id = n, n.ID
	default:
		return "", nil, invalid("unknown content kind %q", kind)
	}
	if err != nil {
		return "", nil, err
	}
	out, err := json.Marshal(v)
	return id, out, err
}

// also nil lists -> []
func ValidateMoment(m *domain.LibraryMoment) error {
	switch {
	case !slug.MatchString(m.ID):
		return invalid("id must be 2-64 characters: a-z, 0-9, _ or -")
	case blank(m.Title) || len(m.Title) > 120:
		return invalid("title is required (at most 120 characters)")
	case blank(m.Hook) || len(m.Hook) > 200:
		return invalid("hook is required (at most 200 characters)")
	case blank(m.Series):
		return invalid("series is required")
	case m.Level < 0 || m.Level > 2:
		return invalid("level must be 0, 1 or 2")
	case m.Minutes < 1 || m.Minutes > MaxMinutes:
		return invalid("minutes must be between 1 and %d", MaxMinutes)
	}
	if m.AssetIDs == nil {
		m.AssetIDs = []string{}
	}
	for _, a := range m.AssetIDs {
		if !slices.Contains(AssetIDs, a) {
			return invalid("unknown asset %q", a)
		}
	}
	if m.Steps == nil {
		m.Steps = []domain.LibraryStep{}
	}
	if m.Takeaways == nil {
		m.Takeaways = []string{}
	}
	if slices.ContainsFunc(m.Takeaways, blank) {
		return invalid("takeaways can't be empty")
	}
	if m.EN != nil {
		if err := validateText(m); err != nil {
			return invalid("en: %v", err)
		}
	}
	graded := 0
	for i, s := range m.Steps {
		if err := validateStep(s); err != nil {
			return invalid("step %d: %v", i+1, err)
		}
		if IsGraded(s) {
			graded++
		}
	}
	// no steps = "în curând", the rest only applies to written lessons
	n := len(m.Steps)
	switch {
	case n == 0:
	case n > maxSteps:
		return invalid("at most %d steps", maxSteps)
	case m.Steps[n-1]["type"] != "finish":
		return invalid("the last step must be a finish step")
	case graded < minGraded:
		return invalid("needs at least %d choice, predict, sort or order steps", minGraded)
	case len(m.Takeaways) < minTakeaways:
		return invalid("needs at least %d takeaways", minTakeaways)
	}
	return nil
}

// choice, predict, sort and order count towards the score
func IsGraded(step domain.LibraryStep) bool {
	t := step["type"]
	return t == "choice" || t == "predict" || t == "sort" || t == "order"
}

type choiceStep struct {
	Type     string   `json:"type"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Correct  *int     `json:"correct"`
	Explain  string   `json:"explain"`
}

type predictStep struct {
	Type        string   `json:"type"`
	Question    string   `json:"question"`
	AnswerValue *float64 `json:"answerValue"`
	// any guess in [from, to] also counts as right, e.g. 3–6 months for the emergency fund
	AcceptRange *[2]float64 `json:"acceptRange"`
	Min         float64     `json:"min"`
	Max         float64     `json:"max"`
	Step        float64     `json:"step"`
	Unit        string      `json:"unit"`
	Start       *float64    `json:"start"`
	Explain     string      `json:"explain"`
}

type sortStep struct {
	Type     string   `json:"type"`
	Question string   `json:"question"`
	Buckets  []string `json:"buckets"`
	Items    []struct {
		Label  string `json:"label"`
		Bucket *int   `json:"bucket"`
		// one line shown when this card is sorted wrong
		Why string `json:"why"`
	} `json:"items"`
	Explain string `json:"explain"`
}

// The app shuffles the items and the user drags them back into this order, top to bottom.
type orderStep struct {
	Type     string   `json:"type"`
	Question string   `json:"question"`
	Ordered  []string `json:"ordered"`
	// labels for the two ends of the list, e.g. "safest" and "riskiest"
	Top     string `json:"top"`
	Bottom  string `json:"bottom"`
	Explain string `json:"explain"`
}

type exploreStep struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Widget string `json:"widget"`
}

type statStep struct {
	Type  string `json:"type"`
	Value string `json:"value"`
	Label string `json:"label"`
	Body  string `json:"body"`
}

// same as isClose in PredictStep.tsx
func IsClose(guess, answer, min, max, step float64) bool {
	return math.Abs(guess-answer) <= math.Max(step, (max-min)/10)
}

type assetRangeStep struct {
	Type    string `json:"type"`
	AssetID string `json:"assetId"`
}

type finishStep struct {
	Type string `json:"type"`
	CTA  struct {
		Label string `json:"label"`
		Href  string `json:"href"`
	} `json:"cta"`
}

// shapes from LibraryStep in data/types.ts
func validateStep(step domain.LibraryStep) error {
	raw, err := json.Marshal(step)
	if err != nil {
		return err
	}
	switch step["type"] {
	case "choice":
		var s choiceStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.Question) || blank(s.Explain) {
			return errors.New("choice needs a question and an explanation")
		}
		if len(s.Options) < 2 || len(s.Options) > 6 || slices.ContainsFunc(s.Options, blank) {
			return errors.New("choice needs 2 to 6 non-empty options")
		}
		if s.Correct == nil || *s.Correct < 0 || *s.Correct >= len(s.Options) {
			return errors.New("correct must be the index of one of the options")
		}
	case "predict":
		var s predictStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.Question) || s.AnswerValue == nil {
			return errors.New("predict needs a question and an answerValue")
		}
		if !(s.Min < s.Max) || !(s.Step > 0) || *s.AnswerValue < s.Min || *s.AnswerValue > s.Max {
			return errors.New("predict needs min < max, step > 0 and min <= answerValue <= max")
		}
		if r := s.AcceptRange; r != nil && !(s.Min <= r[0] && r[0] <= *s.AnswerValue && *s.AnswerValue <= r[1] && r[1] <= s.Max) {
			return errors.New("predict acceptRange must be on the scale and contain the answerValue")
		}
		// otherwise the slider starts on the answer
		if s.Start != nil && (*s.Start < s.Min || *s.Start > s.Max || predictRight(*s.Start, *s.AnswerValue, s.AcceptRange, s.Min, s.Max, s.Step)) {
			return errors.New("predict start must be on the scale and not next to the answer")
		}
	case "sort":
		var s sortStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.Question) || blank(s.Explain) {
			return errors.New("sort needs a question and an explanation")
		}
		if len(s.Buckets) != 2 || slices.ContainsFunc(s.Buckets, blank) {
			return errors.New("sort needs exactly 2 buckets")
		}
		used := map[int]bool{}
		for _, it := range s.Items {
			if blank(it.Label) || it.Bucket == nil || (*it.Bucket != 0 && *it.Bucket != 1) {
				return errors.New("each sort item needs a label and bucket 0 or 1")
			}
			used[*it.Bucket] = true
		}
		if len(s.Items) > 12 || !used[0] || !used[1] {
			return errors.New("sort needs at most 12 items, with both buckets used")
		}
	case "order":
		var s orderStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.Question) || blank(s.Explain) || blank(s.Top) || blank(s.Bottom) {
			return errors.New("order needs a question, top and bottom labels and an explanation")
		}
		if len(s.Ordered) < 3 || len(s.Ordered) > 6 || slices.ContainsFunc(s.Ordered, blank) {
			return errors.New("order needs 3 to 6 non-empty items")
		}
		seen := map[string]bool{}
		for _, it := range s.Ordered {
			if seen[it] {
				return errors.New("order items must be different")
			}
			seen[it] = true
		}
	case "explore":
		var s exploreStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.Title) || !slices.Contains(Widgets, s.Widget) {
			return errors.New("explore needs a title and a known widget")
		}
	case "stat":
		var s statStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.Value) || blank(s.Label) {
			return errors.New("stat needs a value and a label")
		}
	case "asset_range":
		var s assetRangeStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if !slices.Contains(AssetIDs, s.AssetID) {
			return fmt.Errorf("unknown asset %q", s.AssetID)
		}
	case "finish":
		var s finishStep
		if err := decodeStrict(raw, &s); err != nil {
			return err
		}
		if blank(s.CTA.Label) || !safeHref(s.CTA.Href) {
			return errors.New("finish needs a cta with a label and an href starting with / or https://")
		}
	default:
		return fmt.Errorf("unknown step type %v", step["type"])
	}
	return nil
}

var NewsLines = []string{"fuelLei", "electricityLei"}

func ValidateNews(n domain.NewsItem) error {
	switch {
	case !slug.MatchString(n.ID):
		return invalid("id must be 2-64 characters: a-z, 0-9, _ or -")
	case blank(n.Title) || len(n.Title) > 200:
		return invalid("title is required (at most 200 characters)")
	case blank(n.Date):
		return invalid("date is required")
	case len(n.Facts) == 0 || slices.ContainsFunc(n.Facts, blank):
		return invalid("at least one non-empty fact is required")
	case len(n.Sources) == 0:
		return invalid("at least one source is required")
	case !slug.MatchString(n.MomentID) || !safeHref(n.MomentHref) || !strings.HasPrefix(n.MomentHref, "/"):
		return invalid("momentId and a momentHref starting with / are required")
	}
	for i, s := range n.Sources {
		if blank(s.Label) || blank(s.Date) || !strings.HasPrefix(s.URL, "https://") {
			return invalid("source %d needs a label, a date and an https:// url", i+1)
		}
	}
	switch im := n.Impact; im.Kind {
	case "spend":
		if !slices.Contains(NewsLines, im.Line) || im.Shock == nil || im.Alternative != nil {
			return invalid("a spend impact needs line (fuelLei or electricityLei) and shock")
		}
		if s := im.Shock; !(s.MinPct <= s.DefaultPct && s.DefaultPct <= s.MaxPct && s.MinPct < s.MaxPct) {
			return invalid("shock needs minPct <= defaultPct <= maxPct")
		}
	case "savings":
		if im.Alternative == nil || blank(im.Alternative.Label) || im.Line != "" || im.Shock != nil {
			return invalid("a savings impact needs an alternative with a label and ratePct")
		}
	default:
		return invalid("impact kind must be spend or savings")
	}
	return nil
}

// already validated when saved
func Moments(items []domain.ContentItem) ([]domain.LibraryMoment, error) {
	return decodeAll[domain.LibraryMoment](items)
}

func News(items []domain.ContentItem) ([]domain.NewsItem, error) {
	return decodeAll[domain.NewsItem](items)
}

func decodeAll[T any](items []domain.ContentItem) ([]T, error) {
	out := make([]T, 0, len(items))
	for _, c := range items {
		var v T
		if err := json.Unmarshal(c.Doc, &v); err != nil {
			return nil, fmt.Errorf("content %s/%s: %w", c.Kind, c.ID, err)
		}
		out = append(out, v)
	}
	return out, nil
}

//go:embed seed
var seedFiles embed.FS

// Bump to seed new items into an existing db and refresh the ones no admin has edited since.
const SeedName = "content-v2"

// the frontend fixtures, all published
func Seed() ([]domain.ContentItem, error) {
	out := []domain.ContentItem{}
	for _, kind := range domain.ContentKinds {
		raw, err := seedFiles.ReadFile("seed/" + string(kind) + ".json")
		if err != nil {
			return nil, err
		}
		var docs []json.RawMessage
		if err := json.Unmarshal(raw, &docs); err != nil {
			return nil, fmt.Errorf("seed %s: %w", kind, err)
		}
		for i, d := range docs {
			id, doc, err := Validate(kind, d)
			if err != nil {
				return nil, fmt.Errorf("seed %s #%d: %w", kind, i+1, err)
			}
			out = append(out, domain.ContentItem{
				Kind: kind, ID: id, Status: domain.StatusPublished, Position: (i + 1) * 10, Doc: doc, UpdatedBy: "seed",
			})
		}
	}
	return out, nil
}
