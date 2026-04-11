import type { PlanetEvent } from '../hooks/usePlanet'

type Props = {
  events: PlanetEvent[]
}

const EVENT_ICONS: Record<string, string> = {
  build_started: '🔨',
  build_completed: '✅',
  storage_full: '⚠️',
  system: '📡',
}

export function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-xs text-slate-500 py-4 text-center">
        No events yet
      </div>
    )
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-slate-800/30">
          <span className="text-xs mt-0.5">{EVENT_ICONS[event.event_type] ?? '•'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 truncate">{event.message}</div>
            <div className="text-[10px] text-slate-600">
              {new Date(event.created_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
