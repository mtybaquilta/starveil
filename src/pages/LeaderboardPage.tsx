import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BOSSES, getBossConfig } from '../config/bosses'

type BossKill = {
  id: string
  player_id: string
  planet_id: string
  boss_id: string
  killed_at: string
  player_username?: string
  planet_name?: string
}

export function LeaderboardPage() {
  const [kills, setKills] = useState<BossKill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: killRows } = await supabase
        .from('world_boss_kills')
        .select('id, player_id, planet_id, boss_id, killed_at')
        .order('killed_at', { ascending: false })
        .limit(200)
      const rows: BossKill[] = killRows ?? []
      const playerIds = Array.from(new Set(rows.map((r) => r.player_id)))
      const planetIds = Array.from(new Set(rows.map((r) => r.planet_id)))
      const [{ data: players }, { data: planets }] = await Promise.all([
        playerIds.length
          ? supabase.from('players').select('id, username').in('id', playerIds)
          : Promise.resolve({ data: [] as { id: string; username: string }[] }),
        planetIds.length
          ? supabase.from('planets').select('id, name').in('id', planetIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ])
      const playerMap = new Map((players ?? []).map((p) => [p.id, p.username]))
      const planetMap = new Map((planets ?? []).map((p) => [p.id, p.name]))
      setKills(rows.map((r) => ({
        ...r,
        player_username: playerMap.get(r.player_id) ?? 'Unknown',
        planet_name: planetMap.get(r.planet_id) ?? '',
      })))
      setLoading(false)
    })()
  }, [])

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-100 mb-1">World Boss Leaderboard</h1>
      <p className="text-xs text-slate-500 mb-5">Commanders who have bested the galaxy's most fearsome threats.</p>

      {loading && <div className="text-xs text-slate-500">Loading...</div>}

      {!loading && BOSSES.map((boss) => {
        const bossKills = kills.filter((k) => k.boss_id === boss.id)
        return (
          <div key={boss.id} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <img src={boss.image} alt={boss.name} className="w-8 h-8 rounded object-cover" />
              <div>
                <div className="text-sm font-semibold text-slate-200">{boss.name}</div>
                <div className="text-[10px] text-fuchsia-400 uppercase tracking-wider">{boss.tier} tier · {bossKills.length} kill{bossKills.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {bossKills.length === 0 ? (
              <div className="text-[11px] text-slate-600 italic pl-10">No commander has claimed this kill.</div>
            ) : (
              <div className="space-y-1 pl-10">
                {bossKills.slice(0, 10).map((k, i) => (
                  <div key={k.id} className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-500 font-mono w-5">{i + 1}.</span>
                    <span className="text-slate-200 font-semibold">{k.player_username}</span>
                    {k.planet_name && <span className="text-slate-500">· {k.planet_name}</span>}
                    <span className="text-slate-600 ml-auto">{new Date(k.killed_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {!loading && kills.length === 0 && (
        <div className="text-xs text-slate-600 mt-4">No world boss kills yet. Be the first.</div>
      )}

      {!loading && (
        <div className="mt-8 text-[10px] text-slate-600">
          Bosses: {BOSSES.map((b) => `${b.name} (${b.tier})`).join(' · ')} ·
          {' '}Available via galaxy-map probe rolls. Hunt them while they last — respawns are long.
          {' '}Reference: {BOSSES.map((b) => getBossConfig(b.id).name).length} tiers.
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-white/90 mb-2">Apex Events — Cooperative Kills</h2>
        <ApexEventsList />
      </section>
    </div>
  )
}

type ApexEventRow = {
  id: string
  boss_id: string
  phase: string
  resolved_at: string | null
  contributions: Array<{
    player_id: string
    damage_dealt: number
    killing_blow: boolean
    rewarded_metal: number
    rewarded_gas: number
    player_username?: string
  }>
}

function ApexEventsList() {
  const [rows, setRows] = useState<ApexEventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: events } = await supabase
        .from('apex_boss_events')
        .select('id, boss_id, phase, resolved_at')
        .in('phase', ['killed', 'escaped'])
        .order('resolved_at', { ascending: false })
        .limit(10)
      if (!events || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }
      const eventIds = events.map((e) => e.id)
      const { data: contribs } = eventIds.length
        ? await supabase
            .from('world_boss_contributions')
            .select('event_id, player_id, damage_dealt, killing_blow, rewarded_metal, rewarded_gas')
            .in('event_id', eventIds)
        : { data: [] as any[] }
      const playerIds = Array.from(new Set((contribs ?? []).map((c) => c.player_id)))
      const { data: players } = playerIds.length
        ? await supabase.from('players').select('id, username').in('id', playerIds)
        : { data: [] as { id: string; username: string }[] }
      const nameMap = new Map((players ?? []).map((p) => [p.id, p.username]))
      if (cancelled) return
      setRows(
        events.map((e) => ({
          ...e,
          contributions: (contribs ?? [])
            .filter((c) => c.event_id === e.id)
            .sort((a, b) => b.damage_dealt - a.damage_dealt)
            .map((c) => ({ ...c, player_username: nameMap.get(c.player_id) })),
        })),
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="text-xs text-slate-500">Loading apex events...</div>
  if (rows.length === 0) return <div className="text-xs text-white/40">No apex events resolved yet.</div>
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        let bossName = r.boss_id
        try {
          bossName = getBossConfig(r.boss_id).name
        } catch { /* unknown boss id */ }
        return (
          <div key={r.id} className="p-3 rounded bg-white/5 border border-white/10">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-200">{bossName}</span>
              <span className={`text-[10px] uppercase ${r.phase === 'killed' ? 'text-fuchsia-400' : 'text-white/40'}`}>{r.phase}</span>
            </div>
            <div className="text-[10px] text-white/50">{r.resolved_at ? new Date(r.resolved_at).toLocaleString() : ''}</div>
            <ul className="mt-2 space-y-0.5 text-xs">
              {r.contributions.map((c) => (
                <li key={c.player_id} className={c.killing_blow ? 'text-fuchsia-300' : 'text-white/70'}>
                  {c.player_username ?? c.player_id.slice(0, 8)} — {c.damage_dealt} dmg · +{c.rewarded_metal} metal, +{c.rewarded_gas} gas
                  {c.killing_blow ? ' (killing blow)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
