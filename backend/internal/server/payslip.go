package server

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

var anthropicClient = &http.Client{Timeout: 60 * time.Second}

// modelImageTypes are the image types the model reads.
var modelImageTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true}

// GET /api/payslip/read: whether this server can read a payslip photo, so the app only offers it when it can.
func (s *server) canReadPayslip(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"available": s.Config.AnthropicAPIKey != "" && s.Config.PayslipModel != ""})
}

// POST /api/payslip/read: payslip photo -> gross salary. Answers 501 until ANTHROPIC_API_KEY and
// PAYSLIP_MODEL are set; the app then falls back to a typed-in gross. The image is not stored.
func (s *server) readPayslip(w http.ResponseWriter, r *http.Request) {
	if s.Config.AnthropicAPIKey == "" || s.Config.PayslipModel == "" {
		writeJSON(w, http.StatusNotImplemented, apiError{Error: "not_configured", Hint: "Type your gross salary instead."})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	file, _, err := r.FormFile("image")
	if err != nil {
		fail(w, http.StatusBadRequest, "no image")
		return
	}
	defer file.Close()
	img, err := io.ReadAll(file)
	if err != nil {
		fail(w, http.StatusBadRequest, "no image")
		return
	}
	// The type comes from the bytes, not the client's label.
	mediaType := http.DetectContentType(img)
	if !modelImageTypes[mediaType] {
		fail(w, http.StatusUnsupportedMediaType, "unsupported image type")
		return
	}

	reqBody, _ := json.Marshal(map[string]any{
		"model":      s.Config.PayslipModel,
		"max_tokens": 200,
		"messages": []map[string]any{{
			"role": "user",
			"content": []map[string]any{
				{"type": "image", "source": map[string]string{"type": "base64", "media_type": mediaType, "data": base64.StdEncoding.EncodeToString(img)}},
				{"type": "text", "text": `This is a Romanian payslip (fluturas de salariu). Reply with JSON only: {"grossLei": number|null, "confidence": number between 0 and 1}. grossLei is the gross salary (salariu brut / venit brut) for the month.`},
			},
		}},
	})
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	req.Header.Set("x-api-key", s.Config.AnthropicAPIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")
	res, err := anthropicClient.Do(req)
	if err != nil {
		fail(w, http.StatusBadGateway, "reader_failed")
		return
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		fail(w, http.StatusBadGateway, "reader_failed")
		return
	}
	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		fail(w, http.StatusBadGateway, "reader_failed")
		return
	}
	var text string
	for _, c := range out.Content {
		if c.Type == "text" {
			text = c.Text
			break
		}
	}
	var parsed struct {
		GrossLei   *float64 `json:"grossLei"`
		Confidence float64  `json:"confidence"`
	}
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start || json.Unmarshal([]byte(text[start:end+1]), &parsed) != nil {
		fail(w, http.StatusUnprocessableEntity, "unreadable")
		return
	}
	writeJSON(w, http.StatusOK, parsed)
}
