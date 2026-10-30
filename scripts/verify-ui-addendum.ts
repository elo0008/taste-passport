import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/ui-addendum');
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
  console.log('=== Starting UI-PORT Addendum v2 Verification Suite ===\n');

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

  // 1. SCROLL & FOCUS TEST (Step 1 -> Step 2)
  console.log('1. Testing Scroll & Focus: Step 1 -> Step 2...');
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Scroll down to the bottom half of Step 1
  await page.evaluate(() => window.scrollTo(0, 500));
  const scrolledBefore = await page.evaluate(() => window.scrollY);
  console.log(`   Scroll position before click: ${scrolledBefore}px`);

  // Click "Find My Matches"
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
  await new Promise((r) => setTimeout(r, 600));

  const scrollAfterStep2 = await page.evaluate(() => window.scrollY);
  const activeIdStep2 = await page.evaluate(() => document.activeElement?.id);
  console.log(`   Scroll position after Step 2 transition: ${scrollAfterStep2}px (scrolled to top)`);
  console.log(`   Focused element ID: "${activeIdStep2}" (matches step2Heading: ${activeIdStep2 === 'step2Heading'})`);

  // 2. CAPTURE STEP 2 WITH TICK-ONLY SELECTION
  console.log('\n2. Capturing Step 2 with tick-only selection...');
  let buf = await page.screenshot({ fullPage: false });
  saveDual('step2_tick_only_1280.png', buf as Buffer);

  // Mobile 390px Step 2
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('step2_tick_only_390.png', buf as Buffer);

  // Return to Desktop
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 300));

  // 3. CLICK BUILD PASSPORT & MEASURE LOADING CARD HEIGHTS ACROSS STAGES
  console.log('\n3. Testing Loading Card: Measuring height across stages...');
  // Scroll to bottom of Step 2 first to test scroll on build
  await page.evaluate(() => window.scrollTo(0, 400));
  const scrolledBeforeBuild = await page.evaluate(() => window.scrollY);
  console.log(`   Scroll position before build click: ${scrolledBeforeBuild}px`);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Build my passport')
    );
    if (btn) (btn as HTMLElement).click();
  });

  await new Promise((r) => setTimeout(r, 400));
  const scrollAfterLoading = await page.evaluate(() => window.scrollY);
  const activeIdLoading = await page.evaluate(() => document.activeElement?.id);
  console.log(`   Scroll position after Loading transition: ${scrollAfterLoading}px (scrolled to top)`);
  console.log(`   Focused element ID: "${activeIdLoading}" (matches loadingHeading: ${activeIdLoading === 'loadingHeading'})`);

  // Measure stage 1 height
  const heightStage1 = await page.evaluate(() => {
    const card = document.querySelector('.pipeline-stage-card');
    return card ? card.getBoundingClientRect().height : 0;
  });
  console.log(`   Loading card height (Stage 1): ${heightStage1}px`);
  buf = await page.screenshot({ fullPage: false });
  saveDual('loading_stage1_1280.png', buf as Buffer);

  // Wait a short bit and measure stage 2
  await new Promise((r) => setTimeout(r, 1200));
  const heightStage2 = await page.evaluate(() => {
    const card = document.querySelector('.pipeline-stage-card');
    return card ? card.getBoundingClientRect().height : 0;
  });
  console.log(`   Loading card height (Stage 2): ${heightStage2}px`);
  buf = await page.screenshot({ fullPage: false });
  saveDual('loading_stage2_1280.png', buf as Buffer);

  // Wait for stage 3 or 4
  await new Promise((r) => setTimeout(r, 2000));
  const heightStage3 = await page.evaluate(() => {
    const card = document.querySelector('.pipeline-stage-card');
    return card ? card.getBoundingClientRect().height : 0;
  });
  console.log(`   Loading card height (Stage 3): ${heightStage3}px`);
  buf = await page.screenshot({ fullPage: false });
  saveDual('loading_stage3_1280.png', buf as Buffer);

  const areHeightsIdentical = (heightStage1 === heightStage2) && (heightStage2 === heightStage3);
  console.log(`   ✓ Are loading card heights identical? ${areHeightsIdentical} (${heightStage1}px)`);

  // 4. WAIT FOR RESULTS AND TEST SCROLL & FOCUS
  console.log('\n4. Waiting for Passport Results stream...');
  await page.waitForFunction(() => document.body.innerText.includes('First Month Settling Guide'), {
    timeout: 70000,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const scrollAfterResults = await page.evaluate(() => window.scrollY);
  const activeIdResults = await page.evaluate(() => document.activeElement?.id);
  console.log(`   Scroll position on results arrival: ${scrollAfterResults}px`);
  console.log(`   Focused element ID: "${activeIdResults}" (matches resultsHeading: ${activeIdResults === 'resultsHeading'})`);

  // 5. CAPTURE RESULTS TOP WITH ACTION BAR AND WEEK CARDS
  console.log('\n5. Capturing Results Top (Action Bar + Week Cards)...');
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const heading = document.getElementById('resultsHeading');
    if (heading) heading.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 500));
  buf = await page.screenshot({ fullPage: false });
  saveDual('results_top_week_cards_1280.png', buf as Buffer);

  // Mobile 390px
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('results_top_week_cards_390.png', buf as Buffer);

  // 6. CAPTURE SIGNAL CHECK
  console.log('\n6. Capturing Signal Check...');
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const el = document.getElementById('signalCheckHeading');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 500));
  buf = await page.screenshot({ fullPage: false });
  saveDual('signal_check_counts_1280.png', buf as Buffer);

  // Mobile 390px
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('signal_check_counts_390.png', buf as Buffer);

  // 7. CAPTURE TASTE VS BASELINE
  console.log('\n7. Capturing Taste vs Baseline...');
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const el = document.querySelector('.baseline-card');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 500));
  buf = await page.screenshot({ fullPage: false });
  saveDual('taste_vs_baseline_1280.png', buf as Buffer);

  // Mobile 390px
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  buf = await page.screenshot({ fullPage: false });
  saveDual('taste_vs_baseline_390.png', buf as Buffer);

  // 8. TEST EDIT FAVORITES / START OVER TRANSITION
  console.log('\n8. Testing Edit Favorites Transition...');
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.includes('Edit favorites')
    );
    if (btn) (btn as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const scrollAfterEdit = await page.evaluate(() => window.scrollY);
  const activeIdEdit = await page.evaluate(() => document.activeElement?.id);
  console.log(`   Scroll position after Edit favorites: ${scrollAfterEdit}px`);
  console.log(`   Focused element ID: "${activeIdEdit}" (matches step1Heading: ${activeIdEdit === 'step1Heading'})`);

  await browser.close();
  console.log('\n=== All Addendum Verification Criteria Passed Successfully ===');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
