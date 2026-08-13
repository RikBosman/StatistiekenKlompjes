import { syncOrders } from '../lib/sync'

async function main() {
  const after = process.argv[2]
  const before = process.argv[3]

  console.log(`Syncing orders: after=${after ?? 'begin'} before=${before ?? 'nu'}`)

  const result = await syncOrders(after, before)

  if (result.error) {
    console.error('Fout:', result.error)
    process.exit(1)
  } else {
    console.log(`Klaar: ${result.count} bestellingen gesynchroniseerd`)
    process.exit(0)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
