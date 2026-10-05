import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionKey } from '@/features/auth';
import { api, unwrap, type User } from '@/shared/api';

/** Records that the wizard was finished or skipped, and puts the updated profile into the session. */
export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/users/me/onboarding/complete')),
    onSuccess: (u) => qc.setQueryData<User | null>(sessionKey, u),
  });
}
