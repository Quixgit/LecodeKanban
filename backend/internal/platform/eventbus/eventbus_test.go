package eventbus

import (
	"context"
	"errors"
	"testing"
)

type userCreated struct{ ID string }

func (userCreated) EventName() string { return "test.user_created" }

type other struct{}

func (other) EventName() string { return "test.other" }

func TestPublishDeliversToAllHandlers(t *testing.T) {
	b := New()
	var got []string
	Subscribe(b, func(_ context.Context, e userCreated) error { got = append(got, "a:"+e.ID); return nil })
	Subscribe(b, func(_ context.Context, e userCreated) error { return errors.New("boom") })
	Subscribe(b, func(_ context.Context, e userCreated) error { panic("oops") })
	Subscribe(b, func(_ context.Context, e userCreated) error { got = append(got, "d:"+e.ID); return nil })
	Subscribe(b, func(_ context.Context, e other) error { got = append(got, "other"); return nil })

	err := b.Publish(context.Background(), userCreated{ID: "1"})
	if err == nil {
		t.Fatal("expected joined error")
	}
	if len(got) != 2 || got[0] != "a:1" || got[1] != "d:1" {
		t.Fatalf("unexpected deliveries %v", got)
	}
	if err := b.Publish(context.Background(), other{}); err != nil {
		t.Fatal(err)
	}
}
