import { api, unwrap, type components } from '@/shared/api';
import type { ReactionKey } from '../model/reactions';

export type ChatChannel = components['schemas']['ChatChannel'];
export type ChatChannelInput = components['schemas']['ChatChannelInput'];
export type ChatChannelPatch = components['schemas']['ChatChannelPatch'];
export type ChatMessage = components['schemas']['ChatMessage'];
export type ChatMessagePage = components['schemas']['ChatMessagePage'];
export type ChatReaction = components['schemas']['ChatReaction'];

const channel = (channelId: string) => ({ params: { path: { channelId } } });
const message = (messageId: string) => ({ params: { path: { messageId } } });

export const chatApi = {
  channels: (workspaceId: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/chat/channels', { params: { path: { workspaceId } } }),
    ),
  createChannel: (workspaceId: string, body: ChatChannelInput) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/chat/channels', {
        params: { path: { workspaceId } },
        body,
      }),
    ),
  openDirect: (workspaceId: string, userIds: string[]) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/chat/direct', {
        params: { path: { workspaceId } },
        body: { userIds },
      }),
    ),
  openProjectChat: (projectId: string) =>
    unwrap(api.POST('/projects/{projectId}/chat', { params: { path: { projectId } } })),
  openCardChat: (cardId: string) =>
    unwrap(api.POST('/cards/{cardId}/chat', { params: { path: { cardId } } })),
  updateChannel: (id: string, body: ChatChannelPatch) =>
    unwrap(api.PATCH('/chat/channels/{channelId}', { ...channel(id), body })),
  archiveChannel: (id: string) => unwrap(api.DELETE('/chat/channels/{channelId}', channel(id))),
  members: (id: string) => unwrap(api.GET('/chat/channels/{channelId}/members', channel(id))),
  addMembers: (id: string, userIds: string[]) =>
    unwrap(api.POST('/chat/channels/{channelId}/members', { ...channel(id), body: { userIds } })),
  join: (id: string) => unwrap(api.POST('/chat/channels/{channelId}/join', channel(id))),
  leave: (id: string) => unwrap(api.POST('/chat/channels/{channelId}/leave', channel(id))),
  markRead: (id: string) => unwrap(api.POST('/chat/channels/{channelId}/read', channel(id))),
  mute: (id: string, muted: boolean) =>
    unwrap(api.PUT('/chat/channels/{channelId}/mute', { ...channel(id), body: { muted } })),
  messages: (id: string, before?: string) =>
    unwrap(
      api.GET('/chat/channels/{channelId}/messages', {
        params: { path: { channelId: id }, query: { before } },
      }),
    ),
  post: (id: string, body: string, parentId?: string) =>
    unwrap(
      api.POST('/chat/channels/{channelId}/messages', {
        ...channel(id),
        body: { body, parentId: parentId ?? null },
      }),
    ),
  edit: (id: string, body: string) =>
    unwrap(api.PATCH('/chat/messages/{messageId}', { ...message(id), body: { body } })),
  remove: (id: string) => unwrap(api.DELETE('/chat/messages/{messageId}', message(id))),
  thread: (id: string) => unwrap(api.GET('/chat/messages/{messageId}/thread', message(id))),
  react: (id: string, key: ReactionKey, on: boolean) => {
    const params = { params: { path: { messageId: id, key } } } as never;
    return unwrap(
      on
        ? api.PUT('/chat/messages/{messageId}/reactions/{key}', params)
        : api.DELETE('/chat/messages/{messageId}/reactions/{key}', params),
    ) as Promise<ChatMessage>;
  },
};
