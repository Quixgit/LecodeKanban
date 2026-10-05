/** Sections with a menu of their own next to the icon rail, and how wide it is. */
const PANELS: Record<string, number> = {
  projects: 232,
  tasks: 232,
  integrations: 232,
  settings: 232,
  chat: 296,
  docs: 296,
};

/** Sections whose page draws its own list into the rail's column (chat channels, the docs tree). */
const OWN_LIST = ['chat', 'docs'];

export const panelFor = (key: string) => key in PANELS;
export const panelWidth = (key: string) => PANELS[key] ?? 232;
export const ownsList = (key: string) => OWN_LIST.includes(key);
