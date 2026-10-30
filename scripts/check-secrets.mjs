import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let failed = false;

// 1. Confirm .env.local and .private are ignored by git
try {
  const checkIgnoreEnv = execSync('git check-ignore .env.local', { encoding: 'utf-8' }).trim();
  if (!checkIgnoreEnv) {
    console.error('FAIL: .env.local is NOT ignored by git');
    failed = true;
  }
} catch {
  console.error('FAIL: git check-ignore failed for .env.local');
  failed = true;
}

try {
  const checkIgnorePrivate = execSync('git check-ignore .private', { encoding: 'utf-8' }).trim();
  if (!checkIgnorePrivate) {
    console.error('FAIL: .private is NOT ignored by git');
    failed = true;
  }
} catch {
  console.error('FAIL: git check-ignore failed for .private');
  failed = true;
}

// 2. Collect secret keys to check (from process.env or .env.local if present)
const secretKeysToCheck = ['QLOO_API_KEY', 'GEMINI_API_KEY'];
const secrets = [];

// Try to parse .env.local manually if it exists
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (secretKeysToCheck.includes(key) && val.length >= 6) {
        secrets.push({ name: key, value: val });
      }
    }
  }
}

// Also check process.env
for (const key of secretKeysToCheck) {
  const val = process.env[key];
  if (val && val.length >= 6 && !secrets.some(s => s.name === key)) {
    secrets.push({ name: key, value: val });
  }
}

// 3. Check git-tracked files
try {
  const trackedFilesOutput = execSync('git ls-files', { encoding: 'utf-8' });
  const trackedFiles = trackedFilesOutput.split('\n').map(f => f.trim()).filter(Boolean);

  for (const file of trackedFiles) {
    // Skip if file doesn't exist on disk (deleted but staged)
    if (!fs.existsSync(file)) continue;
    const stat = fs.statSync(file);
    if (stat.isDirectory()) continue;

    const fileContent = fs.readFileSync(file, 'utf-8');
    for (const secret of secrets) {
      if (fileContent.includes(secret.value)) {
        console.error(`FAIL: Tracked file "${file}" contains the value of secret "${secret.name}"!`);
        failed = true;
      }
    }
  }
} catch (err) {
  console.error('FAIL: Unable to get git ls-files:', err.message);
  failed = true;
}

if (failed) {
  console.error('\ncheck:secrets FAILED! Security check detected errors.');
  process.exit(1);
} else {
  console.log('check:secrets PASSED: No secrets found in git-tracked files and required paths are git-ignored.');
  process.exit(0);
}

