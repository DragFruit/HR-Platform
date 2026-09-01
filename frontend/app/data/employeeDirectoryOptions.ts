/** Справочник `/admin/employees` — фиксированные значения для селектов. */

export const LEGAL_ENTITY_OPTIONS = ['Высокие', 'ВиБиАй'] as const;
export type LegalEntityOption = (typeof LEGAL_ENTITY_OPTIONS)[number];

export const CONTRACT_FORM_OPTIONS = ['СЗ', 'ТД'] as const;
export type ContractFormOption = (typeof CONTRACT_FORM_OPTIONS)[number];

export const CONTRACT_FORM_TD: ContractFormOption = 'ТД';

/** Трудовой договор — для заявления на отпуск. */
export const isLaborContractEmployee = (contractForm: string | null | undefined): boolean =>
  (contractForm ?? '').trim() === CONTRACT_FORM_TD;
