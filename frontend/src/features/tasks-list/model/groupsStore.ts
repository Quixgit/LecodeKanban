import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskStatus } from '@/features/cards';

interface GroupsState {
  collapsed: TaskStatus[];
  toggle: (s: TaskStatus) => void;
}

/** Collapsed status groups, remembered per browser. */
export const useGroupsStore = create<GroupsState>()(
  persist(
    (set) => ({
      collapsed: ['done'],
      toggle: (s) =>
        set((st) => ({
          collapsed: st.collapsed.includes(s)
            ? st.collapsed.filter((x) => x !== s)
            : [...st.collapsed, s],
        })),
    }),
    { name: 'lk-task-groups' },
  ),
);
