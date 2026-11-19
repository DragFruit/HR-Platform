/**
 * Ultimate-крестики-нолики (окно 10 «Огонька»). Механика перенесена из игры
 * ultimate-tic-tac-toe.ru (GameEngine.php + бот фронтенда): одна и та же
 * логика на сервере (онлайн-комнаты) и в браузере (игра с ботом).
 *
 * Правила: 9 маленьких полей в большом. Ход в клетку N отправляет соперника
 * в маленькое поле N. Если оно уже закрыто (выиграно или ничья) — соперник
 * ходит в любое открытое. Выигранное маленькое поле — клетка большого.
 */

export type TttSymbol = 'X' | 'O';
export type TttCell = TttSymbol | null;
export type TttResult = TttSymbol | 'draw' | null;
export type TttDifficulty = 'easy' | 'medium' | 'hard';

export type TttState = {
  smallBoards: TttCell[][];
  smallResults: TttResult[];
  bigResult: TttResult;
  /** Куда обязан ходить текущий игрок; null — в любое открытое поле. */
  activeSmallBoard: number | null;
  currentPlayer: TttSymbol;
};

export type TttMove = { big: number; small: number };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
] as const;

export function tttEmptyState(first: TttSymbol = 'X'): TttState {
  return {
    smallBoards: Array.from({ length: 9 }, () => Array<TttCell>(9).fill(null)),
    smallResults: Array<TttResult>(9).fill(null),
    bigResult: null,
    activeSmallBoard: null,
    currentPlayer: first
  };
}

function checkWinner(cells: TttCell[]): TttResult {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]!;
  }
  return cells.every((c) => c !== null) ? 'draw' : null;
}

const playable = (s: TttState, big: number) => s.smallResults[big] === null;

export function tttLegalMoves(s: TttState): TttMove[] {
  if (s.bigResult !== null) return [];
  const boards =
    s.activeSmallBoard !== null && playable(s, s.activeSmallBoard)
      ? [s.activeSmallBoard]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => playable(s, i));
  const out: TttMove[] = [];
  for (const big of boards) {
    for (let small = 0; small < 9; small++) if (s.smallBoards[big]![small] === null) out.push({ big, small });
  }
  return out;
}

export function tttIsLegal(s: TttState, m: TttMove): boolean {
  return tttLegalMoves(s).some((x) => x.big === m.big && x.small === m.small);
}

/** Новый state после хода. Бросает ошибку на нелегальный ход. */
export function tttApplyMove(s: TttState, m: TttMove): TttState {
  if (!tttIsLegal(s, m)) throw new Error('invalid_move');
  const n: TttState = {
    smallBoards: s.smallBoards.map((b) => [...b]),
    smallResults: [...s.smallResults],
    bigResult: s.bigResult,
    activeSmallBoard: s.activeSmallBoard,
    currentPlayer: s.currentPlayer
  };
  n.smallBoards[m.big]![m.small] = n.currentPlayer;
  if (n.smallResults[m.big] === null) n.smallResults[m.big] = checkWinner(n.smallBoards[m.big]!);
  if (n.bigResult === null) {
    n.bigResult = checkWinner(n.smallResults.map((r) => (r === 'draw' || r === null ? null : r)));
  }
  if (n.bigResult !== null) {
    n.activeSmallBoard = null;
    return n;
  }
  n.activeSmallBoard = playable(n, m.small) ? m.small : null;
  n.currentPlayer = n.currentPlayer === 'X' ? 'O' : 'X';
  // Ходить некуда, а победителя нет — ничья
  if (tttLegalMoves(n).length === 0) n.bigResult = 'draw';
  return n;
}

/* ---------------------------------------------------------------- бот */

const other = (p: TttSymbol): TttSymbol => (p === 'X' ? 'O' : 'X');
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;

function twoInRow(cells: TttResult[], p: TttSymbol): boolean {
  for (const [a, b, c] of LINES) {
    const line = [cells[a] ?? null, cells[b] ?? null, cells[c] ?? null];
    if (line.filter((x) => x === p).length === 2 && line.filter((x) => x === null).length === 1) return true;
  }
  return false;
}

/** Ход, который сразу выигрывает партию или поле с угрозой на большом. */
function winningMove(s: TttState, p: TttSymbol): TttMove | null {
  for (const m of tttLegalMoves(s)) {
    const probe = { ...s, currentPlayer: p };
    if (!tttIsLegal(probe, m)) continue;
    const r = tttApplyMove(probe, m);
    if (r.bigResult === p) return m;
    if (r.smallResults[m.big] === p && twoInRow(r.smallResults.map((x) => (x === 'draw' ? null : x)), p)) return m;
  }
  return null;
}

function score(s: TttState, m: TttMove, p: TttSymbol): number {
  const r = tttApplyMove(s, m);
  let v = 0;
  if (r.bigResult === p) v += 100;
  if (r.bigResult === other(p)) v -= 100;
  if (r.smallResults[m.big] === p) v += 10;
  if (r.smallResults[m.big] === other(p)) v -= 10;
  if (s.activeSmallBoard === null && r.activeSmallBoard === m.small) v += 2;
  return v;
}

/** Ход бота: лёгкий — случайно, средний — добить/заблокировать и центр, сложный — оценка. */
export function tttBotMove(s: TttState, difficulty: TttDifficulty): TttMove {
  const moves = tttLegalMoves(s);
  if (!moves.length) throw new Error('no_moves');
  const me = s.currentPlayer;
  if (difficulty === 'easy') return pick(moves);
  const win = winningMove(s, me);
  if (win) return win;
  const block = winningMove(s, other(me));
  if (block && tttIsLegal(s, block)) return block;
  if (difficulty === 'medium') {
    const centers = moves.filter((m) => m.small === 4);
    return centers.length && Math.random() < 0.6 ? pick(centers) : pick(moves);
  }
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const v = score(s, m, me) + Math.random() * 0.5;
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
  }
  return best;
}
