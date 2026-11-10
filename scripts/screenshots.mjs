// Usage: node shot.mjs <outDir> <width> <login:email:password|-> <path1> [path2 ...]
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
const [outDir, widthArg, login, ...paths] = process.argv.slice(2);
const width = Number(widthArg) || 1440;
const base = process.env.BASE || 'http://localhost:5000';
const b = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 860 : 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
if (login && login !== '-') {
  const [, email, password] = login.split(':');
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), page.click('button[type=submit]')]);
}
for (const p of paths) {
  await page.goto(`${base}${p}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${outDir}/${name}_${width}.png`, fullPage: true });
  console.log(`${p} -> ${name}_${width}.png${overflow > 0 ? `  [HORIZONTAL OVERFLOW ${overflow}px]` : ''}`);
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await b.close();
