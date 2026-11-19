import { describe, expect, it } from 'vitest';
import {
  renderVacationApplicationXml,
  vacationApplicationPages,
  vacationApplicationPeriod
} from '../../server/utils/vacationApplicationDocx';

const base = { employeeName: 'Петров Пётр', position: 'SEO', legalEntity: '' };

describe('заявление: даты после обрезки и billable-дни', () => {
  it('старая заявка 28–31.12.2026 → одна страница 28–30 декабря, 3 дня, выход 11.01.2027', () => {
    const pages = vacationApplicationPages({ ...base, startDate: '2026-12-28', endDate: '2026-12-31' });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      start_date: '28 декабря 2026 г.',
      end_date: '30 декабря 2026 г.',
      days_count: '3',
      return_date: '11 января 2027 г.'
    });
  });

  it('праздник внутри: 25.12.2026–12.01.2027 → два заявления со своими датами, днями и выходом', () => {
    const pages = vacationApplicationPages({ ...base, startDate: '2026-12-25', endDate: '2027-01-12' });
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      start_date: '25 декабря 2026 г.',
      end_date: '30 декабря 2026 г.',
      days_count: '6',
      return_date: '11 января 2027 г.'
    });
    expect(pages[1]).toMatchObject({
      start_date: '9 января 2027 г.',
      end_date: '12 января 2027 г.',
      days_count: '4',
      return_date: '13 января 2027 г.'
    });
  });

  it('имя файла — по обрезанному началу всего периода', () => {
    expect(vacationApplicationPeriod('2026-12-31', '2027-01-12').start).toBe('2027-01-09');
  });

  it('document.xml: тело повторено на каждую страницу через разрыв страницы, поля страницы одни', () => {
    const xml =
      '<w:document><w:body>' +
      '<w:p w14:paraId="1A" w14:textId="2B"><w:r><w:t>{start_date}–{end_date}, {days_count} дн., выход {return_date}</w:t></w:r></w:p>' +
      '<w:sectPr><w:pgSz/></w:sectPr></w:body></w:document>';
    const pages = vacationApplicationPages({ ...base, startDate: '2026-12-25', endDate: '2027-01-12' });
    const out = renderVacationApplicationXml(xml, pages);
    expect(out.split('<w:br w:type="page"/>')).toHaveLength(2);
    expect(out.match(/<w:sectPr>/g)).toHaveLength(1);
    expect(out).toContain('25 декабря 2026 г.–30 декабря 2026 г., 6 дн., выход 11 января 2027 г.');
    expect(out).toContain('9 января 2027 г.–12 января 2027 г., 4 дн., выход 13 января 2027 г.');
    expect(out.match(/w14:paraId/g)).toHaveLength(1);
    expect(out).not.toMatch(/\{[a-z_]+\}/);
  });

  it('один отрезок — без разрыва страницы', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>{days_count}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>';
    const out = renderVacationApplicationXml(
      xml,
      vacationApplicationPages({ ...base, startDate: '2026-12-14', endDate: '2026-12-27' })
    );
    expect(out).not.toContain('w:br');
    expect(out).toContain('<w:t>14</w:t>');
  });
});
