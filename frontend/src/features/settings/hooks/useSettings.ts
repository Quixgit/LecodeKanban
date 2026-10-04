import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionKey } from '@/features/auth';
import type { User } from '@/shared/api';
import { settingsApi } from '../api/settingsApi';

export const deviceKeys = { all: ['devices'] as const };

/** Mutations that return the updated user write it straight into the session cache. */
export function useProfileMutations() {
  const qc = useQueryClient();
  const setUser = (u: User) => qc.setQueryData<User | null>(sessionKey, u);
  return {
    rename: useMutation({
      mutationFn: (name: string) => settingsApi.updateProfile({ name }),
      onSuccess: setUser,
    }),
    uploadAvatar: useMutation({
      mutationFn: (file: Blob) => settingsApi.uploadAvatar(file),
      onSuccess: setUser,
    }),
    removeAvatar: useMutation({ mutationFn: settingsApi.removeAvatar, onSuccess: setUser }),
  };
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.changePassword,
    // Other devices were signed out on the server.
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.all }),
  });
}

export function useDevices() {
  return useQuery({ queryKey: deviceKeys.all, queryFn: settingsApi.devices, staleTime: 15_000 });
}

export function useDeviceMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: deviceKeys.all });
  return {
    signOut: useMutation({ mutationFn: settingsApi.signOutDevice, onSuccess: refresh }),
    signOutOthers: useMutation({ mutationFn: settingsApi.signOutOthers, onSuccess: refresh }),
  };
}
