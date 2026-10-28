package content

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"rost/backend/internal/domain"
)

// textKeys are the fields of each step type that hold words. Everything else in a step (answers,
// numbers, ids, links) comes from the Romanian lesson and can't be overridden by a translation.
var textKeys = map[string][]string{
	"choice":      {"question", "options", "explain"},
	"predict":     {"question", "unit", "explain"},
	"sort":        {"question", "buckets", "items", "explain"},
	"explore":     {"title", "body"},
	"stat":        {"value", "label", "body"},
	"asset_range": {},
	"finish":      {"cta"},
}

func str(v any) (string, bool) {
	s, ok := v.(string)
	return s, ok
}

func list(v any) ([]any, bool) {
	l, ok := v.([]any)
	return l, ok
}

// plain turns a step (maybe decoded into typed values) into plain JSON values, so the checks
// below see the same shapes whether the lesson came from the database or from Go code.
func plain(step domain.LibraryStep) (map[string]any, error) {
	raw, err := json.Marshal(step)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	return out, json.Unmarshal(raw, &out)
}

// validateText checks a lesson's English block: complete, and the same shape as the lesson.
func validateText(m *domain.LibraryMoment) error {
	t := m.EN
	switch {
	case blank(t.Title) || len(t.Title) > 120:
		return errors.New("title is required (at most 120 characters)")
	case blank(t.Hook) || len(t.Hook) > 200:
		return errors.New("hook is required (at most 200 characters)")
	case blank(t.Series):
		return errors.New("series is required")
	case len(t.Takeaways) != len(m.Takeaways) || slices.ContainsFunc(t.Takeaways, blank):
		return fmt.Errorf("needs %d non-empty takeaways, one per takeaway", len(m.Takeaways))
	case len(t.Steps) != len(m.Steps):
		return fmt.Errorf("needs %d steps, one per step", len(m.Steps))
	}
	for i := range m.Steps {
		ro, err := plain(m.Steps[i])
		if err != nil {
			return err
		}
		en, err := plain(t.Steps[i])
		if err != nil {
			return err
		}
		if err := validateStepText(ro, en); err != nil {
			return fmt.Errorf("step %d: %v", i+1, err)
		}
	}
	return nil
}

func validateStepText(ro, en map[string]any) error {
	kind, _ := str(ro["type"])
	keys, ok := textKeys[kind]
	if !ok {
		return fmt.Errorf("unknown step type %v", ro["type"])
	}
	for k := range en {
		if k != "type" && !slices.Contains(keys, k) {
			return fmt.Errorf("%q can't be translated in a %s step", k, kind)
		}
	}
	if t, ok := en["type"]; ok && t != kind {
		return fmt.Errorf("type is %v, the lesson has %s", t, kind)
	}
	for _, k := range keys {
		want, has := ro[k]
		got, given := en[k]
		if !has || want == "" {
			if given {
				return fmt.Errorf("%q has no Romanian text to translate", k)
			}
			continue
		}
		if !given {
			return fmt.Errorf("%q is missing", k)
		}
		if err := sameShape(k, want, got); err != nil {
			return err
		}
	}
	return nil
}

// sameShape checks one translated field against the Romanian one: a string for a string, a list
// of the same length, and for sort items and the finish button only the words inside.
func sameShape(key string, ro, en any) error {
	switch key {
	case "options", "buckets":
		a, _ := list(ro)
		b, ok := list(en)
		if !ok || len(a) != len(b) {
			return fmt.Errorf("%q needs %d entries", key, len(a))
		}
		for _, v := range b {
			if s, ok := str(v); !ok || blank(s) {
				return fmt.Errorf("%q can't have empty entries", key)
			}
		}
	case "items":
		a, _ := list(ro)
		b, ok := list(en)
		if !ok || len(a) != len(b) {
			return fmt.Errorf("items needs %d entries", len(a))
		}
		for i := range a {
			ra, _ := a[i].(map[string]any)
			eb, ok := b[i].(map[string]any)
			if !ok {
				return fmt.Errorf("item %d must be an object", i+1)
			}
			for k := range eb {
				if k != "label" && k != "why" {
					return fmt.Errorf("item %d: only label and why can be translated", i+1)
				}
			}
			if s, _ := str(eb["label"]); blank(s) {
				return fmt.Errorf("item %d needs a label", i+1)
			}
			if why, _ := str(ra["why"]); why != "" {
				if s, _ := str(eb["why"]); blank(s) {
					return fmt.Errorf("item %d needs a why", i+1)
				}
			}
		}
	case "cta":
		eb, ok := en.(map[string]any)
		if !ok || len(eb) != 1 {
			return errors.New("cta can only translate its label")
		}
		if s, _ := str(eb["label"]); blank(s) {
			return errors.New("cta needs a label")
		}
	default:
		if s, ok := str(en); !ok || blank(s) {
			return fmt.Errorf("%q must be non-empty text", key)
		}
	}
	return nil
}

// Localize returns the lesson in the given language ("ro" or "en"), without the translation block.
// Lessons with no English yet stay in Romanian.
func Localize(m domain.LibraryMoment, lang string) domain.LibraryMoment {
	t := m.EN
	m.EN = nil
	if lang != "en" || t == nil {
		return m
	}
	m.Title, m.Hook, m.Series = t.Title, t.Hook, t.Series
	m.Takeaways = append([]string{}, t.Takeaways...)
	steps := make([]domain.LibraryStep, len(m.Steps))
	for i, s := range m.Steps {
		step, err := plain(s)
		if err != nil || i >= len(t.Steps) {
			steps[i] = s
			continue
		}
		words, _ := plain(t.Steps[i])
		for k, v := range words {
			switch k {
			case "type":
			case "items":
				items, _ := list(step["items"])
				out := make([]any, len(items))
				tr, _ := list(v)
				for j, it := range items {
					item, _ := it.(map[string]any)
					merged := map[string]any{}
					for ik, iv := range item {
						merged[ik] = iv
					}
					if j < len(tr) {
						if w, ok := tr[j].(map[string]any); ok {
							for wk, wv := range w {
								merged[wk] = wv
							}
						}
					}
					out[j] = merged
				}
				step["items"] = out
			case "cta":
				cta, _ := step["cta"].(map[string]any)
				merged := map[string]any{}
				for ck, cv := range cta {
					merged[ck] = cv
				}
				if w, ok := v.(map[string]any); ok {
					merged["label"] = w["label"]
				}
				step["cta"] = merged
			default:
				step[k] = v
			}
		}
		steps[i] = step
	}
	m.Steps = steps
	return m
}

// PredictRight says whether a guess on a predict step counts: close to the answer (like isClose in
// the app), or inside the step's acceptRange when it has one.
func PredictRight(step domain.LibraryStep, guess float64) bool {
	s, err := plain(step)
	if err != nil {
		return false
	}
	n := func(k string) float64 { v, _ := s[k].(float64); return v }
	var r *[2]float64
	if l, ok := list(s["acceptRange"]); ok && len(l) == 2 {
		a, _ := l[0].(float64)
		b, _ := l[1].(float64)
		r = &[2]float64{a, b}
	}
	return predictRight(guess, n("answerValue"), r, n("min"), n("max"), n("step"))
}

func predictRight(guess, answer float64, accept *[2]float64, min, max, step float64) bool {
	if accept != nil && guess >= accept[0] && guess <= accept[1] {
		return true
	}
	return IsClose(guess, answer, min, max, step)
}
