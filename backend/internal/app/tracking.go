package app

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"rost/backend/internal/domain"
)

// what the app can send, anything else is a 400
var ClientEvents = []string{
	"page_view",      // path
	"quiz_start",     // -
	"quiz_step",      // step (number)
	"asset_view",     // assetId
	"provider_click", // assetId, providerId, rank
	"moment_open",    // momentId
	"moment_step",    // momentId, step
	"moment_close",   // momentId, step (closed before the end)
	"news_view",      // newsId
	"news_slider",    // newsId, pct
	"cta_click",      // id
}

// only the api writes these
var ServerEvents = []string{"user_created", "quiz_completed", "library_completed", "level_up"}

const (
	MaxTrackBatch    = 50
	maxProps         = 20
	maxPropStringLen = 200
	maxPathLen       = 200
)

type TrackInput struct {
	Name  string         `json:"name"`
	Props map[string]any `json:"props"`
	Path  string         `json:"path"`
}

// flat props only, no nested stuff / personal data
func validateTrack(in TrackInput) error {
	if !slices.Contains(ClientEvents, in.Name) {
		return fmt.Errorf("unknown event %q", in.Name)
	}
	if len(in.Props) > maxProps {
		return fmt.Errorf("%s: at most %d props", in.Name, maxProps)
	}
	for k, v := range in.Props {
		switch x := v.(type) {
		case string:
			if len(x) > maxPropStringLen {
				return fmt.Errorf("%s: prop %s is longer than %d characters", in.Name, k, maxPropStringLen)
			}
		case float64, bool:
		default:
			return fmt.Errorf("%s: prop %s must be a string, number or boolean", in.Name, k)
		}
	}
	if len(in.Path) > maxPathLen || (in.Path != "" && !strings.HasPrefix(in.Path, "/")) {
		return fmt.Errorf("%s: path must start with / and be at most %d characters", in.Name, maxPathLen)
	}
	return nil
}

// query can have tokens (/embed?token=)
func stripQuery(path string) string {
	if i := strings.IndexAny(path, "?#"); i >= 0 {
		return path[:i]
	}
	return path
}

type ErrBadTrack struct{ Msg string }

func (e ErrBadTrack) Error() string { return e.Msg }

// one bad event rejects the whole batch
func (s Service) Track(ctx context.Context, userID *string, in []TrackInput) error {
	if len(in) == 0 || len(in) > MaxTrackBatch {
		return ErrBadTrack{fmt.Sprintf("send 1 to %d events", MaxTrackBatch)}
	}
	events := make([]domain.TrackEvent, 0, len(in))
	for _, e := range in {
		if err := validateTrack(e); err != nil {
			return ErrBadTrack{err.Error()}
		}
		events = append(events, domain.TrackEvent{UserID: userID, Name: e.Name, Props: e.Props, Path: stripQuery(e.Path)})
	}
	return s.Store.AddTrackEvents(ctx, events)
}

func serverEvent(userID, name string, props map[string]any) domain.TrackEvent {
	return domain.TrackEvent{UserID: &userID, Name: name, Props: props}
}
