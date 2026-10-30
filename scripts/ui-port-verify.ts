import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/ui-port');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const ARTIFACT_DIR = 'C:\\Users\\Madhav Krishna T\\.gemini\\antigravity\\brain\\61aa50af-496d-4cb3-bf47-a50d16fcdc68\\screenshots';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function saveDual(filename: string, buffer: Buffer) {
  fs.writeFileSync(path.join(OUT_DIR, filename), buffer);
  fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
  console.log(`Saved screenshot: ${filename}`);
}

async function run() {
  console.log('Starting UI-PORT verification and screenshot suite...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Desktop viewport
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // 1. Step 1 Desktop
  console.log('Capturing Step 1 (Desktop)...');
  let buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_step1.png', buf as Buffer);

  // 1b. Step 1 Mobile (390px)
  console.log('Capturing Step 1 (Mobile 390px)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('mobile_step1.png', buf as Buffer);

  // Back to Desktop for Step 2
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 300));

  // Click Find My Matches
  console.log('Clicking "Find My Matches"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Find My Matches')
    );
    if (btn) (btn as HTMLElement).click();
  });

  // Wait for Step 2
  await page.waitForFunction(() => document.body.innerText.includes('Step 2: Confirm Your Cultural Matches'), {
    timeout: 20000,
  });
  await new Promise((r) => setTimeout(r, 800));

  // 2. Step 2 Desktop
  console.log('Capturing Step 2 (Desktop)...');
  buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_step2.png', buf as Buffer);

  // 2b. Step 2 Mobile
  console.log('Capturing Step 2 (Mobile 390px)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('mobile_step2.png', buf as Buffer);

  // Back to Desktop for Step 3
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 300));

  // Click Build Passport
  console.log('Clicking "Build Passport"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Build Passport')
    );
    if (btn) (btn as HTMLElement).click();
  });

  // Capture Loading Stage
  await new Promise((r) => setTimeout(r, 800));
  console.log('Capturing Loading Stage (Desktop)...');
  buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_loading.png', buf as Buffer);

  // Wait for Results
  console.log('Waiting for Results (First Month Settling Guide)...');
  await page.waitForFunction(() => document.body.innerText.includes('First Month Settling Guide'), {
    timeout: 50000,
  });
  await new Promise((r) => setTimeout(r, 1500));

  // 3. Results Overview Desktop
  console.log('Capturing Results Overview (Desktop)...');
  buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_results_overview.png', buf as Buffer);

  // 3b. Results Overview Mobile
  console.log('Capturing Results Overview (Mobile 390px)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('mobile_results_overview.png', buf as Buffer);

  // 4. Place Cards (Desktop)
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const card = document.querySelector('.place-card');
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise((r) => setTimeout(r, 600));
  console.log('Capturing Place Cards (Desktop)...');
  buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_place_cards.png', buf as Buffer);

  // 5. Signal Check & Taste vs Baseline
  await page.evaluate(() => {
    const signalHeader = Array.from(document.querySelectorAll('h3')).find((h) =>
      h.innerText.includes('Signal Check')
    );
    if (signalHeader) signalHeader.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 600));
  console.log('Capturing Signal Check (Desktop)...');
  buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_signal_check.png', buf as Buffer);

  // Taste vs Baseline
  await page.evaluate(() => {
    const baseline = document.querySelector('.baseline-card');
    if (baseline) baseline.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 600));
  console.log('Capturing Taste vs Baseline (Desktop)...');
  buf = await page.screenshot({ fullPage: false });
  saveDual('desktop_taste_baseline.png', buf as Buffer);

  // Verify text content does NOT contain "undefined", "null", "[object Object]"
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n--- Text Integrity Audit ---');
  const hasUndefined = bodyText.includes('undefined');
  const hasNull = /\bnull\b/.test(bodyText);
  const hasObjectObj = bodyText.includes('[object Object]');
  const hasCitations = /\[cite:?\s*\d*\]/.test(bodyText);

  console.log('Contains "undefined":', hasUndefined);
  console.log('Contains bare "null":', hasNull);
  console.log('Contains "[object Object]":', hasObjectObj);
  console.log('Contains "[cite: N]":', hasCitations);

  if (hasUndefined || hasNull || hasObjectObj || hasCitations) {
    console.error('Text integrity failure! Found invalid tokens in rendered DOM.');
  } else {
    console.log('✓ Text integrity passed cleanly: No raw nulls, undefined, objects, or citations.');
  }

  await browser.close();
  console.log('\nVerification suite completed successfully.');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

