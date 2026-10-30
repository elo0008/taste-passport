import fs from 'fs';
import path from 'path';
import { QlooClient } from '../src/lib/qloo';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvLocal();

async function probeSearchTake() {
  const client = new QlooClient();
  for (const take of [3, 5, 10, 20, 50, 100]) {
    try {
      const res = await client.search({
        query: 'curry',
        types: 'urn:entity:place',
        take,
      });
      console.log(`take=${take} -> SUCCESS: returned ${res.length} entities`);
    } catch (err: any) {
      console.log(`take=${take} -> FAILED: ${err.message}`);
    }
  }
}

probeSearchTake();

