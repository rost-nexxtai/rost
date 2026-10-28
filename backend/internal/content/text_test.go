package content

import (
	"encoding/json"
	"strings"
	"testing"

	"rost/backend/internal/domain"
)

func seedMoments(t *testing.T) []domain.LibraryMoment {
	t.Helper()
	items, err := Seed()
	if err != nil {
		t.Fatal(err)
	}
	var out []domain.LibraryMoment
	for _, it := range items {
		if it.Kind == domain.KindMoment {
			ms, err := Moments([]domain.ContentItem{it})
			if err != nil {
				t.Fatal(err)
			}
			out = append(out, ms[0])
		}
	}
	return out
}

func lesson(t *testing.T, id string) domain.LibraryMoment {
	t.Helper()
	for _, m := range seedMoments(t) {
		if m.ID == id {
			return m
		}
	}
	t.Fatalf("no lesson %s in the seed", id)
	return domain.LibraryMoment{}
}

// Round-trips through JSON so tests can edit steps the way an admin's document would arrive.
func clone(t *testing.T, m domain.LibraryMoment) domain.LibraryMoment {
	t.Helper()
	raw, _ := json.Marshal(m)
	var out domain.LibraryMoment
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestEverySeedLessonHasEnglish(t *testing.T) {
	for _, m := range seedMoments(t) {
		if m.EN == nil || m.EN.Title == "" || len(m.EN.Steps) != len(m.Steps) {
			t.Errorf("%s: missing or incomplete English", m.ID)
		}
	}
}

func TestEnglishMustMatchTheLesson(t *testing.T) {
	cases := map[string]func(m *domain.LibraryMoment){
		"missing title":         func(m *domain.LibraryMoment) { m.EN.Title = " " },
		"one takeaway short":    func(m *domain.LibraryMoment) { m.EN.Takeaways = m.EN.Takeaways[1:] },
		"one step short":        func(m *domain.LibraryMoment) { m.EN.Steps = m.EN.Steps[1:] },
		"answer in translation": func(m *domain.LibraryMoment) { m.EN.Steps[3]["correct"] = 2.0 },
		"an option short": func(m *domain.LibraryMoment) {
			m.EN.Steps[3]["options"] = m.EN.Steps[3]["options"].([]any)[1:]
		},
		"bucket changed in a sort item": func(m *domain.LibraryMoment) {
			m.EN.Steps[0]["items"].([]any)[0].(map[string]any)["bucket"] = 1.0
		},
		"missing reason for a card": func(m *domain.LibraryMoment) {
			delete(m.EN.Steps[0]["items"].([]any)[0].(map[string]any), "why")
		},
		"cta link in translation": func(m *domain.LibraryMoment) {
			m.EN.Steps[4]["cta"] = map[string]any{"label": "Go", "href": "https://evil.example"}
		},
		"text the lesson doesn't have": func(m *domain.LibraryMoment) { m.EN.Steps[2]["unit"] = "x" },
	}
	for name, change := range cases {
		m := clone(t, lesson(t, "fondul_urgenta"))
		change(&m)
		if err := ValidateMoment(&m); err == nil || !strings.HasPrefix(err.Error(), "en: ") {
			t.Errorf("%s: got %v, want an en: error", name, err)
		}
	}
	// No English at all is fine: the lesson stays Romanian.
	m := clone(t, lesson(t, "fondul_urgenta"))
	m.EN = nil
	if err := ValidateMoment(&m); err != nil {
		t.Errorf("lesson without English: %v", err)
	}
}

func TestLocalize(t *testing.T) {
	m := lesson(t, "fondul_urgenta")
	ro, en := Localize(m, "ro"), Localize(m, "en")
	if ro.EN != nil || en.EN != nil {
		t.Error("the translation block leaked into the served lesson")
	}
	if ro.Title != "Fondul de urgență" || en.Title != "Your emergency fund" {
		t.Errorf("titles = %q / %q", ro.Title, en.Title)
	}
	roItem := ro.Steps[0]["items"].([]any)[0].(map[string]any)
	enItem := en.Steps[0]["items"].([]any)[0].(map[string]any)
	if enItem["bucket"] != roItem["bucket"] || enItem["label"] == roItem["label"] || enItem["why"] == roItem["why"] {
		t.Errorf("sort item: ro %v, en %v", roItem, enItem)
	}
	if en.Steps[1]["answerValue"] != ro.Steps[1]["answerValue"] || en.Steps[1]["unit"] != "months" {
		t.Errorf("predict: %v", en.Steps[1])
	}
	if en.Steps[3]["correct"] != ro.Steps[3]["correct"] {
		t.Error("the right answer changed with the language")
	}
	cta := en.Steps[4]["cta"].(map[string]any)
	if cta["href"] != "/active/cont_economii" || cta["label"] != "See savings accounts" {
		t.Errorf("cta = %v", cta)
	}
	// The source lesson is untouched.
	if m.EN == nil || m.Title != "Fondul de urgență" {
		t.Error("Localize changed its input")
	}
}

func TestAcceptRange(t *testing.T) {
	step := lesson(t, "fondul_urgenta").Steps[1] // 3–6 months
	for guess, want := range map[float64]bool{3: true, 4.5: true, 6: true, 2: true, 8: false, 0: false} {
		if got := PredictRight(step, guess); got != want {
			t.Errorf("guess %v: %v, want %v", guess, got, want)
		}
	}
	m := clone(t, lesson(t, "fondul_urgenta"))
	m.Steps[1]["acceptRange"] = []any{4.0, 6.0} // doesn't contain the answer (3)
	if err := ValidateMoment(&m); err == nil {
		t.Error("an acceptRange without the answer was accepted")
	}
}
