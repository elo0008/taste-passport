import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/ui-fixes');
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
  console.log(`✓ Saved screenshot: ${filename}`);
}

async function run() {
  console.log('=== Starting Verification for UI Polish Requests ===\n');

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
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // 1. Capture Step 1 "Add another favorite" dock and Find My Matches button
  console.log('1. Capturing Step 1: Add favorite dock & CTA...');
  await page.evaluate(() => {
    window.scrollTo(0, 350);
  });
  await new Promise((r) => setTimeout(r, 400));
  let buf = await page.screenshot({ fullPage: false });
  saveDual('fix_step1_add_favorite_dock.png', buf as Buffer);

  // 2. Click "Find My Matches" and proceed to Step 2
  console.log('2. Navigating to Step 2 to check candidate cards tags...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Find My Matches')
    );
    if (btn) (btn as HTMLElement).click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Step 2: Confirm Your Cultural Matches'), {
    timeout: 25000,
  });
  await new Promise((r) => setTimeout(r, 600));

  // Check candidate cards tags (ensure no duplicate tags)
  const candidateTags = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.candidate-card-clean'));
    return cards.map((c) => {
      const name = (c.querySelector('.candidate-name') as HTMLElement)?.innerText;
      const year = (c.querySelector('.candidate-year-pill') as HTMLElement)?.innerText;
      const tag = (c.querySelector('.candidate-tag-type') as HTMLElement)?.innerText;
      return { name, year, tag };
    });
  });
  console.log('   Candidate cards sampled in Step 2:');
  candidateTags.slice(0, 6).forEach((c) => {
    console.log(`     Name: "${c.name}", Year: "${c.year || 'none'}", Tag: "${c.tag || 'none'}"`);
    if (c.year && c.tag && c.year === c.tag) {
      console.error(`     ❌ ERROR: Duplicate tag detected! Year "${c.year}" equals Tag "${c.tag}"`);
    }
  });

  buf = await page.screenshot({ fullPage: false });
  saveDual('fix_step2_no_duplicate_tags.png', buf as Buffer);

  // 3. Click "Build my passport"
  console.log('\n3. Building passport to check results top, week cards, and signal check...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Build my passport')
    );
    if (btn) (btn as HTMLElement).click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('First Month Settling Guide'), {
    timeout: 70000,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 4. Capture Top of Results Section (Image 3 layout)
  console.log('4. Capturing top of results section (metrics pills & action buttons)...');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('fix_results_top_design.png', buf as Buffer);

  // 5. Measure Week cards dimensions
  console.log('\n5. Measuring Week Cards dimensions for equality...');
  const weekCardDims = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.week-settling-card'));
    return cards.map((c, i) => {
      const rect = c.getBoundingClientRect();
      return { week: i + 1, width: Math.round(rect.width), height: Math.round(rect.height) };
    });
  });
  console.log('   Week cards dimensions:', weekCardDims);
  const allHeightsEqual = weekCardDims.every((w) => Math.abs(w.height - weekCardDims[0].height) <= 2);
  const allWidthsEqual = weekCardDims.every((w) => Math.abs(w.width - weekCardDims[0].width) <= 2);
  console.log(`   ✓ Are all week cards the exact same height? ${allHeightsEqual}`);
  console.log(`   ✓ Are all week cards the exact same width? ${allWidthsEqual}`);

  await page.evaluate(() => {
    const el = document.getElementById('resultsHeading');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('fix_week_cards_equal_dimensions.png', buf as Buffer);

  // 6. Capture Signal Check (with white background)
  console.log('\n6. Capturing Signal Check (with white background)...');
  await page.evaluate(() => {
    const el = document.querySelector('.signal-check-container');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('fix_signal_check_white_bg.png', buf as Buffer);

  await browser.close();
  console.log('\n=== All Verification Completed Successfully ===');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
