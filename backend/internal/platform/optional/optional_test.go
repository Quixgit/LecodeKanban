package optional

import (
	"encoding/json"
	"testing"
)

func TestField(t *testing.T) {
	var v struct {
		A Field[string] `json:"a"`
		B Field[string] `json:"b"`
		C Field[int]    `json:"c"`
	}
	if err := json.Unmarshal([]byte(`{"a":"x","b":null}`), &v); err != nil {
		t.Fatal(err)
	}
	if !v.A.Set || v.A.Null || *v.A.Ptr() != "x" {
		t.Fatal("a")
	}
	if !v.B.Set || !v.B.Null || v.B.Ptr() != nil {
		t.Fatal("b")
	}
	if v.C.Set || v.C.Ptr() != nil {
		t.Fatal("c must be absent")
	}
	if err := json.Unmarshal([]byte(`{"c":"nope"}`), &v); err == nil {
		t.Fatal("type errors must surface")
	}
}
