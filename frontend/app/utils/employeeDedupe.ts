export type EmployeeIdentity = {
  id: number;
  bitrix_user_id?: number | null;
  platform_user_id: number | null;
  email?: string;
  name?: string;
};

function normalizeName(name?: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function employeeIdentityKeys(row: EmployeeIdentity): string[] {
  const keys: string[] = [];
  const bitrixId =
    row.bitrix_user_id ??
    (row.platform_user_id && row.id === row.platform_user_id ? row.id : null);
  if (bitrixId) keys.push(`b:${Number(bitrixId)}`);
  if (row.platform_user_id) keys.push(`p:${Number(row.platform_user_id)}`);
  const email = String(row.email || '').trim().toLowerCase();
  if (email) keys.push(`e:${email}`);
  const name = normalizeName(row.name);
  if (name) keys.push(`n:${name}`);
  return keys;
}

export function dedupeEmployeeList<T extends EmployeeIdentity>(list: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  const score = (row: T) =>
    (row.bitrix_user_id ? 4 : 0) + (row.platform_user_id ? 2 : 0) + (row.email ? 1 : 0);

  const sorted = [...list].sort((a, b) => score(b) - score(a));

  for (const row of sorted) {
    const keys = employeeIdentityKeys(row);
    if (keys.length && keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    result.push(row);
  }

  return result.sort((a, b) => a.id - b.id);
}
