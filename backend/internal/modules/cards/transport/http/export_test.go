package http

import "testing"

func TestSafeCellStopsFormulas(t *testing.T) {
	for in, want := range map[string]string{
		"=SUM(A1:A9)": "'=SUM(A1:A9)",
		"+1":          "'+1",
		"-2":          "'-2",
		"@cmd":        "'@cmd",
		"Fix login":   "Fix login",
		"":            "",
		"Привіт":      "Привіт",
	} {
		if got := safeCell(in); got != want {
			t.Errorf("safeCell(%q) = %q, want %q", in, got, want)
		}
	}
}
