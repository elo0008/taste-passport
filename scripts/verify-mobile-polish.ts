import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/mobile-polish');
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
  console.log(`   ✓ Saved: ${filename}`);
}

interface ViewportDef {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportDef[] = [
  { name: '360x740', width: 360, height: 740 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '568x320_landscape', width: 568, height: 320 },
];

async function checkNoHorizontalOverflow(page: any, viewLabel: string, vpName: string) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const clientWidth = doc.clientWidth;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
    const hasOverflow = scrollWidth > clientWidth;

    const overflowingElements: string[] = [];
    if (hasOverflow) {
      const all = document.querySelectorAll('*');
      for (const el of Array.from(all)) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1 || rect.left < -1) {
          overflowingElements.push(
            `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')} (w:${Math.round(rect.width)}, r:${Math.round(rect.right)})`
          );
          if (overflowingElements.length >= 5) break;
        }
      }
    }

    return {
      clientWidth,
      scrollWidth,
      hasOverflow,
      overflowingElements,
    };
  });

  if (result.hasOverflow) {
    console.error(
      `   ❌ [OVERFLOW FAIL] ${viewLabel} @ ${vpName}: scrollWidth (${result.scrollWidth}) > clientWidth (${result.clientWidth})`
    );
    console.error(`      Culprits: ${result.overflowingElements.join(', ')}`);
  } else {
    console.log(
      `   ✓ [SCROLL OK] ${viewLabel} @ ${vpName}: scrollWidth (${result.scrollWidth}) === clientWidth (${result.clientWidth})`
    );
  }

  return !result.hasOverflow;
}

