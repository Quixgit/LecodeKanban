import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from '@/shared/api';
import { json, renderWithProviders } from '@/test/render';
import { InviteDialog } from './InviteDialog';

const ws: Workspace = {
  id: 'w1',
  name: 'Core',
  slug: 'core',
  role: 'admin',
  memberCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

function stubInvite(res: Response) {
  const fetch = vi.fn(async () => res.clone());
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('InviteDialog', () => {
  it('validates the email before calling the API', async () => {
    const fetch = stubInvite(json(201, {}));
    renderWithProviders(
      <InviteDialog open onOpenChange={() => {}} workspace={ws} actorRole="admin" />,
    );
    await userEvent.type(screen.getByLabelText('Email address'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows non-field server errors as an alert', async () => {
    document.cookie = 'lk_csrf=t; path=/';
    stubInvite(json(409, { error: { code: 'workspaces.already_member', message: 'x' } }));
    renderWithProviders(
      <InviteDialog open onOpenChange={() => {}} workspace={ws} actorRole="admin" />,
    );
    await userEvent.type(screen.getByLabelText('Email address'), 'olena@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This person is already a member.');
  });

  it('closes and confirms on success', async () => {
    document.cookie = 'lk_csrf=t; path=/';
    stubInvite(
      json(201, {
        id: 'i1',
        email: 'new@example.com',
        role: 'member',
        expiresAt: '2026-10-08T00:00:00Z',
        createdAt: '2026-10-01T00:00:00Z',
      }),
    );
    const onOpenChange = vi.fn();
    renderWithProviders(
      <InviteDialog open onOpenChange={onOpenChange} workspace={ws} actorRole="admin" />,
    );
    await userEvent.type(screen.getByLabelText('Email address'), 'new@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
