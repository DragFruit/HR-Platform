import type { Employee } from '~/composables/useEmployees';
import type { OrgLink, OrgUnit } from '~/composables/useOrgStructure';
import { employeeNamesMatch, normalizeEmployeeNameKey } from '~/utils/employeeName';
import { normalizeOrgUnitKey, rosterSectionsForOrgUnitName } from '~/utils/orgUnitEmployees';

/**
 * Группы Digital для лимита «1 человек в отпуске одновременно на группу» — из оргструктуры
 * (редактор /admin/organization: core.org_units + core.org_links).
 *
 * Как читаем структуру:
 * - нода «Digital отдел» (unit, название содержит digital/диджитал);
 * - её дочерние units по связям unit→unit («Отдел контекстной и медийной рекламы»,
 *   «Отдел SMM & Influence & Таргета», «Отдел аналитики»; при вложенности берём листья);
 * - состав каждой дочерней ноды и её деление на секции — те же правила, что показывает
 *   панель сотрудников оргсхемы (rosterSectionsForOrgUnitName): контекст делится на группы
 *   по руководителям (Лунин / Попов / Цхай), SMM — группа Носкова, аналитика — одна группа.
 * - группа = секция листовой ноды. Сама нода Digital (директор и те, кто стоит прямо в ней,
 *   без дочерней ноды) группой не является: у них только лимит отдела.
 *
 * Группа, в которую входит Цхай Виталий, получает id `digital-tskhai` (исключение из лимита
 * группы, vacation-tskhai-no-reservation-caps.mdc). Остальным сохраняются прежние id, если
 * руководитель совпадает (digital-popov / digital-lunin / digital-noskov, аналитика —
 * digital-analytics): на них могут быть настроены лимиты в reservationMonthlyCapsByGroup.
 */

export type OrgStructureLike = {
  units: Pick<OrgUnit, 'id' | 'name'>[];
  links: Pick<OrgLink, 'from' | 'to'>[];
};

export type OrgVacationGroup = {
  id: string;
  label: string;
  members: Employee[];
};

export const TSKHAI_GROUP_ID = 'digital-tskhai';
const TSKHAI_NAME = 'Цхай Виталий';

/** Прежние id групп по руководителю (совместимость с сохранёнными лимитами). */
const LEGACY_GROUP_ID_BY_LEAD: readonly { lead: string; id: string }[] = [
  { lead: 'Попов Виктор', id: 'digital-popov' },
  { lead: 'Лунин Дмитрий', id: 'digital-lunin' },
  { lead: 'Носков Никита', id: 'digital-noskov' }
];

const isDigitalUnitName = (name: string) => {
  const key = normalizeOrgUnitKey(name);
  return key.includes('digital') || key.includes('диджитал');
};

const slug = (value: string) => normalizeOrgUnitKey(value).replace(/\s+/g, '-');

function childUnitIds(parentId: string, links: OrgStructureLike['links']): string[] {
  return links
    .filter((link) => link.from.kind === 'unit' && link.from.id === parentId && link.to.kind === 'unit')
    .map((link) => link.to.id)
    .filter((id) => id !== parentId);
}

function leafUnitsUnder(rootId: string, org: OrgStructureLike): Pick<OrgUnit, 'id' | 'name'>[] {
  const byId = new Map(org.units.map((unit) => [unit.id, unit]));
  const out: Pick<OrgUnit, 'id' | 'name'>[] = [];
  const seen = new Set<string>([rootId]);
  const walk = (id: string) => {
    for (const childId of childUnitIds(id, org.links)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      const unit = byId.get(childId);
      if (!unit) continue;
      const grandChildren = childUnitIds(childId, org.links).filter((cid) => byId.has(cid) && !seen.has(cid));
      if (grandChildren.length) walk(childId);
      else out.push(unit);
    }
  };
  walk(rootId);
  return out;
}

const sortByName = (list: Employee[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

/**
 * Группы Digital из оргструктуры. null — в структуре нет ноды Digital с дочерними нодами,
 * в которых есть сотрудники (тогда вызывающий берёт запасную раскладку из кода).
 */
export function resolveDigitalOrgVacationGroups(
  org: OrgStructureLike | null | undefined,
  employees: readonly Employee[]
): OrgVacationGroup[] | null {
  if (!org?.units?.length || !employees.length) return null;
  const digitalUnit = org.units.find((unit) => isDigitalUnitName(unit.name));
  if (!digitalUnit) return null;

  const groups: OrgVacationGroup[] = [];
  const usedIds = new Set<number>();

  for (const unit of leafUnitsUnder(digitalUnit.id, org)) {
    const sections = rosterSectionsForOrgUnitName(unit.name, employees);
    for (const section of sections) {
      const members = sortByName(
        section.people
          .map((person) => person.employee)
          .filter((emp): emp is Employee => Boolean(emp) && !usedIds.has(emp!.id))
      );
      if (!members.length) continue;
      for (const emp of members) usedIds.add(emp.id);

      const leadKey = section.id.startsWith('mgr-') ? section.id.slice(4) : '';
      const legacy = leadKey
        ? LEGACY_GROUP_ID_BY_LEAD.find((row) => normalizeEmployeeNameKey(row.lead) === leadKey)
        : undefined;
      const hasTskhai = members.some((emp) => employeeNamesMatch(emp.name, TSKHAI_NAME));
      const isAnalytics = normalizeOrgUnitKey(unit.name).includes('аналитик');

      const id = hasTskhai
        ? TSKHAI_GROUP_ID
        : legacy
          ? legacy.id
          : isAnalytics
            ? 'digital-analytics'
            : `digital-org-${slug(unit.name)}${leadKey ? `-${slug(leadKey)}` : ''}`;

      const sectionLabel = section.label.trim();
      const label =
        sectionLabel && sectionLabel !== unit.name.trim()
          ? `Digital / ${unit.name.trim()} · ${sectionLabel.replace(/^Группа\s*·\s*/i, '')}`
          : `Digital / ${unit.name.trim()}`;

      groups.push({ id, label, members });
    }
  }

  return groups.length ? groups : null;
}