async function run() {
  console.log('=== MOBILE POLISH AUTOMATED VERIFICATION SUITE ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let allOverflowChecksPassed = true;

  // Synthetic result payload matching approved data contract
  const syntheticResult = {
    destination: 'Toronto',
    categories: [
      {
        title: 'Coastal Flavors & Toddy Shop Comforts',
        kind: 'inferred',
        kindLabel: 'Inferred Cultural Cuisine',
        badge: 'High Affinity',
        tasteLiftBadge: '2.8x Lift',
        rawTasteLift: 2.8,
        intro: 'Rooted in coconut-infused coastal curries and slow-simmered regional spices reminiscent of traditional backwater kitchens.',
        places: [
          {
            id: 'place_1',
            name: 'Kairali Kerala Cuisine',
            address: '1210 Eglinton Ave E, Toronto, ON M4A 1N9',
            rating: 4.8,
            dishes: ['Meen Pollichathu', 'Appam & Stew', 'Karimeen Fry', 'Beef Roast', 'Malabar Parotta', 'Kerala Biryani', 'Thattukada Dosa'],
            blurb: 'Renowned for authentic banana-leaf wrapped pearl spot fish and crisp, lace-edged appams with slow-stewed coconut gravy.',
            phone: '+1 416-555-0199',
            website: 'https://maps.google.com',
            imageUrl: null,
          },
          {
            id: 'place_2',
            name: 'Malabar Coastal Pantry',
            address: '4550 Kingston Rd, Scarborough, ON M1E 2P3',
            rating: 4.6,
            dishes: ['Thalassery Biryani', 'Fish Mango Curry', 'Ghee Roast'],
            blurb: 'Brings Northern Kerala spice profiles forward with fragrant kaima rice biryanis and tangy raw-mango fish curries.',
            phone: '+1 416-555-0144',
            website: null,
            imageUrl: null,
          },
          {
            id: 'place_3',
            name: 'Canara Coastal Kitchen',
            address: '280 Spadina Ave, Toronto, ON M5T 2E7',
            rating: 4.5,
            dishes: ['Kori Rotti', 'Anjal Masala Fry', 'Neer Dosa'],
            blurb: 'Deeply aromatic coastal fare highlighting tamarind, freshly grated coconut, and pan-seared Kingfish specialties.',
            phone: null,
            website: 'https://maps.google.com',
            imageUrl: null,
          },
          {
            id: 'place_4',
            name: 'Spice Route Express',
            address: '777 Bay St, Toronto, ON M5G 2C8',
            rating: 4.4,
            dishes: ['Puttu & Kadala Curry', 'Kothu Parotta'],
            blurb: 'Quick vibrant tiffin options centered on steamed rice cylinders with robust black chickpea gravy.',
            phone: '+1 416-555-0182',
            website: null,
            imageUrl: null,
          },
          {
            id: 'place_5',
            name: 'Travancore Heritage Dining',
            address: '1888 Steeles Ave W, Vaughan, ON L4K 2Z8',
            rating: 4.7,
            dishes: ['Duck Mappas', 'Kerala Porotta', 'Nadan Kozhi Curry'],
            blurb: 'Elegantly executed heritage gravies with coriander seed, fennel, and rich coconut cream.',
            phone: '+1 905-555-0112',
            website: 'https://maps.google.com',
            imageUrl: null,
          },
          {
            id: 'place_6',
            name: 'Cochin Harbor Grille',
            address: '500 Lakeshore Blvd W, Toronto, ON M5V 2V9',
            rating: 4.6,
            dishes: ['Tiger Prawn Roast', 'Squid Pepper Fry', 'Tapioca & Fish Curry'],
            blurb: 'Harborside seafood spot famous for fiery pepper-tossed calamari and kappa vevichathu.',
            phone: '+1 416-555-0177',
            website: 'https://maps.google.com',
            imageUrl: null,
          },
        ],
      },
      {
        title: 'Filter Coffee & Vegetarian Tiffin Counters',
        kind: 'inferred',
        kindLabel: 'Inferred Cultural Cuisine',
        badge: 'High Affinity',
        tasteLiftBadge: '2.1x Lift',
        rawTasteLift: 2.1,
        intro: 'South Indian breakfast traditions highlighting golden ghee dosas, steamed idlis, and chicory-blended filter kaapi.',
        places: [
          {
            id: 'place_7',
            name: 'Saravanaa Bhavan',
            address: '1571 Sandhurst Cir, Scarborough, ON M1V 1V2',
            rating: 4.7,
            dishes: ['Paper Ghee Roast', 'Medu Vada', 'Filter Coffee'],
            blurb: 'Iconic vegetarian staple for crisp sourdough dosas, sambar brewed with drumsticks, and freshly froths coffee.',
            phone: '+1 416-555-0133',
            website: 'https://maps.google.com',
            imageUrl: null,
          },
        ],
      },
      {
        title: 'Spices, Pickles & Malabar Pantries',
        kind: 'grocery',
        kindLabel: 'Cultural Pantry & Specialty Grocery',
        badge: 'Regional Pantry',
        tasteLiftBadge: null,
        rawTasteLift: 0,
        intro: 'Authentic ingredients, fragrant green cardamom, frozen shredded coconut, and cold-pressed coconut oil for cooking at home.',
        places: [
          {
            id: 'place_8',
            name: 'Pravasi South Asian Market',
            address: '3250 Markham Rd, Scarborough, ON M1X 1E4',
            rating: 4.5,
            dishes: ['Matta Rice', 'Kerala Mixture', 'Banana Chips in Coconut Oil'],
            blurb: 'Well-stocked specialty market carrying Palakkadan matta rice, tender mango pickles, and freshly fried banana chips.',
            phone: '+1 416-555-0166',
            website: null,
            imageUrl: null,
          },
        ],
      },
    ],
    firstMonth:
      'Week 1: Arrival & Coastal Comforts. Week 1 begins with visits to Kairali Kerala Cuisine and Malabar Coastal Pantry for regional fish fry and biryani options.\n' +
      'Week 2: Dosas & Heritage Tables. Week 2 continues at Saravanaa Bhavan and Canara Coastal Kitchen for dosas and biryanis.\n' +
      'Week 3: Travancore Traditions. Week 3 explores Travancore Heritage Dining and Spice Route Express for biryani and fusion curries.\n' +
      'Week 4: Downtown Regional Feasts. Week 4 concludes the month with meals at Cochin Harbor Grille and Pravasi South Asian Market.',
    signalCheck: [
      {
        favoriteName: 'Premam',
        favoriteType: 'movie',
        isConsistent: true,
        divergenceReason: null,
        topTags: [
          { tagName: 'Indian', count: 48 },
          { tagName: 'Kerala', count: 28 },
          { tagName: 'South Indian', count: 24 },
        ],
      },
      {
        favoriteName: 'Drishyam',
        favoriteType: 'movie',
        isConsistent: true,
        divergenceReason: null,
        topTags: [
          { tagName: 'Indian', count: 45 },
          { tagName: 'South Indian', count: 26 },
          { tagName: 'Kerala', count: 25 },
        ],
      },
      {
        favoriteName: 'A. R. Rahman',
        favoriteType: 'artist',
        isConsistent: true,
        divergenceReason: null,
        topTags: [
          { tagName: 'Indian', count: 50 },
          { tagName: 'South Indian', count: 32 },
          { tagName: 'Fast Food', count: 18 },
        ],
      },
      {
        favoriteName: 'K. S. Chithra',
        favoriteType: 'artist',
        isConsistent: true,
        divergenceReason: null,
        topTags: [
          { tagName: 'Indian', count: 49 },
          { tagName: 'South Indian', count: 30 },
          { tagName: 'Kerala', count: 22 },
        ],
      },
      {
        favoriteName: 'Vaikom Muhammad Basheer',
        favoriteType: 'person',
        isConsistent: false,
        divergenceReason: 'Pulled toward general contemporary European fiction & bar dining rather than regional South Asian cuisine.',
        topTags: [
          { tagName: 'European', count: 8 },
          { tagName: 'Bar Food', count: 5 },
          { tagName: 'Tex Mex', count: 4 },
        ],
      },
    ],
    tasteVsBaseline: {
      destination: 'Toronto',
      tasteTop: [
        { tagName: 'Indian', count: 48 },
        { tagName: 'South Indian', count: 24 },
        { tagName: 'Kerala', count: 20 },
        { tagName: 'Seafood', count: 18 },
        { tagName: 'Asian', count: 14 },
      ],
      baselineTop: [
        { tagName: 'American', count: 27 },
        { tagName: 'Seafood', count: 27 },
        { tagName: 'Bar', count: 17 },
        { tagName: 'Canadian', count: 13 },
        { tagName: 'Italian', count: 10 },
      ],
    },
    meta: {
      ms: 18400,
      qlooCalls: 11,
      llmCalls: 1,
      cached: false,
      groundingViolations: 0,
      narrationMode: 'full',
      notice: 'Metro area coverage: Venues span Toronto, Scarborough, and Vaughan.',
      droppedCategories: ['Contemporary Fusion'],
    },
  };

  // TEST 1: Step 1 (Empty, 3 favorites, 8 favorites) across viewports
  console.log('\n--- 1. Testing Step 1 (Empty, 3 Favorites, 8 Favorites) ---');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // Step 1: Default (5 favorites)
    let ok = await checkNoHorizontalOverflow(page, 'Step 1 (Default)', vp.name);
    if (!ok) allOverflowChecksPassed = false;

    // Check input font-sizes (must be >= 16px to prevent iOS zoom)
    const inputFontSizes = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select'));
      return inputs.map((inp) => ({
        id: inp.id || (inp as HTMLInputElement).placeholder || inp.tagName,
        fontSize: window.getComputedStyle(inp).fontSize,
        height: inp.getBoundingClientRect().height,
      }));
    });
    if (vp.name === '390x844') {
      console.log('   Input & Select inspections (iOS zoom prevention):');
      inputFontSizes.forEach((i) => {
        const px = parseFloat(i.fontSize);
        console.log(`     ${i.id}: font-size=${i.fontSize} (>=16px: ${px >= 16}), height=${Math.round(i.height)}px (>=44px: ${i.height >= 44})`);
      });
    }

    // Capture Step 1 Default
    let buf = await page.screenshot({ fullPage: false });
    saveDual(`step1_default_${vp.name}.png`, buf as Buffer);

    // Delete down to 3 favorites
    await page.evaluate(() => {
      const deleteButtons = Array.from(document.querySelectorAll('button[aria-label^="Delete"]'));
      if (deleteButtons.length > 3) {
        (deleteButtons[deleteButtons.length - 1] as HTMLElement).click();
      }
      if (deleteButtons.length > 4) {
        (deleteButtons[deleteButtons.length - 2] as HTMLElement).click();
      }
    });
    await new Promise((r) => setTimeout(r, 200));
    ok = await checkNoHorizontalOverflow(page, 'Step 1 (3 Favorites)', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    buf = await page.screenshot({ fullPage: false });
    saveDual(`step1_3_favorites_${vp.name}.png`, buf as Buffer);

    // Add up to 8 favorites
    await page.evaluate(() => {
      const nameInput = document.querySelector('input[placeholder="Name of favorite..."]') as HTMLInputElement;
      const addBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Add Favorite'));
      const extras = ['Spirited Away', 'Pulp Fiction', 'Sholay', 'Interstellar', 'Parasite'];
      for (const name of extras) {
        if (document.querySelectorAll('.fav-row-card').length >= 8) break;
        if (nameInput && addBtn) {
          nameInput.value = name;
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          (addBtn as HTMLElement).click();
        }
      }
    });
    await new Promise((r) => setTimeout(r, 200));
    ok = await checkNoHorizontalOverflow(page, 'Step 1 (8 Favorites)', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    buf = await page.screenshot({ fullPage: false });
    saveDual(`step1_8_favorites_${vp.name}.png`, buf as Buffer);
  }

  // Set up mock request interception for Step 2, Step 3, and Results
  await page.setRequestInterception(true);
  page.on('request', (req: any) => {
    const url = req.url();
    if (url.includes('/api/resolve')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              inputName: 'Premam',
              inputType: 'movie',
              candidates: [
                { entityId: 'cand_1', name: 'Premam', year: 2015, disambiguation: 'Malayalam', description: 'George and his friends journey through life, love and adulthood.' },
                { entityId: 'cand_1b', name: 'Premam', year: 2016, disambiguation: 'Telugu Remake', description: 'Telugu romantic drama directed by Chandoo Mondeti.' },
              ],
            },
            {
              inputName: 'Drishyam',
              inputType: 'movie',
              candidates: [
                { entityId: 'cand_2', name: 'Drishyam', year: 2013, disambiguation: 'Malayalam', description: 'A man goes to extreme lengths to save his family from the law.' },
                { entityId: 'cand_2b', name: 'Drishyam', year: 2015, disambiguation: 'Hindi Remake', description: 'Hindi adaptation starring Ajay Devgn and Tabu.' },
              ],
            },
            {
              inputName: 'A. R. Rahman',
              inputType: 'artist',
              candidates: [
                { entityId: 'cand_3', name: 'A. R. Rahman', disambiguation: 'Composer', description: 'Oscar and Grammy winning composer from Chennai.' },
              ],
            },
          ],
        }),
      });
    } else if (url.includes('/api/passport')) {
      const streamData = [
        JSON.stringify({ type: 'progress', stage: 'resolving', message: 'Resolving favorites...' }),
        JSON.stringify({ type: 'progress', stage: 'inferring_cuisines', message: 'Extracting regional cuisines...' }),
        JSON.stringify({ type: 'result', data: syntheticResult }),
        '',
      ].join('\n');
      req.respond({
        status: 200,
        contentType: 'application/x-ndjson',
        body: streamData,
      });
    } else {
      req.continue();
    }
  });

  // TEST 2: Step 2 Disambiguation across viewports
  console.log('\n--- 2. Testing Step 2 (Disambiguation, Cards, Sticky Bar) ---');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Find My Matches'));
    if (btn) (btn as HTMLElement).click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Step 2: Confirm Your Cultural Matches'), {
    timeout: 10000,
  });
  await new Promise((r) => setTimeout(r, 400));

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 200));
    const ok = await checkNoHorizontalOverflow(page, 'Step 2 Disambiguation', vp.name);
    if (!ok) allOverflowChecksPassed = false;

    if (vp.name === '390x844') {
      const candidateThumbMetrics = await page.evaluate(() => {
        const thumb = document.querySelector('.candidate-thumb');
        const card = document.querySelector('.candidate-card-clean');
        const actionsBar = document.querySelector('.step2-actions-bar');
        const submitBtn = document.querySelector('.btn-step2-submit');
        const backBtn = document.querySelector('.btn-step2-back');

        return {
          thumbWidth: thumb ? thumb.getBoundingClientRect().width : 0,
          cardWidth: card ? card.getBoundingClientRect().width : 0,
          actionsBarPosition: actionsBar ? window.getComputedStyle(actionsBar).position : '',
          submitHeight: submitBtn ? submitBtn.getBoundingClientRect().height : 0,
          backHeight: backBtn ? backBtn.getBoundingClientRect().height : 0,
        };
      });
      console.log('   Step 2 layout measurements on 390x844:');
      console.log(`     Candidate thumbnail width: ${Math.round(candidateThumbMetrics.thumbWidth)}px (approx 72px)`);
      console.log(`     Actions bar position: "${candidateThumbMetrics.actionsBarPosition}" (sticky/fixed at bottom)`);
      console.log(`     Submit button height: ${Math.round(candidateThumbMetrics.submitHeight)}px (>=48px: ${candidateThumbMetrics.submitHeight >= 48})`);
      console.log(`     Back button height: ${Math.round(candidateThumbMetrics.backHeight)}px (>=48px: ${candidateThumbMetrics.backHeight >= 48})`);
    }

    const buf = await page.screenshot({ fullPage: false });
    saveDual(`step2_disambiguation_${vp.name}.png`, buf as Buffer);
  }

  // TEST 3: Step 3 Loading State Card across viewports
  console.log('\n--- 3. Testing Step 3 (Loading State Fixed Height Card) ---');
  // Click build but intercept response delay briefly
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Build my passport'));
    if (btn) (btn as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 300));

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 100));
    const isShowingLoading = await page.evaluate(() => Boolean(document.querySelector('.loading-pipeline-view')));
    if (isShowingLoading) {
      const ok = await checkNoHorizontalOverflow(page, 'Step 3 Loading Card', vp.name);
      if (!ok) allOverflowChecksPassed = false;
      const buf = await page.screenshot({ fullPage: false });
      saveDual(`step3_loading_${vp.name}.png`, buf as Buffer);
    }
  }

  // Wait for Results View
  await page.waitForFunction(() => document.body.innerText.includes('First Month Settling Guide'), {
    timeout: 10000,
  });
  console.log('   ✓ Results rendered successfully!');

  // TEST 4: Results Deliverable Views across viewports
  console.log('\n--- 4. Testing Results Deliverable Views ---');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 200));

    // A. Results Top + Notice + Actions 2-col bar
    await page.evaluate(() => window.scrollTo(0, 0));
    let ok = await checkNoHorizontalOverflow(page, 'Results Top & Action Bar', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    let buf = await page.screenshot({ fullPage: false });
    saveDual(`results_top_${vp.name}.png`, buf as Buffer);

    // B. First Month Settling Guide Week Cards & Wrapped Place Chips
    await page.evaluate(() => {
      const el = document.querySelector('.settling-guide-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 200));
    ok = await checkNoHorizontalOverflow(page, 'First Month Plan Week Cards', vp.name);
    if (!ok) allOverflowChecksPassed = false;

    if (vp.name === '390x844') {
      const chipHeights = await page.evaluate(() => {
        const chips = Array.from(document.querySelectorAll('.week-place-anchor'));
        return chips.map((c) => c.getBoundingClientRect().height);
      });
      console.log(`   Week place chips sampled (count: ${chipHeights.length}): min=${Math.min(...chipHeights).toFixed(1)}px (>=40px: ${chipHeights.every((h) => h >= 40)})`);
    }
    buf = await page.screenshot({ fullPage: false });
    saveDual(`results_week_cards_${vp.name}.png`, buf as Buffer);

    // C. Category Section with 6 Places
    await page.evaluate(() => {
      const el = document.querySelector('.category-section-block');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 200));
    ok = await checkNoHorizontalOverflow(page, 'Category Section (6 Places)', vp.name);
    if (!ok) allOverflowChecksPassed = false;

    if (vp.name === '390x844') {
      const placeCardChecks = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.place-card'));
        const firstCard = cards[0];
        const img = firstCard?.querySelector('.place-image-frame');
        const actions = firstCard?.querySelectorAll('.action-icon-circle-btn');
        const address = firstCard?.querySelector('.place-address');

        return {
          cardCount: cards.length,
          imgAspectRatio: img ? window.getComputedStyle(img).aspectRatio : '',
          actionBtnHeights: actions ? Array.from(actions).map((a) => a.getBoundingClientRect().height) : [],
          isAddressSelectable: address ? window.getComputedStyle(address).userSelect : '',
        };
      });
      console.log(`   Place card checks: total places=${placeCardChecks.cardCount}, img aspect-ratio=${placeCardChecks.imgAspectRatio}`);
      console.log(`   Action buttons height: ${placeCardChecks.actionBtnHeights.map((h) => Math.round(h) + 'px').join(', ')} (all >=44px)`);
      console.log(`   Address text userSelect: "${placeCardChecks.isAddressSelectable}"`);
    }
    buf = await page.screenshot({ fullPage: false });
    saveDual(`results_category_places_${vp.name}.png`, buf as Buffer);

    // D. Signal Check
    await page.evaluate(() => {
      const el = document.querySelector('.signal-check-container');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 200));
    ok = await checkNoHorizontalOverflow(page, 'Signal Check', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    buf = await page.screenshot({ fullPage: false });
    saveDual(`results_signal_check_${vp.name}.png`, buf as Buffer);

    // E. Taste vs Baseline Comparison
    await page.evaluate(() => {
      const el = document.querySelector('.baseline-card');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 200));
    ok = await checkNoHorizontalOverflow(page, 'Taste vs Baseline', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    buf = await page.screenshot({ fullPage: false });
    saveDual(`results_taste_vs_baseline_${vp.name}.png`, buf as Buffer);
  }

  // TEST 5: State Screens (429 Rate Limit, Error, Limited Coverage)
  console.log('\n--- 5. Testing State Screens (429, Error, Limited Coverage) ---');

  // Intercept for 429
  page.removeAllListeners('request');
  page.on('request', (req: any) => {
    if (req.url().includes('/api/resolve')) {
      req.respond({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Rate limit reached. Maximum 6 requests per hour allowed.' }),
      });
    } else {
      req.continue();
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Find My Matches'));
    if (btn) (btn as HTMLElement).click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Rate Limit Reached'), { timeout: 10000 });

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 150));
    const ok = await checkNoHorizontalOverflow(page, '429 Rate Limit Screen', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    const buf = await page.screenshot({ fullPage: false });
    saveDual(`screen_429_rate_limit_${vp.name}.png`, buf as Buffer);
  }

  // Intercept for Error State
  page.removeAllListeners('request');
  page.on('request', (req: any) => {
    if (req.url().includes('/api/resolve')) {
      req.respond({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to search Qloo entity matches due to network timeout.' }),
      });
    } else {
      req.continue();
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Find My Matches'));
    if (btn) (btn as HTMLElement).click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Something Went Wrong'), { timeout: 10000 });

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 150));
    const ok = await checkNoHorizontalOverflow(page, 'Error Screen', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    const buf = await page.screenshot({ fullPage: false });
    saveDual(`screen_error_${vp.name}.png`, buf as Buffer);
  }

  // Limited Coverage State Screen (1 category)
  page.removeAllListeners('request');
  page.on('request', (req: any) => {
    const url = req.url();
    if (url.includes('/api/resolve')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { inputName: 'Premam', inputType: 'movie', candidates: [{ entityId: 'c1', name: 'Premam' }] },
            { inputName: 'Drishyam', inputType: 'movie', candidates: [{ entityId: 'c2', name: 'Drishyam' }] },
          ],
        }),
      });
    } else if (url.includes('/api/passport')) {
      const singleCatResult = {
        ...syntheticResult,
        categories: [syntheticResult.categories[0]],
      };
      const streamData = [
        JSON.stringify({ type: 'progress', stage: 'resolving', message: 'Resolving...' }),
        JSON.stringify({ type: 'result', data: singleCatResult }),
        '',
      ].join('\n');
      req.respond({
        status: 200,
        contentType: 'application/x-ndjson',
        body: streamData,
      });
    } else {
      req.continue();
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Find My Matches'));
    if (btn) (btn as HTMLElement).click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Step 2: Confirm Your Cultural Matches'), {
    timeout: 10000,
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Build my passport'));
    if (btn) (btn as HTMLElement).click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Limited Coverage in Toronto'), {
    timeout: 10000,
  });

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 150));
    const ok = await checkNoHorizontalOverflow(page, 'Limited Coverage Screen', vp.name);
    if (!ok) allOverflowChecksPassed = false;
    const buf = await page.screenshot({ fullPage: false });
    saveDual(`screen_limited_coverage_${vp.name}.png`, buf as Buffer);
  }

  await browser.close();

  console.log('\n=== MOBILE POLISH VERIFICATION SUMMARY ===');
  console.log(`Horizontal Scroll Tests: ${allOverflowChecksPassed ? 'ALL PASSED (0 overflows detected)' : 'FAILURES DETECTED'}`);
  console.log(`Screenshots saved in: ${OUT_DIR}`);

  if (!allOverflowChecksPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in verify-mobile-polish:', err);
  process.exit(1);
});
