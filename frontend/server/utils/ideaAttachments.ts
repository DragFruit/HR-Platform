import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

const ATTACH_DIR = join(process.cwd(), 'server/data/idea-attachments');
const MAX_BYTES = 12 * 1024 * 1024;

export const IDEA_ATTACHMENT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

export type IdeaAttachmentFile = {
  originalName: string;
  mime: string;
  bytes: Buffer;
};

const safeIdeaId = (ideaId: string) => ideaId.replace(/[^a-zA-Z0-9._-]/g, '_');

const storedPath = (ideaId: string) => join(ATTACH_DIR, safeIdeaId(ideaId), 'file.bin');
const metaPath = (ideaId: string) => join(ATTACH_DIR, safeIdeaId(ideaId), 'meta.json');

export function ideaAttachmentExt(name: string): string {
  return extname(name).replace('.', '').toLowerCase();
}

export function assertIdeaAttachment(file: { filename?: string; type?: string; data: Buffer }): IdeaAttachmentFile {
  const originalName = String(file.filename || 'file').trim() || 'file';
  const ext = ideaAttachmentExt(originalName);
  const mime = IDEA_ATTACHMENT_MIME[ext];
  if (!mime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Можно прикрепить png, jpg, pdf, doc, xls или ppt.'
    });
  }
  if (!file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Пустой файл' });
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Файл больше 12 МБ' });
  }
  return { originalName, mime, bytes: file.data };
}

export async function saveIdeaAttachment(ideaId: string, file: IdeaAttachmentFile): Promise<void> {
  const path = storedPath(ideaId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.bytes);
  await writeFile(metaPath(ideaId), `${JSON.stringify({ originalName: file.originalName, mime: file.mime }, null, 2)}\n`);
}

export async function readIdeaAttachment(
  ideaId: string
): Promise<{ originalName: string; mime: string; bytes: Buffer } | null> {
  try {
    const bytes = await readFile(storedPath(ideaId));
    const meta = JSON.parse(await readFile(metaPath(ideaId), 'utf8')) as {
      originalName?: string;
      mime?: string;
    };
    return {
      originalName: String(meta.originalName || 'file'),
      mime: String(meta.mime || 'application/octet-stream'),
      bytes
    };
  } catch {
    return null;
  }
}

export async function ideaAttachmentExists(ideaId: string): Promise<boolean> {
  return Boolean(await readIdeaAttachment(ideaId));
}

export async function deleteIdeaAttachment(ideaId: string): Promise<void> {
  await unlink(storedPath(ideaId)).catch(() => {});
  await unlink(metaPath(ideaId)).catch(() => {});
}
