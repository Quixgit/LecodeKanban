import { api, unwrap, type components } from '@/shared/api';
import type { ReactionKey } from '../model/reactions';

export type ChatChannel = components['schemas']['ChatChannel'];
export type ChatChannelInput = components['schemas']['ChatChannelInput'];
export type ChatChannelPatch = components['schemas']['ChatChannelPatch'];
export type ChatMessage = components['schemas']['ChatMessage'];
export type ChatMessagePage = components['schemas']['ChatMessagePage'];
export type ChatReaction = components['schemas']['ChatReaction'];
export type ChatFile = components['schemas']['ChatFile'];
export type ChatHit = components['schemas']['ChatHit'];

export interface SearchParams {
  q?: string;
  channelId?: string;
  fromId?: string;
  mentionsMe?: boolean;
  hasLink?: boolean;
  hasFile?: boolean;
  threadsOnly?: boolean;
  after?: string;
}

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
  post: (id: string, body: string, parentId?: string, fileIds?: string[]) =>
    unwrap(
      api.POST('/chat/channels/{channelId}/messages', {
        ...channel(id),
        body: { body, parentId: parentId ?? null, fileIds },
      }),
    ),
  search: (workspaceId: string, query: SearchParams) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/chat/search', {
        params: { path: { workspaceId }, query },
      }),
    ),
  saved: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/chat/saved', { params: { path: { workspaceId } } })),
  threads: (workspaceId: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/chat/threads', { params: { path: { workspaceId } } }),
    ),
  presence: (workspaceId: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/chat/presence', { params: { path: { workspaceId } } }),
    ),
  heartbeat: (workspaceId: string) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/chat/presence', { params: { path: { workspaceId } } }),
    ),
  typing: (id: string) => unwrap(api.POST('/chat/channels/{channelId}/typing', channel(id))),
  star: (id: string, on: boolean) =>
    unwrap(
      on
        ? api.PUT('/chat/channels/{channelId}/star', channel(id))
        : api.DELETE('/chat/channels/{channelId}/star', channel(id)),
    ),
  pins: (id: string) => unwrap(api.GET('/chat/channels/{channelId}/pins', channel(id))),
  files: (id: string) => unwrap(api.GET('/chat/channels/{channelId}/files', channel(id))),
  uploadFile: (channelId: string, file: File): Promise<ChatFile> => {
    const form = new FormData();
    form.append('file', file, file.name);
    return unwrap(
      api.POST('/chat/channels/{channelId}/files', {
        params: { path: { channelId } },
        // The schema describes the multipart part; the browser sets the boundary header.
        body: { file: file as unknown as string },
        bodySerializer: () => form,
      }),
    );
  },
  save: (id: string, on: boolean) =>
    unwrap(
      on
        ? api.PUT('/chat/messages/{messageId}/save', message(id))
        : api.DELETE('/chat/messages/{messageId}/save', message(id)),
    ),
  pin: (id: string, on: boolean) =>
    unwrap(
      on
        ? api.PUT('/chat/messages/{messageId}/pin', message(id))
        : api.DELETE('/chat/messages/{messageId}/pin', message(id)),
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
