import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Drawer } from './Drawer';
import { Modal } from './Modal';

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Drawer open={open} onOpenChange={setOpen} title="Card details">
        <input aria-label="Title" />
      </Drawer>
    </>
  );
}

describe('Drawer', () => {
  it('opens as a labelled dialog, traps focus and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = await screen.findByRole('dialog', { name: 'Card details' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    // Radix restores focus to the trigger once the exit animation unmounts the drawer.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus());
  });
});

describe('Modal', () => {
  it('renders title, description and footer; close button reports onOpenChange(false)', async () => {
    let state: boolean | undefined;
    render(
      <Modal
        open
        onOpenChange={(v) => (state = v)}
        title="Delete task?"
        description="Cannot be undone"
        footer={<Button>Delete</Button>}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete task?' });
    expect(dialog).toHaveAccessibleDescription('Cannot be undone');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(state).toBe(false);
  });
});
