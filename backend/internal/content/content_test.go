package content

import (
	"encoding/json"
	"strings"
	"testing"

	"rost/backend/internal/domain"
)

func TestSeedIsValid(t *testing.T) {
	items, err := Seed()
	if err != nil {
		t.Fatal(err)
	}
	counts := map[domain.ContentKind]int{}
	for _, c := range items {
		counts[c.Kind]++
		if c.Status != domain.StatusPublished {
			t.Errorf("%s not published", c.ID)
		}
	}
	if counts[domain.KindMoment] != 7 || counts[domain.KindNews] != 3 {
		t.Errorf("seed counts = %v", counts)
	}
	moments, err := Moments(items[:counts[domain.KindMoment]])
	if err != nil {
		t.Fatal(err)
	}
	playable := []string{}
	for _, m := range moments {
		if m.Playable() {
			playable = append(playable, m.ID)
		}
	}
	if strings.Join(playable, ",") != "fondul_urgenta,economii_vs_depozit,dobanda_compusa,titluri_stat,etf,actiuni,aur" {
		t.Errorf("playable = %v", playable)
	}
}

const goodMoment = `{"id":"test_moment","title":"Test","hook":"De ce merită.","series":"Fundația","level":0,"core":true,"minutes":3,"assetIds":["depozit"],
"steps":[
 {"type":"choice","question":"Q?","options":["a","b"],"correct":0,"explain":"Because."},
 {"type":"predict","question":"How much?","answerValue":3,"min":0,"max":12,"step":1,"unit":"luni","start":8},
 {"type":"sort","question":"Sort","buckets":["A","B"],"items":[{"label":"x","bucket":0},{"label":"y","bucket":1}],"explain":"E."},
 {"type":"explore","title":"T","widget":"compound"},
 {"type":"stat","value":"100.000 €","label":"garantat"},
 {"type":"asset_range","assetId":"etf"},
 {"type":"finish","cta":{"label":"Vezi","href":"/active/depozit"}}],
"takeaways":["Unu.","Doi."]}`

const statJSON = `{"type":"stat","value":"1","label":"x"}`

func TestValidateMoment(t *testing.T) {
	id, doc, err := Validate(domain.KindMoment, json.RawMessage(goodMoment))
	if err != nil || id != "test_moment" {
		t.Fatalf("good moment: %q %v", id, err)
	}
	if !strings.Contains(string(doc), `"correct":0`) {
		t.Errorf("correct index 0 lost: %s", doc)
	}
	soon := `{"id":"soon","title":"Soon","hook":"H","series":"S","level":1,"core":true,"minutes":4}`
	if _, doc, err := Validate(domain.KindMoment, json.RawMessage(soon)); err != nil ||
		!strings.Contains(string(doc), `"steps":[]`) || !strings.Contains(string(doc), `"takeaways":[]`) {
		t.Errorf("a moment without steps is a valid 'în curând': %s %v", doc, err)
	}

	// each case: replacements applied to goodMoment, in order
	bad := map[string][]string{
		"unknown field":         {`"title":"Test"`, `"title":"Test","color":"red"`},
		"bad id":                {`"id":"test_moment"`, `"id":"Test Moment"`},
		"no hook":               {`"hook":"De ce merită.",`, ``},
		"level 3":               {`"level":0`, `"level":3`},
		"too long":              {`"minutes":3`, `"minutes":9`},
		"unknown asset":         {`"assetIds":["depozit"]`, `"assetIds":["crypto"]`},
		"correct out of range":  {`"correct":0`, `"correct":2`},
		"answer outside range":  {`"answerValue":3`, `"answerValue":13`},
		"starts on the answer":  {`"start":8`, `"start":3`},
		"sort one bucket":       {`{"label":"y","bucket":1}`, `{"label":"y","bucket":0}`},
		"sort three buckets":    {`["A","B"]`, `["A","B","C"]`},
		"unknown widget":        {`"widget":"compound"`, `"widget":"crypto"`},
		"javascript href":       {`"href":"/active/depozit"`, `"href":"javascript:alert(1)"`},
		"protocol-relative URL": {`"href":"/active/depozit"`, `"href":"//evil.example"`},
		"old card step":         {`{"type":"stat","value":"100.000 €","label":"garantat"}`, `{"type":"card","title":"T","body":"B"}`},
		"no finish at the end":  {`{"type":"finish","cta":{"label":"Vezi","href":"/active/depozit"}}`, statJSON},
		"too many steps":        {`{"type":"asset_range","assetId":"etf"},`, `{"type":"asset_range","assetId":"etf"},` + statJSON + `,`},
		"extra step field":      {`"unit":"luni"`, `"unit":"luni","hint":"x"`},
		"one takeaway":          {`["Unu.","Doi."]`, `["Unu."]`},
		"one graded step": {
			`{"type":"choice","question":"Q?","options":["a","b"],"correct":0,"explain":"Because."}`, statJSON,
			`{"type":"sort","question":"Sort","buckets":["A","B"],"items":[{"label":"x","bucket":0},{"label":"y","bucket":1}],"explain":"E."}`, statJSON,
		},
	}
	for name, repl := range bad {
		doc := goodMoment
		for i := 0; i < len(repl); i += 2 {
			next := strings.Replace(doc, repl[i], repl[i+1], 1)
			if next == doc {
				t.Fatalf("%s: replacement %d didn't apply", name, i/2)
			}
			doc = next
		}
		if _, _, err := Validate(domain.KindMoment, json.RawMessage(doc)); !IsValidation(err) {
			t.Errorf("%s: accepted (%v)", name, err)
		}
	}
}

