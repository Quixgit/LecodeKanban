import { useTranslation } from 'react-i18next';
import { parseFieldMessage } from '../lib/formMessage';

/** Translates a react-hook-form error message produced by fieldMessage() (errors namespace). */
export function useFieldError() {
  const { t } = useTranslation('errors');
  return (message: string | undefined): string | undefined => {
    const m = parseFieldMessage(message);
    return m ? t(m.key, m.params) : undefined;
  };
}
