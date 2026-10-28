/**
 * Должности, которым в режиме сотрудника во вкладке «Общий» календаря отпусков
 * показывается вся компания (только просмотр; лимиты, согласования и права не меняются).
 * Сейчас — главный бухгалтер («Главный бухгалтер», «Гл. бухгалтер»).
 */
const normalizeTitle = (raw: string | null | undefined) =>
  String(raw ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CHIEF_ACCOUNTANT_RE = /^(главный|гл) бухгалтер$/;

export function isChiefAccountantTitle(title: string | null | undefined): boolean {
  return CHIEF_ACCOUNTANT_RE.test(normalizeTitle(title));
}

export function seesCompanyWideVacationCalendar(title: string | null | undefined): boolean {
  return isChiefAccountantTitle(title);
}
