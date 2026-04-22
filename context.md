# StarVeil — Project Context

## Overview

**StarVeil** is a browser-based space 4X game built with React 19 + Vite + TypeScript on the frontend and Supabase (Postgres + Deno edge functions) on the backend.

Players colonize planets, construct buildings, research technologies, build ship fleets and planetary defenses, explore a shared galaxy map via probes and radar, dispatch missions (mining, raiding, salvage), raid bandit camps and world bosses, attack other players' colonies, and climb achievement and leaderboard ladders.

All game actions funnel through a single `game-action` edge function that mutates authoritative server state. The client is a thin reactive view driven by Supabase-js subscriptions and hooks — most gameplay math (combat, resource ticks, reward splits) lives server-side so clients cannot cheat via devtools.

Recent additions:

- Three-tier world boss framework (minor / elite / apex).
- Cooperative apex event system with herald-then-spawn lifecycle, shared HP pool, proportional-damage rewards, and a +10% killing-blow bonus — the game's first genuinely global PvE loop.
- **Multi-planet dashboard** on the Overview page — at-a-glance rows for every owned colony (resources, rates, energy %, weather, construction / ship / mission queues); doubles as a planet selector.
- **Anomalies / Expeditions** — discoverable galaxy-map events (5 v1 types: Resource Cache, Derelict Probe, Signal Ghost, Pirate Ambush, Void Echo) with race-to-claim resolution and RNG reward tables. First fleet to arrive wins; late arrivals return empty.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind, React Router, Vitest
- **Backend:** Supabase Postgres (with RLS), Deno edge functions, service-role client for privileged mutations
- **Dev tooling:** Playwright MCP for E2E, Supabase MCP for DB/edge-function management, a `dev mode` flag that unlocks admin buttons (spawn opponent, spawn boss, herald apex)

## UI — Nav Items

The app uses a left sidebar with the following entries (see `src/components/Sidebar.tsx`):

- **Overview** — Multi-colony dashboard (one row per owned planet with live rates, energy %, weather, and queue slots) plus details for the active colony: weather display and recent events. The dashboard rows act as a planet selector.
- **Buildings** — Construct and upgrade planetary buildings (mines, harvesters, solar array, shipyard, labs, storage, defensive structures). Drives the construction queue.
- **Resources** — Detailed breakdown of metal / gas / energy production: base rates, research bonuses, weather modifiers, and energy balance.
- **Shipyard** — Queue ship and planetary-defense builds. Gated by Shipyard building level and tech prerequisites.
- **Fleet** — View your ship inventory on this planet and deploy ships into missions or attacks from a single screen.
- **Galaxy Map** — Zoomable 2D map. Run Radar scans to detect coordinates, send Probes to reveal what's there (asteroids, bandits, habitable planets, enemy colonies, debris, world bosses, anomalies). Also the launch point for raids, colonizations, expeditions, and (in dev mode) spawning opponents / heralding apex bosses / spawning anomalies.
- **Missions** — Compose and dispatch non-PvP missions (mining, raiding bandit camps / world bosses, salvaging debris, expeditions to anomalies). Shows active missions with countdowns and boss warning panels (including the cooperative apex panel).
- **Research** — Spend metal / gas at the Research Lab to unlock tech that boosts production, combat stats, or unlocks ships / buildings.
- **Achievements** — Unlockable milestones; badge in nav shows `earned / total` progress.
- **Leaderboard** — Rankings for world boss kills per tier, plus the Apex Events section with per-contributor damage and killing-blow highlighting.
- **Inbox** — Player-facing event log: combat reports, mission returns, apex event notifications, colony attack results.

## Persistent UI Chrome

Outside the main content area, a few components are always present:

- **ResourceBar** (top) — Live metal / gas / energy counters with production rates, weather effects, planet name, coordinates, and an incoming-attack warning badge.
- **PlanetSelector** — Shown when the player owns multiple colonies; switches the active planet context.
- **QueueStrip** — Shows the current construction, ship, and research builds with countdowns.
- **AchievementToast** — Popups for newly earned achievements.
- **ApexEventBanner** — Global banner during heralded / active apex events; shows boss name, countdown, and live HP during the active phase.

## Key Gameplay Loops

- **Economy loop** — Build mines and harvesters → power with solar array → research multipliers → upgrade storage → fund ships and buildings.
- **Exploration loop** — Radar Array detects coordinates → Probes reveal contents → mission or raid targets become available on the map.
- **PvE loop (solo)** — Raid bandit camps, mine asteroids, salvage debris, hunt minor / elite world bosses, and race rival fleets to claim anomalies for resources and achievements.
- **PvE loop (cooperative)** — Apex world boss events herald globally, all players see them on the map, anyone can dispatch fleets during the active window; rewards split proportionally by damage with a killing-blow bonus.
- **PvP loop** — Scan enemy coordinates, probe to confirm, dispatch attack fleets with combat reports returning to the Inbox.
