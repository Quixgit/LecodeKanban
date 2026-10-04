import { createContext, useContext } from 'react';
import type { ChatOutletContext } from './ChatLayout';

/** The chat shell's state, for panes that are not rendered through the router's outlet (the split view). */
export const ChatContext = createContext<ChatOutletContext | null>(null);

export function useChatContext(): ChatOutletContext {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used inside the chat layout');
  return ctx;
}
