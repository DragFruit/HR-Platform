/** Ссылка на карточку сотрудника в Bitrix24. */
export function bitrixEmployeeProfileUrl(
  portalUrl: string | undefined | null,
  bitrixUserId: number | null | undefined
): string | null {
  const portal = String(portalUrl || '').trim().replace(/\/+$/, '');
  const id = Number(bitrixUserId);
  if (!portal || !Number.isFinite(id) || id <= 0) return null;
  return `${portal}/company/personal/user/${id}/`;
}
