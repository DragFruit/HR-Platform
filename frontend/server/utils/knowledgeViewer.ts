import type { SessionUser } from './credentials';
import { findEmployeeForSession } from './employeesStore';
import { knowledgeViewerFrom, type KnowledgeViewer } from './knowledgeAudience';

/**
 * Единая точка: кто смотрит БЗ (роль + отдел из справочника).
 * Используют список/обычный поиск (/api/knowledge) и «Спросить ИИ».
 */
export async function resolveKnowledgeViewer(session: SessionUser): Promise<KnowledgeViewer> {
  const employee = await findEmployeeForSession(session).catch(() => null);
  return knowledgeViewerFrom(session, employee);
}
