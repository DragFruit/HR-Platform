/** Квест «Синий Ноктюрн». Источник правды по контенту — docs/quests/sinij-nokturn.md. */

export type NokturnSuspectId = 'roman' | 'fedor' | 'lara' | 'timur' | 'ilya' | 'anna';

export type NokturnStageId = 1 | 2 | 3 | 4 | 5;

export type NokturnSuspect = {
  id: NokturnSuspectId;
  name: string;
  role: string;
  photo: string;
  /** Портрет, который подменяет основной после открытия этапа (Фёдор-андроид). */
  photoAfterStage?: { stage: NokturnStageId; photo: string };
};

/**
 * Вид карточки в сейфе.
 * `prop` — предмет на прозрачном фоне: код кладёт сверху накладку-пакет
 *          `prop-evidence-bag.png` и рисует бирку по белой полосе пакета.
 * `doc`  — пустая бумажная подложка: весь текст выводится кодом поверх.
 * `photo`— снимок, показывается как есть, текст подписью под кадром.
 */
export type NokturnEvidenceKind = 'prop' | 'doc' | 'photo';

export type NokturnEvidence = {
  id: string;
  stage: NokturnStageId;
  /** Короткое имя на карточке. */
  title: string;
  /** Текст на бирке / тело документа. Абзацы — отдельными строками. */
  tag: string[];
  kind: NokturnEvidenceKind;
  /** Канонический путь из docs/quests/sinij-nokturn-art.md. */
  image: string;
  /** Обратная сторона снимка, если есть. */
  back?: string;
  /** true — улика выдаётся мини-игрой; false — приходит в пакете дня. */
  fromMinigame?: boolean;
};

export type NokturnTestimony = {
  suspectId: NokturnSuspectId;
  stage: NokturnStageId;
  text: string;
};

/** Горячая зона мини-игры «Поиск предметов». Координаты — доли фона (0..1). */
export type NokturnHotspot = {
  evidenceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type NokturnMinigameKind = 'search' | 'tic-tac-toe' | 'flasks' | 'hack' | 'puzzle';

export type NokturnMinigame = {
  slug: string;
  kind: NokturnMinigameKind;
  title: string;
  /** Фон мини-игры. */
  background: string;
  /** Только для kind === 'search'. */
  hotspots?: NokturnHotspot[];
  /** Секунд на одну попытку. */
  attemptSeconds?: number;
};

export type NokturnStage = {
  id: NokturnStageId;
  /** Календарный день открытия, МСК. */
  dateIso: string;
  weekday: string;
  title: string;
  /** Бриф Соловьёвой на 10:00. Абзацы — отдельными строками. */
  briefing: string[];
  minigame: NokturnMinigame;
  /** Полная ставка за верное имя в свой день. */
  stake: number;
};

export type NokturnMechanicsOption = {
  id: number;
  text: string;
};

/** Состояние кнопки мини-игры (раздел 7 спеки). */
export type NokturnMinigameButtonState =
  | 'locked'
  | 'available'
  | 'done'
  | 'catch-up'
  | 'blocked-by-stage';

export type NokturnStageView = {
  id: NokturnStageId;
  dateIso: string;
  weekday: string;
  title: string;
  briefing: string[];
  stake: number;
  /** Этап доступен игроку прямо сейчас (расписание + календарь догоняющего). */
  open: boolean;
  /** 10:00 дня N уже наступило. */
  scheduleOpen: boolean;
  opensAt: string;
  /** Конец окна полной ставки. */
  fullRateUntil: string;
  /** Этап, который держит календарь догоняющего (решение не вынесено). */
  blockedByStage: NokturnStageId | null;
  minigame: {
    slug: string;
    kind: NokturnMinigameKind;
    title: string;
    background: string;
    attemptSeconds: number;
    hotspots: NokturnHotspot[];
    state: NokturnMinigameButtonState;
    attempts: number;
    solved: boolean;
    /** Улики выданы (мини-игра пройдена или исчерпаны 3 попытки). */
    released: boolean;
  };
  vote: { suspectId: NokturnSuspectId; at: string; points: number; late: boolean } | null;
  evidence: NokturnEvidence[];
  testimonies: NokturnTestimony[];
};

export type NokturnBoardItem = {
  /** id улики. */
  id: string;
  /** Доли доски, 0..1. */
  x: number;
  y: number;
};

export type NokturnBoardThread = {
  id: string;
  from: string;
  to: string;
};

export type NokturnBoard = {
  items: NokturnBoardItem[];
  threads: NokturnBoardThread[];
};
