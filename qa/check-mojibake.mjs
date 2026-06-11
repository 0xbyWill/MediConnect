import { newBrowser, newContext, BASE } from './lib.mjs';
const browser = await newBrowser();
const { context } = await newContext(browser);
const page = await context.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const t = await page.locator('body').innerText();
const re = /[ÃÂ�]/g;
let m, hits = [];
while ((m = re.exec(t)) && hits.length < 20) {
  hits.push(JSON.stringify(t.slice(Math.max(0, m.index - 25), m.index + 25)));
}
console.log('hits:', hits.length);
hits.forEach(h => console.log(h));
await browser.close();
