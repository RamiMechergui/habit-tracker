/**
 * scripts/backfill-vocab-photos.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gives every stored German vocabulary entry (types `vocab` + `unified-vocab`)
 * an AI-generated descriptive photo, cached in MinIO/S3.
 *
 * Missing-only by default (manual uploads are kept).
 *
 * Usage:
 *   node scripts/backfill-vocab-photos.js [--email=<user>] [--force] [--limit=50] [--dry-run] [--delay-ms=1200]
 *
 *   --email     only process this account (default: all users)
 *   --force     regenerate even when a photo already exists
 *   --limit     max entries per user (default 200, 0 = no limit)
 *   --dry-run   list what would change without generating/uploading
 *   --delay-ms  pause between AI generations per user (default 1200)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { listUsers, getUserByEmail } = require('../db/users');
const { getAllGermanRecords } = require('../db/german');
const vocabPhoto = require('../services/vocabPhoto');

function parseArgs(argv) {
  const opts = { email: null, force: false, limit: 200, dryRun: false, delayMs: 1200 };
  for (const a of argv) {
    if (a.startsWith('--email=')) opts.email = a.slice('--email='.length);
    else if (a === '--force') opts.force = true;
    else if (a.startsWith('--limit=')) opts.limit = parseInt(a.slice('--limit='.length), 10) || 0;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--delay-ms=')) opts.delayMs = parseInt(a.slice('--delay-ms='.length), 10) || 0;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('[backfill-vocab-photos] options:', opts);

  let users;
  if (opts.email) {
    const u = await getUserByEmail(opts.email);
    if (!u) {
      console.error(`User not found: ${opts.email}`);
      process.exit(1);
    }
    users = [u];
  } else {
    users = await listUsers();
  }
  console.log(`[backfill-vocab-photos] ${users.length} user(s)`);

  const totals = { users: users.length, processed: 0, updated: 0, skipped: 0, failed: 0 };
  for (const u of users) {
    const userId = u.userId || u.id;
    const records = await getAllGermanRecords(userId);
    let candidates = records.filter(
      (r) => (r.type === 'vocab' || r.type === 'unified-vocab') && (opts.force || !r.photoUrl)
    );
    if (opts.limit > 0) candidates = candidates.slice(0, opts.limit);
    console.log(`- ${u.email || userId}: ${candidates.length} vocab need photos (${records.filter((r) => r.type === 'vocab' || r.type === 'unified-vocab').length} total vocab)`);

    if (opts.dryRun) {
      for (const c of candidates.slice(0, 20)) {
        console.log(`    would generate: "${c.word}" → "${c.translation}" [${c.recordId}]`);
      }
      if (candidates.length > 20) console.log(`    ... and ${candidates.length - 20} more`);
      totals.processed += candidates.length;
      totals.skipped += candidates.length;
      continue;
    }

    const summary = await vocabPhoto.autoFillVocabPhotos(userId, records, {
      force: opts.force,
      limit: opts.limit > 0 ? opts.limit : candidates.length,
      delayMs: opts.delayMs,
      onProgress: (done, total, rec) =>
        console.log(`    [${done}/${total}] ${rec.word} → ${rec.translation}`),
    });
    totals.processed += summary.processed;
    totals.updated += summary.updated;
    totals.failed += summary.failed;
    totals.skipped += summary.skipped;
    for (const r of summary.results.filter((x) => !x.ok)) {
      console.warn(`    FAILED ${r.word}: ${r.error}`);
    }
  }

  console.log('[backfill-vocab-photos] done:', totals);
}

main().catch((err) => {
  console.error('[backfill-vocab-photos] fatal:', err);
  process.exit(1);
});
