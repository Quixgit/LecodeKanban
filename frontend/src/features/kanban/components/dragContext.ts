import { createContext } from 'react';

/** True while any card is being dragged (disables enter/exit animations during moves). */
export const DragContext = createContext(false);
