# StarVeil — Feature Backlog

Durable list of deferred features and improvements. Ordering within a section is rough priority (top = higher). Edit freely; when starting new work, check here first for scope and existing motivation.

Status legend: **[ ]** not started · **[~]** in progress · **[x]** shipped · **[-]** dropped.

---

## Up next

Prioritized for upcoming work. More context to be added before scoping.

- **[x] Multi-planet production overview** — shipped 2026-04-22.
- **[ ] Espionage** — see *Strategic texture*.
- **[x] Anomalies / expeditions** — shipped 2026-04-22 (v1 dev-triggered, 5 anomaly types).

---

## Depth to existing systems

- **[ ] Cancel/recall** — Cancel in-progress building, ship, and research queues; recall dispatched fleets mid-travel. No such control exists today — once started, everything runs to completion, which is painful on misclicks or when a PvP situation changes. *High player-experience win, low mechanics risk. Originally flagged while brainstorming co-op world bosses on 2026-04-19.*
- **[ ] Fleet templates / presets** — Save named fleet loadouts ("Raid A", "Defensive Screen"), one-click fill the dispatch panel. Reduces the tedium of repeated raids / bosses / salvage runs.
- **[ ] Multi-planet production overview** — One screen aggregating rates, queues, and alerts across all owned colonies. Today requires cycling through PlanetSelector.

## Social / world

- **[ ] Alliances or pacts** — Lightweight first pass: non-aggression lists, shared probe intel. Lays groundwork for full alliance UI later without committing to it.
- **[ ] Global comms channel** — Simple world-scoped chat/message log with rate limiting. Apex events already hinted at needing this for coordination.
- **[ ] Player trade** — Resource marketplace or direct player-to-player offers. Adds an economy layer that doesn't exist today.

## New PvE content

- **[ ] Anomalies / expeditions** — Timed, discoverable map events (narrative one-shot, puzzle, RNG loot crate). Cheap to author, high variety.
- **[ ] Boss difficulty tiers / prestige kills** — Scale existing bosses with modifiers (hardened armor, regen, escorts) once a player has killed them once. Extends the world boss loop without new art.
- **[ ] Storyline arcs** — Chained quests that gate new tech / ships / titles. Long-term direction beyond sandbox loops.
- **[ ] Invasions** — Defensive mirror of the apex event loop: enemy waves herald globally and attack players' colonies during a window. Heavy feature, deliberately parked.

## Strategic texture

- **[ ] Espionage** — Send spies to enemy colonies for intel on buildings/fleet before attacking. Natural counter to blind raids.
- **[ ] Terrain / planet specialization** — Planets with innate resource bias or defense bonuses so colony placement matters.
- **[ ] Sector-wide weather** — Extend the per-planet weather system with events affecting whole regions (solar storms disrupting comms/missions).

## Quality of life

- **[ ] Mobile-responsive layout** — Sidebar and galaxy map don't work on narrow viewports today.
- **[ ] Notifications** — Browser push or a toast center for mission returns, incoming attacks, apex heralds.
- **[ ] Onboarding / tutorial flow** — Guided first-hour so new players don't bounce off UI density.

---

## Notes on process

When pulling an item:
1. Move its bullet here to `[~]` and link to the in-progress plan/spec in `docs/superpowers/`.
2. On ship, flip to `[x]` with a one-line note or commit ref, or just remove it.
3. If scope has grown, split into sub-items before starting.
