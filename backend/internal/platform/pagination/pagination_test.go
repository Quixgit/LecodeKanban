package pagination

import (
	"net/url"
	"testing"
)

func TestFromQuery(t *testing.T) {
	cases := map[string]Params{
		"":                      {1, DefaultSize},
		"page=3&pageSize=10":    {3, 10},
		"page=-1&pageSize=9999": {1, MaxSize},
		"page=x&pageSize=0":     {1, DefaultSize},
	}
	for q, want := range cases {
		v, _ := url.ParseQuery(q)
		if got := FromQuery(v); got != want {
			t.Errorf("%q: got %+v want %+v", q, got, want)
		}
	}
	if (Params{Page: 3, Size: 10}).Offset() != 20 {
		t.Fatal("offset")
	}
	if p := New[int](nil, 0, Params{1, 5}); p.Items == nil {
		t.Fatal("items must serialise as []")
	}
}
