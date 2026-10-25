/** Поиск сотрудника по логину Vibe: точный email, затем локальная часть до `@`. */
export function findEmployeeByVibeLogin<T extends { email?: string }>(list: T[], login: string): T | null {
  const q = login.trim().toLowerCase();
  if (!q) return null;
  const byEmail = list.find((e) => (e.email || '').trim().toLowerCase() === q);
  if (byEmail) return byEmail;
  // логин без домена: ivanov → ivanov@…
  const byLocal = list.find((e) => {
    const email = (e.email || '').trim().toLowerCase();
    if (!email.includes('@')) return false;
    return email.split('@')[0] === q;
  });
  return byLocal ?? null;
}
