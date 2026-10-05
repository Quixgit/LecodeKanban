/** What the person has typed so far; saved step by step, so closing the wizard keeps what was done. */
export interface Draft {
  workspaceName: string;
  workspaceId: string | null;
  name: string;
  jobTitle: string;
  phone: string;
  telegram: string;
  whatsapp: string;
  timezone: string;
  workStart: string;
  workEnd: string;
  emails: string[];
  invited: number;
}

export function initialDraft(
  user: {
    name: string;
    jobTitle: string;
    phone: string;
    telegram: string;
    whatsapp: string;
    timezone: string;
    workStart: string;
    workEnd: string;
  },
  device: string,
): Draft {
  return {
    workspaceName: '',
    workspaceId: null,
    name: user.name,
    jobTitle: user.jobTitle,
    phone: user.phone,
    telegram: user.telegram ? `@${user.telegram}` : '',
    whatsapp: user.whatsapp,
    timezone: user.timezone || device,
    workStart: user.workStart,
    workEnd: user.workEnd,
    emails: [],
    invited: 0,
  };
}
