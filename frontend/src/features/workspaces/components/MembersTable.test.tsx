import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Member, Workspace } from '@/shared/api';
import { renderWithProviders } from '@/test/render';
import { MembersTable } from './MembersTable';

const ws = (role: Workspace['role']): Workspace => ({
  id: 'w1',
  name: 'Team',
  slug: 'team',
  role,
  memberCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  permissions:
    role === 'owner' || role === 'admin'
      ? ['workspace.view', 'members.invite', 'members.manage']
      : ['workspace.view'],
  customRole: null,
  twoFactorBlocked: false,
});
const member = (id: string, name: string, role: Member['role']): Member => ({
  user: { id, name, email: `${id}@example.com`, avatarUrl: null, jobTitle: '' },
  role,
  customRole: null,
  joinedAt: '2026-02-03T00:00:00Z',
});
const members = [
  member('u1', 'Olena Owner', 'owner'),
  member('u2', 'Andrii Admin', 'admin'),
  member('u3', 'Maria Member', 'member'),
];

describe('MembersTable', () => {
  it('lets owners change every role and marks the current user', () => {
    renderWithProviders(
      <MembersTable
        workspace={ws('owner')}
        members={members}
        currentUserId="u1"
        onLeft={() => {}}
      />,
    );
    expect(screen.getAllByRole('combobox', { name: 'Change role' })).toHaveLength(3);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getAllByText('February 3, 2026')).toHaveLength(3);
  });

  it('shows each person’s job title under their name', () => {
    const titled = [
      { ...members[0]!, user: { ...members[0]!.user, jobTitle: 'Head of Design' } },
      ...members.slice(1),
    ];
    renderWithProviders(
      <MembersTable
        workspace={ws('owner')}
        members={titled}
        currentUserId="u1"
        onLeft={() => {}}
      />,
    );
    expect(screen.getByText('Head of Design')).toBeInTheDocument();
  });

  it('shows read-only roles to viewers and only a leave action for themselves', () => {
    renderWithProviders(
      <MembersTable
        workspace={ws('viewer')}
        members={[...members, member('u4', 'Vira Viewer', 'viewer')]}
        currentUserId="u4"
        onLeft={() => {}}
      />,
    );
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Action' })).toHaveLength(1);
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('admins can manage members but not owners or other admins', () => {
    renderWithProviders(
      <MembersTable
        workspace={ws('admin')}
        members={[...members, member('u5', 'Second Admin', 'admin')]}
        currentUserId="u2"
        onLeft={() => {}}
      />,
    );
    // Selects: self (demote only) + Maria (member). Owner and the other admin are read-only.
    expect(screen.getAllByRole('combobox', { name: 'Change role' })).toHaveLength(2);
  });
});
