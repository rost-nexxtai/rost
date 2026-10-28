package storetest

import (
	"context"
	"sort"
)

func (m *Memory) ListPartners(_ context.Context) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []string{}
	for k := range m.partners {
		out = append(out, k)
	}
	sort.Strings(out)
	return out, nil
}

func (m *Memory) SetPartner(_ context.Context, key string, on bool, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if on {
		m.partners[key] = true
	} else {
		delete(m.partners, key)
	}
	return nil
}
