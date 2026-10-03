// Package client talks to the GitHub REST API with a person's access token.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ErrUnauthorized means GitHub rejected the token (revoked, expired or missing a scope).
var ErrUnauthorized = errors.New("github: token rejected")

// ErrNotFound means the repository or issue is not visible to the token.
var ErrNotFound = errors.New("github: not found")

type Client struct {
	base string
	http *http.Client
}

// New returns a client for the API at base ("" is api.github.com).
func New(base string) *Client {
	if base == "" {
		base = "https://api.github.com"
	}
	return &Client{base: strings.TrimRight(base, "/"), http: &http.Client{Timeout: 20 * time.Second}}
}

func (c *Client) do(ctx context.Context, token, method, path string, in, out any) error {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "LecodeKanban")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return ErrUnauthorized
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode == http.StatusForbidden:
		return fmt.Errorf("github: forbidden: %w", ErrUnauthorized)
	case resp.StatusCode >= 300:
		return fmt.Errorf("github: %s %s: status %d: %s", method, path, resp.StatusCode, strings.TrimSpace(string(data[:min(len(data), 200)])))
	}
	if out != nil && len(data) > 0 {
		return json.Unmarshal(data, out)
	}
	return nil
}

// User returns the login the token belongs to.
func (c *Client) User(ctx context.Context, token string) (string, error) {
	var u struct {
		Login string `json:"login"`
	}
	if err := c.do(ctx, token, http.MethodGet, "/user", nil, &u); err != nil {
		return "", err
	}
	return u.Login, nil
}

// RepoInfo is a repository the token can see.
type RepoInfo struct {
	FullName string `json:"full_name"`
	Private  bool   `json:"private"`
}

// Repos lists up to 100 repositories the token can push to, most recently active first.
func (c *Client) Repos(ctx context.Context, token string) ([]RepoInfo, error) {
	var out []RepoInfo
	err := c.do(ctx, token, http.MethodGet, "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member", nil, &out)
	return out, err
}

// CreateHook registers the webhook that delivers pull request and issue events.
func (c *Client) CreateHook(ctx context.Context, token, repo, url, secret string) (int64, error) {
	var out struct {
		ID int64 `json:"id"`
	}
	err := c.do(ctx, token, http.MethodPost, "/repos/"+repo+"/hooks", map[string]any{
		"name": "web", "active": true, "events": []string{"pull_request", "issues"},
		"config": map[string]any{"url": url, "content_type": "json", "secret": secret, "insecure_ssl": "0"},
	}, &out)
	return out.ID, err
}

func (c *Client) DeleteHook(ctx context.Context, token, repo string, id int64) error {
	return c.do(ctx, token, http.MethodDelete, fmt.Sprintf("/repos/%s/hooks/%d", repo, id), nil, nil)
}

// Issue is the part of an issue the app needs.
type Issue struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
	URL    string `json:"html_url"`
	State  string `json:"state"`
}

func (c *Client) CreateIssue(ctx context.Context, token, repo, title, body string) (Issue, error) {
	var out Issue
	err := c.do(ctx, token, http.MethodPost, "/repos/"+repo+"/issues", map[string]string{"title": title, "body": body}, &out)
	return out, err
}

// SetIssueState closes (completed) or reopens an issue.
func (c *Client) SetIssueState(ctx context.Context, token, repo string, number int, closed bool) error {
	state := map[string]string{"state": "open"}
	if closed {
		state = map[string]string{"state": "closed", "state_reason": "completed"}
	}
	return c.do(ctx, token, http.MethodPatch, fmt.Sprintf("/repos/%s/issues/%d", repo, number), state, nil)
}

// Comment adds a comment to an issue or pull request.
func (c *Client) Comment(ctx context.Context, token, repo string, number int, body string) error {
	return c.do(ctx, token, http.MethodPost, fmt.Sprintf("/repos/%s/issues/%d/comments", repo, number), map[string]string{"body": body}, nil)
}
