import { createContext, useContext } from 'react';
import type { DropPosition } from '../model/tree';

/** What the pointer is hovering while a node is dragged. */
export interface DropState {
  overId: string;
  position: DropPosition;
  valid: boolean;
}

export const DropContext = createContext<DropState | null>(null);
export const useDropState = () => useContext(DropContext);

export const SPACE_DROP_PREFIX = 'space:';
