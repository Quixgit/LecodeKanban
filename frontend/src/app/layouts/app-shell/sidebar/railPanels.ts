/** Sections that have a menu of their own next to the icon rail. */
const WITH_PANEL = ['projects', 'tasks', 'integrations', 'settings'];
export const panelFor = (key: string) => WITH_PANEL.includes(key);
