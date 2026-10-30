import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Artifact directory for agent display
const ARTIFACT_DIR = 'C:\\Users\\Madhav Krishna T\\.gemini\\antigravity\\brain\\61aa50af-496d-4cb3-bf47-a50d16fcdc68';

async function capture() {
  console.log('Launching Puppeteer with system Chrome to capture Devpost screenshots...');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

  console.log('Using executable:', executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1200, height: 850, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  console.log('Navigating to https://taste-passport-tawny.vercel.app...');
  await page.goto('https://taste-passport-tawny.vercel.app', { waitUntil: 'networkidle2' });

  // 1. Screenshot 1: Input Step
  console.log('1. Capturing Input Step screenshot...');
  const inputStepPath = path.join(SCREENSHOT_DIR, '01_input_step.png');
  await page.screenshot({ path: inputStepPath });
  console.log('✓ Saved:', inputStepPath);

  // 2. Click "Find My Matches" and wait for Step 2
  console.log('Clicking "Find My Matches"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Find My Matches')
    );
    if (btn) (btn as HTMLElement).click();
  });

  // Wait for Step 2
  await page.waitForFunction(() => document.body.innerText.includes('Step 2: Confirm Your Cultural Matches'), {
    timeout: 15000,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot 2: Confirm Step
  console.log('2. Capturing Confirm Step screenshot...');
  const confirmStepPath = path.join(SCREENSHOT_DIR, '02_confirm_step.png');
  await page.screenshot({ path: confirmStepPath });
  console.log('✓ Saved:', confirmStepPath);

  // 3. Click "Build Passport for Toronto Area"
  console.log('Clicking "Build Passport for Toronto Area"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Build Passport')
    );
    if (btn) (btn as HTMLElement).click();
  });

  // Wait for results
  console.log('Waiting for pipeline results stream to complete on Vercel...');
  await page.waitForFunction(() => document.body.innerText.includes('First Month Settling Guide'), {
    timeout: 45000,
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Screenshot 3: Results Overview & First Month Settling Guide
  console.log('3. Capturing Results Overview screenshot...');
  const resultsPath = path.join(SCREENSHOT_DIR, '03_results_overview.png');
  await page.screenshot({ path: resultsPath });
  console.log('✓ Saved:', resultsPath);

  // Screenshot 4: Signal Check Panel
  console.log('4. Capturing Signal Check Panel screenshot...');
  // Scroll down slightly so Signal Check is centered
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('h3')).find((h) => h.innerText.includes('Signal Check'));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 1000));
  const signalCheckPath = path.join(SCREENSHOT_DIR, '04_signal_check.png');
  await page.screenshot({ path: signalCheckPath });
  console.log('✓ Saved:', signalCheckPath);

  // Screenshot 5: Qloo-Inferred Categories & Place Cards
  console.log('5. Capturing Categories & Place Cards screenshot...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('h3')).find((h) => h.innerText.includes('Kerala'));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    else window.scrollBy(0, 500);
  });
  await new Promise((r) => setTimeout(r, 1000));
  const placesPath = path.join(SCREENSHOT_DIR, '05_place_cards.png');
  await page.screenshot({ path: placesPath });
  console.log('✓ Saved:', placesPath);

  // Copy screenshots to artifact directory for presentation
  const artifactScreenshotDir = path.join(ARTIFACT_DIR, 'screenshots');
  if (!fs.existsSync(artifactScreenshotDir)) {
    fs.mkdirSync(artifactScreenshotDir, { recursive: true });
  }
  for (const name of ['01_input_step.png', '02_confirm_step.png', '03_results_overview.png', '04_signal_check.png', '05_place_cards.png']) {
    fs.copyFileSync(path.join(SCREENSHOT_DIR, name), path.join(artifactScreenshotDir, name));
  }

  await browser.close();
  console.log('\nAll 5 Devpost screenshots successfully captured and saved to docs/screenshots/ and artifact directory!');
}

capture().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
