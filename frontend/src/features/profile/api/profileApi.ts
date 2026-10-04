import { api, unwrap, type components } from '@/shared/api';

export type UpdateProfile = components['schemas']['UpdateProfileRequest'];
export type Device = components['schemas']['Device'];

export const profileApi = {
  updateProfile: (body: components['schemas']['UpdateProfileRequest']) =>
    unwrap(api.PATCH('/users/me', { body })),
  uploadAvatar: (file: Blob) => {
    const form = new FormData();
    form.append('file', file, 'avatar.png');
    return unwrap(
      api.POST('/users/me/avatar', {
        // The schema describes the multipart part; the browser sets the boundary header.
        body: { file: file as unknown as string },
        bodySerializer: () => form,
      }),
    );
  },
  removeAvatar: () => unwrap(api.DELETE('/users/me/avatar')),
  changePassword: (body: { currentPassword?: string; newPassword: string }) =>
    unwrap(api.POST('/users/me/password', { body })),
  resendVerification: () => unwrap(api.POST('/auth/verify-email/resend')),
  devices: () => unwrap(api.GET('/users/me/sessions')),
  signOutDevice: (sessionId: string) =>
    unwrap(api.DELETE('/users/me/sessions/{sessionId}', { params: { path: { sessionId } } })),
  signOutOthers: () => unwrap(api.POST('/users/me/sessions/revoke-others')),
};
