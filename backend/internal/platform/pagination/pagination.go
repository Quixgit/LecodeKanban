// Package pagination parses page/pageSize query parameters and wraps paged results.
package pagination

import (
	"net/url"
	"strconv"
)

const (
	DefaultSize = 20
	MaxSize     = 500 // "Show all" in list views; larger sets must be paged
)

type Params struct {
	Page int
	Size int
}

func (p Params) Offset() int { return (p.Page - 1) * p.Size }
func (p Params) Limit() int  { return p.Size }

// FromQuery reads ?page=&pageSize= with sane bounds.
func FromQuery(q url.Values) Params {
	page, _ := strconv.Atoi(q.Get("page"))
	size, _ := strconv.Atoi(q.Get("pageSize"))
	if page < 1 {
		page = 1
	}
	switch {
	case size <= 0:
		size = DefaultSize
	case size > MaxSize:
		size = MaxSize
	}
	return Params{Page: page, Size: size}
}

// Page is a slice of results plus the total count for the query.
type Page[T any] struct {
	Items    []T `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
}

func New[T any](items []T, total int, p Params) Page[T] {
	if items == nil {
		items = []T{}
	}
	return Page[T]{Items: items, Total: total, Page: p.Page, PageSize: p.Size}
}