const orderJSON = `{"type":"order","question":"Sigur la riscant","ordered":["Cont","Titluri","ETF"],"top":"Sigur","bottom":"Riscant","explain":"E."}`

func TestValidateOrderStep(t *testing.T) {
	asset := `{"type":"asset_range","assetId":"etf"}`
	good := strings.Replace(goodMoment, asset, orderJSON, 1)
	if _, _, err := Validate(domain.KindMoment, json.RawMessage(good)); err != nil {
		t.Fatalf("good order step: %v", err)
	}
	bad := map[string][2]string{
		"two items":       {`["Cont","Titluri","ETF"]`, `["Cont","ETF"]`},
		"seven items":     {`["Cont","Titluri","ETF"]`, `["a","b","c","d","e","f","g"]`},
		"same item twice": {`["Cont","Titluri","ETF"]`, `["Cont","Cont","ETF"]`},
		"empty item":      {`["Cont","Titluri","ETF"]`, `["Cont"," ","ETF"]`},
		"no top label":    {`"top":"Sigur",`, ``},
		"no explanation":  {`,"explain":"E."}`, `}`},
	}
	for name, r := range bad {
		doc := strings.Replace(good, r[0], r[1], 1)
		if doc == good {
			t.Fatalf("%s: replacement didn't apply", name)
		}
		if _, _, err := Validate(domain.KindMoment, json.RawMessage(doc)); !IsValidation(err) {
			t.Errorf("%s: accepted (%v)", name, err)
		}
	}
}

const goodNews = `{"id":"stire","date":"28 oct. 2026","title":"Titlu","facts":["Un fapt."],
"sources":[{"label":"Sursa","url":"https://example.ro/a","date":"28 oct. 2026"}],
"impact":{"kind":"spend","line":"fuelLei","shock":{"defaultPct":8,"minPct":0,"maxPct":25}},
"momentId":"fondul_urgenta","momentHref":"/moment/lib/fondul_urgenta"}`

func TestValidateNews(t *testing.T) {
	if _, _, err := Validate(domain.KindNews, json.RawMessage(goodNews)); err != nil {
		t.Fatalf("good news: %v", err)
	}
	cases := map[string][2]string{
		"no facts":        {`["Un fapt."]`, `[]`},
		"http source":     {`"https://example.ro/a"`, `"http://example.ro/a"`},
		"unknown line":    {`"fuelLei"`, `"rentLei"`},
		"default > max":   {`"defaultPct":8`, `"defaultPct":30`},
		"external moment": {`"/moment/lib/fondul_urgenta"`, `"https://evil.example"`},
		"savings + shock": {`"kind":"spend"`, `"kind":"savings"`},
	}
	for name, c := range cases {
		doc := strings.Replace(goodNews, c[0], c[1], 1)
		if _, _, err := Validate(domain.KindNews, json.RawMessage(doc)); !IsValidation(err) {
			t.Errorf("%s: accepted (%v)", name, err)
		}
	}
	if _, _, err := Validate("games", json.RawMessage(`{}`)); !IsValidation(err) {
		t.Errorf("unknown kind: %v", err)
	}
}
