import { runEmailDigestJob } from './email-digest-runner';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getYesterdayUtc(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

async function main() {
  const enabled = process.env.JOBS_ENABLED ?? 'true';
  if (enabled.toLowerCase() === 'false') {
    console.log('[jobs] JOBS_ENABLED=false; exiting.');
    return;
  }

  const intervalMs = Number(process.env.JOBS_INTERVAL_MS ?? 15 * 60 * 1000);
  console.log(`[jobs] Email digest runner started. intervalMs=${intervalMs}`);

  while (true) {
    const targetDate = getYesterdayUtc();
    const runDate = targetDate.toISOString().slice(0, 10);
    console.log(`[jobs] Attempting email digests/reminders for ${runDate}`);

    try {
      await runEmailDigestJob(targetDate);
      console.log(`[jobs] Completed run for ${runDate}`);
    } catch (error) {
      console.error('[jobs] Run failed:', error);
    }

    await sleep(intervalMs);
  }
}

main().catch((e) => {
  console.error('[jobs] Fatal error:', e);
  process.exit(1);
});

