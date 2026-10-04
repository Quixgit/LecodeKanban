package http

import "testing"

func TestTrend(t *testing.T) {
	if got := trend(5, 0); got.ChangePct != nil || got.Value != 5 || got.Previous != 0 {
		t.Fatalf("nothing to compare against must give no percentage: %+v", got)
	}
	if got := trend(0, 0); got.ChangePct != nil {
		t.Fatalf("0 vs 0: %+v", got)
	}
	if got := trend(6, 4); got.ChangePct == nil || *got.ChangePct != 50 {
		t.Fatalf("6 vs 4 = +50%%: %+v", got)
	}
	if got := trend(1, 4); got.ChangePct == nil || *got.ChangePct != -75 {
		t.Fatalf("1 vs 4 = -75%%: %+v", got)
	}
}
