import type { JSONContent } from '@tiptap/react';
import { api, unwrap, type components } from '@/shared/api';

export type WikiContent = components['schemas']['WikiContent'];
export type WikiFile = components['schemas']['WikiFile'];

const node = (nodeId: string) => ({ params: { path: { nodeId } } });

export const editorApi = {
  content: (nodeId: string) => unwrap(api.GET('/wiki/nodes/{nodeId}/content', node(nodeId))),
  save: (nodeId: string, doc: JSONContent, version: number) =>
    unwrap(
      api.PUT('/wiki/nodes/{nodeId}/content', {
        ...node(nodeId),
        body: { doc: doc as Record<string, unknown>, version },
      }),
    ),
  upload: (nodeId: string, file: File): Promise<WikiFile> => {
    const form = new FormData();
    form.append('file', file, file.name);
    return unwrap(
      api.POST('/wiki/nodes/{nodeId}/files', {
        ...node(nodeId),
        // The schema describes the multipart part; the browser sets the boundary header.
        body: { file: file as unknown as string },
        bodySerializer: () => form,
      }),
    );
  },
};
