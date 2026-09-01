/** Справочник `/admin/employees` — фиксированные значения для селектов. */

export const LEGAL_ENTITY_OPTIONS = ['Высокие Бизнес Идеи', 'ВиБиАй'] as const;
export type LegalEntityOption = (typeof LEGAL_ENTITY_OPTIONS)[number];

/** Устаревшие значения `legal_entity` в employees.json → полное имя для заявления. */
const LEGAL_ENTITY_LEGACY_FULL: Record<string, string> = {
  Высокие: 'Высокие Бизнес Идеи'
};

/** Полное юр. лицо для заявления на отпуск (устаревшее «Высокие» → «Высокие Бизнес Идеи»). */
export const resolveLegalEntityFullName = (value: string | null | undefined): string => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return LEGAL_ENTITY_LEGACY_FULL[trimmed] ?? trimmed;
};

export const CONTRACT_FORM_OPTIONS = ['СЗ', 'ТД'] as const;
export type ContractFormOption = (typeof CONTRACT_FORM_OPTIONS)[number];

export const CONTRACT_FORM_TD: ContractFormOption = 'ТД';

/** Трудовой договор — для заявления на отпуск. */
export const isLaborContractEmployee = (contractForm: string | null | undefined): boolean =>
  (contractForm ?? '').trim() === CONTRACT_FORM_TD;
