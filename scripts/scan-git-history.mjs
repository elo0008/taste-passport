import fs from 'fs';
import path from 'path';
import cp from 'child_process';

const envPath = path.resolve('.env.local');
let qlooKey = '';
let geminiKey = '';
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    const trimmed = l.trim();
    if (trimmed.startsWith('QLOO_API_KEY=')) {
      qlooKey = trimmed.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      geminiKey = trimmed.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

console.log('====================================================');
console.log('TASK E: GIT HISTORY SECRET & PATH INTEGRITY SCAN');
console.log('====================================================');

if (!qlooKey || !geminiKey) {
  console.log('Error: Could not read test keys from .env.local');
  process.exit(1);
}

// 1. Scan git diff history for API key values
const logOutput = cp.execSync('git log -p --all', { maxBuffer: 100 * 1024 * 1024 }).toString('utf8');

const qlooFound = qlooKey.length > 5 && logOutput.includes(qlooKey);
const geminiFound = geminiKey.length > 5 && logOutput.includes(geminiKey);

console.log('1. Secret Values in Git Commit History:');
console.log('   - QLOO_API_KEY:  ', qlooFound ? 'FOUND (LEAK DETECTED)' : 'NOT FOUND (CLEAN)');
console.log('   - GEMINI_API_KEY:', geminiFound ? 'FOUND (LEAK DETECTED)' : 'NOT FOUND (CLEAN)');

// 2. Scan historical paths for .private/ or payload-like file names
const nameOnly = cp.execSync('git log --name-only --all', { maxBuffer: 100 * 1024 * 1024 }).toString('utf8');
const fileLines = Array.from(new Set(nameOnly.split('\n').map((s) => s.trim()).filter(Boolean)));

const privatePaths = fileLines.filter((f) => f.startsWith('.private/') || f.includes('.private'));
const payloadLikeFiles = fileLines.filter(
  (f) =>
    f.endsWith('.json') &&
    !f.includes('package') &&
    !f.includes('tsconfig') &&
    !f.includes('vercel')
);

console.log('\n2. Historical Paths Scan:');
console.log('   - Paths under .private/:', privatePaths.length === 0 ? 'NONE (CLEAN)' : privatePaths);
console.log('   - Raw JSON payload files in git history:', payloadLikeFiles.length === 0 ? 'NONE (CLEAN)' : payloadLikeFiles);

console.log('====================================================\n');

if (qlooFound || geminiFound || privatePaths.length > 0) {
  process.exit(1);
}
