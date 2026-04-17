import { Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TECHNOLOGIES, getTechsByBranch, researchCost, researchTimeSeconds } from '../config/technologies'
import type { TechBranch } from '../config/technologies'
import type { GameContext } from '../components/Layout'

const BRANCH_LABELS: Record<TechBranch, string> = {
  military:    'Military',
  economy:     'Economy',
  exploration: 'Exploration',
  energy:      'Energy',
}

const BRANCHES: TechBranch[] = ['military', 'economy', 'exploration', 'energy']

const BRANCH_ICONS: Record<TechBranch, React.JSX.Element> = {
  military: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z" />
    </svg>
  ),
  economy: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  exploration: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <circle cx="12" cy="12" r="10" />
      <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z" />
    </svg>
  ),
  energy: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
}

const BRANCH_COLORS: Record<TechBranch, string> = {
  military: 'text-red-400',
  economy: 'text-amber-400',
  exploration: 'text-cyan-400',
  energy: 'text-yellow-400',
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function ResearchPage() {
  const { buildings, technologies, activeResearch, researchTimeRemaining, resources, refetch } = useOutletContext<GameContext>()
  const [activeBranch, setActiveBranch] = useState<TechBranch>('military')
  const [researching, setResearching] = useState<string | null>(null)

  const techLevels = new Map(technologies.map((t) => [t.tech_id, t.level]))
  const labLevel = buildings.find((b) => b.building_id === 'research_lab')?.level ?? 0

  const getTechLevel = (techId: string) => techLevels.get(techId) ?? 0

  const canResearch = (techId: string): { ok: boolean; reason?: string } => {
    if (activeResearch) return { ok: false, reason: 'Research in progress' }
    const tech = TECHNOLOGIES.find((t) => t.id === techId)
    if (!tech) return { ok: false, reason: 'Unknown tech' }
    const currentLevel = getTechLevel(techId)
    if (currentLevel >= tech.maxLevel) return { ok: false, reason: 'Max level' }
    if (labLevel < tech.requiredLabLevel) return { ok: false, reason: `Lab Lv.${tech.requiredLabLevel} required` }
    for (const prereq of tech.prerequisites) {
      if (getTechLevel(prereq.techId) < prereq.level) {
        const prereqTech = TECHNOLOGIES.find((t) => t.id === prereq.techId)
        return { ok: false, reason: `${prereqTech?.name ?? prereq.techId} Lv.${prereq.level} required` }
      }
    }
    const nextLevel = currentLevel + 1
    const cost = researchCost(tech.baseCost, nextLevel)
    if (resources.metal < cost.metal || resources.gas < cost.gas) return { ok: false, reason: 'Insufficient resources' }
    return { ok: true }
  }

  const handleResearch = async (techId: string, planetId: string) => {
    setResearching(techId)
    try {
      const { data, error } = await supabase.functions.invoke('game-action', {
        body: { action: 'start_research', planetId, techId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await refetch()
    } catch (err) {
      console.error('Research failed:', err)
    } finally {
      setResearching(null)
    }
  }

  // We need planetId — get it from buildings context
  const planetId = buildings.length > 0 ? undefined : undefined  // retrieved via GameContext below

  return (
    <ResearchPageInner
      labLevel={labLevel}
      activeResearch={activeResearch}
      researchTimeRemaining={researchTimeRemaining}
      activeBranch={activeBranch}
      setActiveBranch={setActiveBranch}
      getTechLevel={getTechLevel}
      canResearch={canResearch}
      researching={researching}
      handleResearch={handleResearch}
    />
  )
}

// Separate inner component so we can pull planetId from context
function ResearchPageInner({
  labLevel,
  activeResearch,
  researchTimeRemaining,
  activeBranch,
  setActiveBranch,
  getTechLevel,
  canResearch,
  researching,
  handleResearch,
}: {
  labLevel: number
  activeResearch: { tech_id: string; target_level: number; completes_at: string } | null
  researchTimeRemaining: number | null
  activeBranch: TechBranch
  setActiveBranch: (b: TechBranch) => void
  getTechLevel: (id: string) => number
  canResearch: (id: string) => { ok: boolean; reason?: string }
  researching: string | null
  // deno-lint-ignore no-explicit-any
  handleResearch: (techId: string, planetId: string) => void
}) {
  const { planet } = useOutletContext<GameContext>()
  const branchTechs = getTechsByBranch(activeBranch)

  if (labLevel === 0) {
    return (
      <div>
        <h1 className="text-lg font-bold text-slate-100 mb-1">Research</h1>
        <p className="text-xs text-slate-500 mb-6">Unlock technologies to advance your empire</p>
        <div className="bg-slate-800/30 rounded-xl p-8 border border-dashed border-slate-700/30 text-center">
          <div className="text-4xl mb-3">🔬</div>
          <div className="text-sm font-semibold text-slate-300 mb-1">No Research Lab</div>
          <p className="text-xs text-slate-500 mb-4">Build a Research Lab to start researching technologies.</p>
          <Link to="/buildings/research_lab" className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
            Build Research Lab
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Research</h1>
          <p className="text-xs text-slate-500 mt-0.5">Research Lab Lv.{labLevel}</p>
        </div>
        {activeResearch && (
          <div className="text-right">
            <div className="text-xs text-indigo-400 font-medium">
              Researching: {TECHNOLOGIES.find((t) => t.id === activeResearch.tech_id)?.name} → Lv.{activeResearch.target_level}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {researchTimeRemaining !== null && researchTimeRemaining > 0
                ? formatTime(researchTimeRemaining / 1000)
                : 'Completing...'}
            </div>
          </div>
        )}
      </div>

      {/* Branch tabs */}
      <div className="flex gap-1 border-b border-slate-800/40 pb-0">
        {BRANCHES.map((branch) => (
          <button
            key={branch}
            onClick={() => setActiveBranch(branch)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeBranch === branch
                ? 'bg-slate-800/60 text-slate-100 border border-b-0 border-slate-700/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {BRANCH_LABELS[branch]}
          </button>
        ))}
      </div>

      {/* Tech list */}
      <div className="space-y-2">
        {branchTechs.map((tech) => {
          const currentLevel = getTechLevel(tech.id)
          const nextLevel = currentLevel + 1
          const cost = currentLevel < tech.maxLevel ? researchCost(tech.baseCost, nextLevel) : null
          const time = currentLevel < tech.maxLevel ? researchTimeSeconds(tech.baseTimeSeconds, nextLevel) : 0
          const { ok, reason } = canResearch(tech.id)

          return (
            <div
              key={tech.id}
              className="bg-slate-900/40 border border-slate-800/40 rounded-lg p-3 flex items-start gap-3"
            >
              <div className={`flex-shrink-0 mt-0.5 ${BRANCH_COLORS[tech.branch]} opacity-60`}>
                {BRANCH_ICONS[tech.branch]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">{tech.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400">
                    Lv.{currentLevel}/{tech.maxLevel}
                  </span>
                </div>
                <p className="text-[10px] italic text-slate-400 mt-0.5 leading-relaxed">{tech.lore}</p>
                <p className="text-[10px] text-slate-500 mt-1">{tech.bonuses.map((b) => b.description).join(' · ')}</p>
                {cost && (
                  <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                    <span>⚙️ {Math.round(cost.metal).toLocaleString()} metal</span>
                    <span>💨 {Math.round(cost.gas).toLocaleString()} gas</span>
                    <span>⏱ {formatTime(time)}</span>
                  </div>
                )}
                {tech.prerequisites.length > 0 && (
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    Requires: {tech.prerequisites.map((p) => {
                      const pTech = TECHNOLOGIES.find((t) => t.id === p.techId)
                      return `${pTech?.name ?? p.techId} Lv.${p.level}`
                    }).join(', ')}
                  </div>
                )}
              </div>

              {currentLevel < tech.maxLevel && (
                <button
                  onClick={() => handleResearch(tech.id, planet.id)}
                  disabled={!ok || researching === tech.id}
                  title={!ok ? reason : undefined}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {researching === tech.id ? '…' : ok ? 'Research' : reason}
                </button>
              )}
              {currentLevel >= tech.maxLevel && (
                <span className="flex-shrink-0 text-[10px] text-green-500 font-medium px-2">Max</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
