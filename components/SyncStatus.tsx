import { formatDate } from '@/lib/utils'

interface SyncLog {
  id: number
  type: string
  status: string
  message: string | null
  itemCount: number
  createdAt: Date
}

interface Props {
  logs: SyncLog[]
}

const typeLabels: Record<string, string> = {
  products: 'Producten',
  orders: 'Bestellingen',
  reminders: 'Herinneringen',
  ads: 'Advertenties',
}

export default function SyncStatus({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-slate-400 text-sm">
        Nog geen sync uitgevoerd. Klik op "Sync nu" of stel een dagelijkse cron in.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className={`flex items-start gap-3 text-sm p-3 rounded-md ${
            log.status === 'success' ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <span
            className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${
              log.status === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-slate-700">
              {typeLabels[log.type] || log.type}
            </span>
            {log.itemCount > 0 && (
              <span className="text-slate-500 ml-2">({log.itemCount} items)</span>
            )}
            {log.message && (
              <p className="text-red-600 text-xs mt-0.5 truncate">{log.message}</p>
            )}
          </div>
          <span className="text-slate-400 flex-shrink-0">{formatDate(log.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
