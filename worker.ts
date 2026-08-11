/**
 * Standalone worker process — runs alongside Next.js for VPS/Railway deployments.
 * Handles cron jobs without relying on external schedulers.
 *
 * Usage: npm run worker
 * Or as a background process: node -r tsx/esm worker.ts
 */
import cron from 'node-cron'
import { syncProducts, syncOrders } from './lib/sync'
import { processReminders } from './lib/reminders'

console.log('[worker] Starting cron worker...')

// Daily sync at 02:00
cron.schedule('0 2 * * *', async () => {
  console.log('[worker] Starting daily product sync...')
  const result = await syncProducts()
  console.log('[worker] Product sync done:', result)
})

// Daily order sync at 02:30
cron.schedule('30 2 * * *', async () => {
  console.log('[worker] Starting daily order sync...')
  const result = await syncOrders()
  console.log('[worker] Order sync done:', result)
})

// Daily reminder check at 09:00
cron.schedule('0 9 * * *', async () => {
  console.log('[worker] Processing reminders...')
  const result = await processReminders()
  console.log('[worker] Reminders done:', result)
})

console.log('[worker] Cron jobs registered. Waiting...')
