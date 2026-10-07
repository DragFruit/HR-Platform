import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

const PHOTO_DIR = join(process.cwd(), 'server/data/page-feedback-photos');
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif'
};

export type PageFeedbackPhotoFile = {
  originalName: string;
  mime: string;
  ext: string;
  bytes: Buffer;
};

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, '_');

const filePath = (id: string, ext: string) => join(PHOTO_DIR, `${safeId(id)}.${ext}`);
const metaPath = (id: string) => join(PHOTO_DIR, `${safeId(id)}.json`);

export function assertPageFeedbackPhoto(file: {
  filename?: string;
  type?: string;
  data: Buffer;
}): PageFeedbackPhotoFile {
  const originalName = String(file.filename || 'photo.jpg').trim() || 'photo.jpg';
  const ext = extname(originalName).replace('.', '').toLowerCase() || 'jpg';
  const mimeFromName = MIME_BY_EXT[ext];
  const mimeFromType = String(file.type || '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  const mime =
    mimeFromName ||
    (mimeFromType && mimeFromType.startsWith('image/') ? mimeFromType : '') ||
    '';
  if (!mime || !mime.startsWith('image/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Можно прикрепить только фото (jpg, png, webp).'
    });
  }
  if (!file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Пустой файл' });
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Фото больше 5 МБ' });
  }
  const storeExt = mimeFromName ? ext : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { originalName, mime, ext: storeExt, bytes: file.data };
}

export async function savePageFeedbackPhoto(
  id: string,
  file: PageFeedbackPhotoFile
): Promise<void> {
  const path = filePath(id, file.ext);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.bytes);
  await writeFile(
    metaPath(id),
    `${JSON.stringify({ originalName: file.originalName, mime: file.mime, ext: file.ext }, null, 2)}\n`
  );
}

export async function readPageFeedbackPhoto(
  id: string
): Promise<{ originalName: string; mime: string; bytes: Buffer } | null> {
  try {
    const meta = JSON.parse(await readFile(metaPath(id), 'utf8')) as {
      originalName?: string;
      mime?: string;
      ext?: string;
    };
    const ext = String(meta.ext || 'jpg');
    const bytes = await readFile(filePath(id, ext));
    return {
      originalName: String(meta.originalName || 'photo'),
      mime: String(meta.mime || 'image/jpeg'),
      bytes
    };
  } catch {
    return null;
  }
}
