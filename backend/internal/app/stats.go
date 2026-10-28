package app

import (
	"context"
	"sort"
	"strconv"
	"time"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/learning"
	"rost/backend/internal/rules"
)

const MaxStatsDays = 365

type DayStats struct {
	Date        string `json:"date"`
	NewUsers    int    `json:"newUsers"`
	ActiveUsers int    `json:"activeUsers"`
	Events      int    `json:"events"`
}

type Count struct {
	Key   string `json:"key"`
	Count int    `json:"count"`
}

type LibraryStats struct {
	MomentID  string `json:"momentId"`
	Title     string `json:"title"`
	Level     int    `json:"level"`
	Opened    int    `json:"opened"`
	Completed int    `json:"completed"`
	// nil if nobody opened it
	CompletionRate *float64 `json:"completionRate"`
	// nil without answers
	CorrectRate *float64 `json:"correctRate"`
}

type AssetStats struct {
	AssetID        string `json:"assetId"`
	Views          int    `json:"views"`
	ProviderClicks int    `json:"providerClicks"`
}

// only aggregates, nothing per user
type Stats struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Users struct {
		Total int `json:"total"`
		New   int `json:"new"`
		// had events in the period
		Active   int `json:"active"`
		WithQuiz int `json:"withQuiz"`
	} `json:"users"`
	Daily []DayStats `json:"daily"`
	// everyone who took the quiz
	Levels      map[string]int `json:"levels"`
	RiskProfile map[string]int `json:"riskProfile"`
	Quiz        struct {
		Started   int `json:"started"`
		Completed int `json:"completed"`
		// out of 6
		AvgScore *float64 `json:"avgScore"`
	} `json:"quiz"`
	LevelUps int            `json:"levelUps"`
	Library  []LibraryStats `json:"library"`
	Assets   []AssetStats   `json:"assets"`
	News     []Count        `json:"news"`
	Pages    []Count        `json:"pages"`
	Events   map[string]int `json:"events"`
	// all time, same as /api/metrics
	Triggered Metrics `json:"triggered"`
}

func ratio(n, d int) *float64 {
	if d == 0 {
		return nil
	}
	r := rules.RoundTo(float64(n)/float64(d), 4)
	return &r
}

func propString(e domain.TrackEvent, key string) string {
	s, _ := e.Props[key].(string)
	return s
}

