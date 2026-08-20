const puppeteer = require('puppeteer-core');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  const filePath = path.resolve(__dirname, 'og-image.html');
  const fileUrl = 'file:///' + filePath.split(path.sep).join('/');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, 'data/screenshots/og-image.png'), type: 'png' });
  await page.close();
  await browser.close();
  console.log('OG image saved: data/screenshots/og-image.png');
})();
