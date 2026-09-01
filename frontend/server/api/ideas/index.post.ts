import { requireVbiSession } from '../../utils/session';
import { createIdeaForUser } from '../../utils/ideaMutations';
import type { CreateIdeaInput } from '../../../app/composables/useIdeasBank';
import { assertIdeaAttachment } from '../../utils/ideaAttachments';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const contentType = String(getHeader(event, 'content-type') || '');

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event);
    const field = (name: string) => {
      const part = parts?.find((item) => item.name === name && !item.filename);
      return part?.data?.toString('utf8') ?? '';
    };
    const filePart = parts?.find((item) => item.name === 'file' && item.filename);
    const attachment = filePart ? assertIdeaAttachment(filePart) : null;
    const input: CreateIdeaInput = {
      title: field('title'),
      description: field('description'),
      category: field('category'),
      city: field('city') || 'Москва',
      ...(attachment ? { attachmentName: attachment.originalName } : {})
    };
    return createIdeaForUser(session, input, attachment);
  }

  const body = await readBody<CreateIdeaInput>(event);
  return createIdeaForUser(session, body || ({} as CreateIdeaInput), null);
});