// limit 0 = all
func sortedCounts(m map[string]int, limit int) []Count {
	out := make([]Count, 0, len(m))
	for k, v := range m {
		out = append(out, Count{k, v})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Count > out[j].Count || (out[i].Count == out[j].Count && out[i].Key < out[j].Key)
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

// last N days incl. today, UTC
func (s Service) Stats(ctx context.Context, days int) (Stats, error) {
	days = min(max(days, 1), MaxStatsDays)
	now := clock.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(days - 1))
	end := start.AddDate(0, 0, days)
	from, to := clock.ISO(start), clock.ISO(end)

	var st Stats
	st.From, st.To = from, to
	st.Levels, st.RiskProfile, st.Events = map[string]int{"0": 0, "1": 0, "2": 0}, map[string]int{}, map[string]int{}

	users, err := s.Store.ListUsers(ctx)
	if err != nil {
		return st, err
	}
	completions, err := s.Store.ListCompletions(ctx, "")
	if err != nil {
		return st, err
	}
	events, err := s.Store.ListTrackEvents(ctx, from, to)
	if err != nil {
		return st, err
	}
	library, err := s.Library(ctx)
	if err != nil {
		return st, err
	}
	if st.Triggered, err = s.Metrics(ctx); err != nil {
		return st, err
	}

	daily := map[string]*DayStats{}
	for d := 0; d < days; d++ {
		date := start.AddDate(0, 0, d).Format("2006-01-02")
		st.Daily = append(st.Daily, DayStats{Date: date})
	}
	for i := range st.Daily {
		daily[st.Daily[i].Date] = &st.Daily[i]
	}
	day := func(iso string) *DayStats {
		if len(iso) < 10 {
			return nil
		}
		return daily[iso[:10]]
	}

	// users
	core := learning.CoreByLevel(library)
	doneBy := map[string][]string{}
	for _, c := range completions {
		doneBy[c.UserID] = append(doneBy[c.UserID], c.MomentID)
	}
	st.Users.Total = len(users)
	for _, u := range users {
		if d := day(u.CreatedAt); d != nil {
			d.NewUsers++
			st.Users.New++
		}
		if p := learning.BuildProfile(u, doneBy[u.ID], core, 0); p != nil {
			st.Users.WithQuiz++
			st.Levels[strconv.Itoa(int(p.Level))]++
			st.RiskProfile[string(p.RiskProfile)]++
		}
	}

	// events
	active := map[string]bool{}
	activeByDay := map[string]map[string]bool{}
	opened, assetViews, providerClicks, newsViews, pages := map[string]int{}, map[string]int{}, map[string]int{}, map[string]int{}, map[string]int{}
	var scoreSum float64
	for _, e := range events {
		st.Events[e.Name]++
		if d := day(e.CreatedAt); d != nil {
			d.Events++
			if e.UserID != nil {
				if activeByDay[d.Date] == nil {
					activeByDay[d.Date] = map[string]bool{}
				}
				activeByDay[d.Date][*e.UserID] = true
			}
		}
		if e.UserID != nil {
			active[*e.UserID] = true
		}
		switch e.Name {
		case "quiz_start":
			st.Quiz.Started++
		case "quiz_completed":
			st.Quiz.Completed++
			if score, ok := toNumber(e.Props["score"]); ok {
				scoreSum += score
			}
		case "level_up":
			st.LevelUps++
		case "moment_open":
			opened[propString(e, "momentId")]++
		case "asset_view":
			assetViews[propString(e, "assetId")]++
		case "provider_click":
			providerClicks[propString(e, "assetId")]++
		case "news_view":
			newsViews[propString(e, "newsId")]++
		case "page_view":
			if e.Path != "" {
				pages[e.Path]++
			}
		}
	}
	st.Users.Active = len(active)
	for date, ids := range activeByDay {
		daily[date].ActiveUsers = len(ids)
	}
	if st.Quiz.Completed > 0 {
		avg := rules.RoundTo(scoreSum/float64(st.Quiz.Completed), 2)
		st.Quiz.AvgScore = &avg
	}

	// library
	completed, correct, answered := map[string]int{}, map[string]int{}, map[string]int{}
	for _, c := range completions {
		if c.CompletedAt >= from && c.CompletedAt < to {
			completed[c.MomentID]++
			correct[c.MomentID] += c.Correct
			answered[c.MomentID] += c.Total
		}
	}
	st.Library = []LibraryStats{}
	for _, m := range library {
		st.Library = append(st.Library, LibraryStats{
			MomentID: m.ID, Title: m.Title, Level: int(m.Level), Opened: opened[m.ID], Completed: completed[m.ID],
			CompletionRate: ratio(completed[m.ID], opened[m.ID]), CorrectRate: ratio(correct[m.ID], answered[m.ID]),
		})
	}

	st.Assets = []AssetStats{}
	assetIDs := map[string]bool{}
	for id := range assetViews {
		assetIDs[id] = true
	}
	for id := range providerClicks {
		assetIDs[id] = true
	}
	for id := range assetIDs {
		st.Assets = append(st.Assets, AssetStats{AssetID: id, Views: assetViews[id], ProviderClicks: providerClicks[id]})
	}
	sort.Slice(st.Assets, func(i, j int) bool {
		a, b := st.Assets[i], st.Assets[j]
		return a.Views > b.Views || (a.Views == b.Views && a.AssetID < b.AssetID)
	})
	st.News = sortedCounts(newsViews, 0)
	st.Pages = sortedCounts(pages, 20)
	return st, nil
}
