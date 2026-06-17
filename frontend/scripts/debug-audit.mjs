import { chromium } from 'playwright';

const BASE = 'http://localhost:3456';

async function seedOnboardingDone(page, userIds = [1, 2, 3, 4, 5, 6]) {
  await page.goto(BASE);
  await page.evaluate((ids) => {
    localStorage.setItem('vbi-welcomed-users', JSON.stringify(ids));
    const avatars = Object.fromEntries(ids.map((id) => [String(id), 'character_01']));
    localStorage.setItem('vbi-user-avatars-v1', JSON.stringify(avatars));
    localStorage.setItem(
      'vbi-employees-v3',
      JSON.stringify([
        {
          id: 1,
          name: 'Костя',
          title: 'Руководитель',
          department: 'Команда',
          manager: '',
          hired_at: '2024-01-10',
          platform_user_id: 2,
          email: 'kostya@vbi.local',
          account_role: 'manager'
        },
        {
          id: 2,
          name: 'Катя',
          title: 'Сотрудник',
          department: 'Команда',
          manager: 'Костя',
          hired_at: '2024-03-01',
          platform_user_id: 3,
          email: 'katya@vbi.local',
          account_role: 'employee'
        },
        {
          id: 3,
          name: 'Алина',
          title: 'Сотрудник',
          department: 'Команда',
          manager: 'Костя',
          hired_at: '2026-05-25',
          platform_user_id: 6,
          email: 'alina@vbi.local',
          account_role: 'employee'
        }
      ])
    );
  }, userIds);
}

async function login(page, email, password) {
  await page.goto(BASE);
  await page.waitForSelector('.auth-form input[type="email"], .app-shell', { timeout: 15000 });
  if (await page.locator('.app-shell').count()) return;
  await page.fill('.auth-form input[type="email"]', email);
  await page.fill('.auth-form input[type="password"]', password);
  await page.click('button.auth-submit');
  await page.waitForSelector('.app-shell', { timeout: 15000 });
  if (await page.locator('.onboarding-overlay').count()) {
    await page.click('button:has-text("Далее")');
    await page.waitForSelector('.avatar-picker-item');
    await page.locator('.avatar-picker-item').first().click();
    await page.click('button:has-text("Начать работу")');
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(600);
}

async function logout(page) {
  await page.click('button.logout-btn');
  await page.waitForSelector('.auth-screen', { timeout: 10000 });
  await page.waitForTimeout(400);
}

const results = [];

async function testAdminRefresh(page) {
  await login(page, 'stas@vbi.local', 'admin123');
  await page.goto(`${BASE}/admin/employees`);
  await page.waitForSelector('.personnel-table, .onboarding-box', { timeout: 10000 });
  const before = page.url();
  await page.reload();
  await page.waitForTimeout(1200);
  const after = page.url();
  results.push({
    test: 'A_admin_refresh',
    before,
    after,
    bug: after.includes('/admin/employees') ? false : true
  });
  await logout(page);
}

async function testAdaptationLeak(page) {
  await login(page, 'alina@vbi.local', 'employee123');
  await page.goto(`${BASE}/adaptation`);
  await page.waitForTimeout(1500);
  const alinaText = await page.locator('main.content').innerText();
  await logout(page);

  await login(page, 'katya@vbi.local', 'employee123');
  await page.goto(`${BASE}/adaptation`);
  await page.waitForTimeout(300);
  const katyaEarlyText = await page.locator('main.content').innerText();
  await page.waitForTimeout(1500);
  const katyaLateText = await page.locator('main.content').innerText();

  const showsAlinaEarly =
    katyaEarlyText.includes('Алина') && !katyaEarlyText.includes('Катя');
  results.push({
    test: 'B_adaptation_leak',
    alinaHadContent: alinaText.length > 50,
    showsAlinaEarly,
    katyaEarlySnippet: katyaEarlyText.slice(0, 200),
    katyaLateSnippet: katyaLateText.slice(0, 200),
    bug: showsAlinaEarly
  });
  await logout(page);
}

async function testVacationApprove(page) {
  await page.goto(BASE);
  await page.evaluate(() => {
    const state = {
      primaryYear: 2026,
      requestsByYear: {
        '2026': [
          {
            id: 9999,
            employee: 'Катя',
            start: '2026-07-01',
            end: '2026-07-14',
            status: 'pending',
            comment: 'debug test',
            createdAt: '01.07.2026'
          }
        ]
      },
      nextRequestId: 10000
    };
    localStorage.setItem('vbi-vacations-state-v3', JSON.stringify(state));
  });

  await login(page, 'kostya@vbi.local', 'manager123');
  await page.goto(`${BASE}/vacations`);
  await page.waitForTimeout(1200);
  await page.click('button.filter-btn:has-text("Согласование")');
  await page.waitForTimeout(400);

  const approveBtn = page.locator('button:has-text("Согласовать")').first();
  const hasPending = (await approveBtn.count()) > 0;
  let statusAfter = null;
  if (hasPending) {
    await approveBtn.click();
    await page.waitForTimeout(500);
    statusAfter = await page.evaluate(() => {
      const raw = localStorage.getItem('vbi-vacations-state-v3');
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s.requestsByYear['2026']?.find((r) => r.id === 9999)?.status ?? null;
    });
  }

  results.push({
    test: 'C_vacation_approve',
    hasPending,
    statusAfter,
    bug: hasPending && statusAfter !== 'approved'
  });
  await logout(page);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    results.push({ test: 'console_error', text: msg.text() });
  }
});

try {
  await seedOnboardingDone(page);
  await testAdminRefresh(page);
  await testAdaptationLeak(page);
  await testVacationApprove(page);
} catch (e) {
  results.push({ test: 'fatal', error: String(e) });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
