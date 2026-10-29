package rules

// Clients is how many clients a provider has in Romania. It is shown with its source, so people
// can tell a big bank from a small one; it is never a ranking input or used in a calculation.
type Clients struct {
	Count int `json:"count"`
	// Estimate: a press estimate, not a number the provider published.
	Estimate bool   `json:"estimate,omitempty"`
	AsOf     string `json:"asOf"`
	Source   Source `json:"source"`
}
