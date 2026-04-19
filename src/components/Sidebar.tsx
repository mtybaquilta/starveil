import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ACHIEVEMENTS } from '../config/achievements'

type Props = {
  activeMissionCount: number
  achievementCount: number
}

const NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/buildings', label: 'Buildings' },
  { to: '/resources', label: 'Resources' },
  { to: '/shipyard', label: 'Shipyard' },
  { to: '/fleet', label: 'Fleet' },
  { to: '/galaxy', label: 'Galaxy Map' },
  { to: '/missions', label: 'Missions' },
  { to: '/research', label: 'Research' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/inbox', label: 'Inbox' },
]

const LOCKED_ITEMS: { label: string; hint: string }[] = []

export function Sidebar({ activeMissionCount, achievementCount }: Props) {
  const { signOut } = useAuth()

  return (
    <div className="w-44 bg-slate-950/50 border-r border-slate-800/30 flex flex-col">
      <nav className="py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `block px-4 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-slate-100 font-semibold bg-indigo-500/10 border-l-2 border-indigo-500'
                  : 'text-slate-400 hover:text-slate-200 border-l-2 border-transparent'
              }`
            }
          >
            {item.label}
            {item.to === '/missions' && activeMissionCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-indigo-500/20 text-indigo-400 rounded-full">
                {activeMissionCount}
              </span>
            )}
            {item.to === '/achievements' && (
              <span className="ml-1.5 text-[9px] text-slate-500">
                {achievementCount}/{ACHIEVEMENTS.length}
              </span>
            )}
          </NavLink>
        ))}

        {LOCKED_ITEMS.map((item) => (
          <div
            key={item.label}
            className="px-4 py-2 text-xs text-slate-600 border-l-2 border-transparent cursor-not-allowed"
            title={item.hint}
          >
            {item.label} 🔒
          </div>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="px-4 py-3 border-t border-slate-800/30">
          <button
            onClick={signOut}
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
