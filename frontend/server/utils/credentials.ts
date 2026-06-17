export type AuthRole = 'employee' | 'manager' | 'hr' | 'admin';

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  department: string;
};

type Credential = SessionUser & { password: string };

const credentials: Credential[] = [
  {
    id: 1,
    name: 'Стас',
    email: 'stas@vbi.local',
    password: 'admin123',
    role: 'admin',
    department: 'HR'
  },
  {
    id: 2,
    name: 'Костя',
    email: 'kostya@vbi.local',
    password: 'manager123',
    role: 'manager',
    department: 'Команда'
  },
  {
    id: 3,
    name: 'Катя',
    email: 'katya@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда'
  },
  {
    id: 4,
    name: 'Вася',
    email: 'vasya@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда'
  },
  {
    id: 5,
    name: 'Маша',
    email: 'masha@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда'
  },
  {
    id: 6,
    name: 'Алина',
    email: 'alina@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда'
  }
];

export function findCredential(email: string, password: string): SessionUser | null {
  const normalized = email.trim().toLowerCase();
  const found = credentials.find(
    (item) => item.email.toLowerCase() === normalized && item.password === password
  );
  if (!found) return null;
  const { password: _pw, ...user } = found;
  return user;
}

export function findCredentialById(id: number): SessionUser | null {
  const found = credentials.find((item) => item.id === id);
  if (!found) return null;
  const { password: _pw, ...user } = found;
  return user;
}
