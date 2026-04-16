import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ACHIEVEMENTS, type AchievementCategory } from '../config/achievements'
import type { GameContext } from '../components/Layout'

type CategoryFilter = 'all' | AchievementCategory

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'construction', label: 'Construction' },
  { value: 'research', label: 'Research' },
  { value: 'combat', label: 'Combat' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'economy', label: 'Economy' },
]

const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  construction: '\u{1F3D7}\uFE0F',
  research: '\u{1F52C}',
  combat: '\u{2694}\uFE0F',
  exploration: '\u{1F30D}',
  economy: '\u{1F4B0}',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AchievementsPage() {
  const { achievements } = useOutletContext<GameContext>()
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  const unlockedIds = new Set(achievements.map((a) => a.achievement_id))
  const unlockedMap = new Map(achievements.map((a) => [a.achievement_id, a.unlocked_at]))

  const filtered = activeCategory === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => a.category === activeCategory)

  const totalUnlocked = achievements.length
  const categoryCount = (cat: AchievementCategory) =>
    achievements.filter((a) => ACHIEVEMENTS.find((ac) => ac.id === a.achievement_id)?.category === cat).length
  const categoryTotal = (cat: AchievementCategory) =>
    ACHIEVEMENTS.filter((a) => a.category === cat).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Achievements</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {totalUnlocked} / {ACHIEVEMENTS.length} unlocked
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-slate-800/40 pb-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeCategory === cat.value
                ? 'bg-slate-800/60 text-slate-100 border border-b-0 border-slate-700/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {cat.label}
            {cat.value !== 'all' && (
              <span className="ml-1 text-[9px] text-slate-600">
                {categoryCount(cat.value as AchievementCategory)}/{categoryTotal(cat.value as AchievementCategory)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((achievement) => {
          const isUnlocked = unlockedIds.has(achievement.id)
          const unlockedAt = unlockedMap.get(achievement.id)

          return (
            <div
              key={achievement.id}
              className={`rounded-xl border p-4 transition-colors ${
                isUnlocked
                  ? 'bg-slate-800/40 border-slate-700/30'
                  : 'bg-slate-900/30 border-slate-800/20 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`text-2xl flex-shrink-0 ${isUnlocked ? '' : 'grayscale'}`}>
                  {CATEGORY_ICONS[achievement.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200">
                    {isUnlocked ? achievement.name : '???'}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    {isUnlocked ? achievement.description : 'Keep playing to unlock this achievement.'}
                  </p>
                  {isUnlocked && unlockedAt && (
                    <div className="text-[9px] text-slate-600 mt-1">
                      Unlocked {formatDate(unlockedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
