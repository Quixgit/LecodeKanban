import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionKey } from '@/features/auth';
import type { User } from '@/shared/api';
import { profileApi, type UpdateProfile } from '../api/profileApi';

export const deviceKeys = { all: ['devices'] as const };

/** Mutations that return the updated user write it straight into the session cache. */
export function useProfileMutations() {
  const qc = useQueryClient();
  const setUser = (u: User) => qc.setQueryData<User | null>(sessionKey, u);
  return {
    update: useMutation({
      mutationFn: (body: UpdateProfile) => profileApi.updateProfile(body),
      onSuccess: setUser,
    }),
    uploadAvatar: useMutation({
      mutationFn: (file: Blob) => profileApi.uploadAvatar(file),
      onSuccess: setUser,
    }),
    removeAvatar: useMutation({ mutationFn: profileApi.removeAvatar, onSuccess: setUser }),
  };
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profileApi.changePassword,
    // Other devices were signed out on the server.
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.all }),
  });
}

export function useDevices() {
  return useQuery({ queryKey: deviceKeys.all, queryFn: profileApi.devices, staleTime: 15_000 });
}

export function useDeviceMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: deviceKeys.all });
  return {
    signOut: useMutation({ mutationFn: profileApi.signOutDevice, onSuccess: refresh }),
    signOutOthers: useMutation({ mutationFn: profileApi.signOutOthers, onSuccess: refresh }),
  };
}
