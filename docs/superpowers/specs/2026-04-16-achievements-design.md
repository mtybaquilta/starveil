# Achievements System

## Context

Achievements are a core engagement driver. Players need visible milestones to track progress and show off accomplishments. The system starts as cosmetic badge collection, designed to support public profiles in the future (when multiplayer ships).

---

## Architecture

### Database

New table:

```sql
player_achievements (
  id uuid PK DEFAULT gen_random_uuid(),
  player_id uuid FK → players NOT NULL,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, achievement_id)
)
```

RLS: Players can SELECT their own achievements. Insert handled server-side only (edge function). Future: add public read policy when profiles ship.

### Achievement Definitions

Client-side config: `src/config/achievements.ts`

```ts
type AchievementConfig = {
  id: string
  name: string
  description: string        // Flavor text
  icon: string               // Image path (placeholder initially)
  category: 'combat' | 'economy' | 'exploration' | 'construction' | 'research'
  condition: AchievementCondition
}

type AchievementCondition =
  | { type: 'building_level'; buildingId: string; level: number }
  | { type: 'tech_level'; techId: string; level: number }
  | { type: 'tech_branch_complete'; branch: TechBranch }
  | { type: 'mission_count'; missionType: string; count: number }
  | { type: 'ship_count'; shipId?: string; count: number }
  | { type: 'sectors_discovered'; count: number }
  | { type: 'resource_accumulated'; resource: 'metal' | 'gas'; amount: number }
  | { type: 'first_action'; action: string }
```

### Unlock Checking

Server-side in `supabase/functions/game-action/index.ts`. After completing actions, check relevant achievement conditions:

- After `complete_build` → check construction achievements
- After `complete_research` → check research achievements
- After `resolve_mission` → check combat/exploration achievements
- After `complete_ship_build` → check ship count achievements

The check function queries current state (building levels, tech levels, mission count, etc.) and inserts any newly satisfied achievements.

---

## Starter Achievement Set

### Construction (5)
| ID | Name | Condition |
|---|---|---|
| `first_steps` | First Steps | Build HQ to Lv.2 |
| `architect` | Architect | Any building reaches Lv.5 |
| `megalopolis` | Megalopolis | Any building reaches Lv.10 |
| `power_grid` | Power Grid | Solar Array reaches Lv.5 |
| `fortified` | Fortified | Build all defense structures |

### Research (4)
| ID | Name | Condition |
|---|---|---|
| `curious_mind` | Curious Mind | Complete first research |
| `scholar` | Scholar | Research 5 different technologies |
| `specialist` | Specialist | Max out any single technology |
| `visionary` | Visionary | Research all techs in one branch |

### Combat (4)
| ID | Name | Condition |
|---|---|---|
| `first_blood` | First Blood | Win first raid mission |
| `fleet_commander` | Fleet Commander | Have 50+ total ships |
| `unstoppable` | Unstoppable | Win 10 raid missions |
| `armada` | Armada | Have 100+ total ships |

### Exploration (3)
| ID | Name | Condition |
|---|---|---|
| `pioneer` | Pioneer | Send first probe |
| `cartographer` | Cartographer | Discover 10 sectors |
| `galaxy_explorer` | Galaxy Explorer | Discover 50 sectors |

### Economy (4)
| ID | Name | Condition |
|---|---|---|
| `miner` | Miner | Accumulate 10,000 metal total |
| `tycoon` | Tycoon | Accumulate 100,000 metal total |
| `gas_baron` | Gas Baron | Accumulate 100,000 gas total |
| `industrialist` | Industrialist | Metal Mine + Gas Refinery both Lv.5+ |

---

## UI

### Achievements Page (`src/pages/AchievementsPage.tsx`)

- New route: `/achievements`
- Sidebar nav item with badge count (e.g., "Achievements (7/20)")
- Category tabs: All, Construction, Research, Combat, Exploration, Economy
- Grid of achievement cards:
  - **Unlocked**: Colored icon, name, description, unlock date
  - **Locked**: Grayed-out silhouette, "???" name, hidden description
- Progress indicator: "X / Y unlocked" per category

### Unlock Notification

- Toast notification when achievement unlocks during gameplay
- Appears after any action that triggers an unlock (build complete, research complete, etc.)
- Small, non-intrusive, auto-dismisses after 5 seconds
- Shows achievement icon, name, and "Achievement Unlocked!"

### Data Flow

- `usePlanet` hook extended to fetch `player_achievements` on load
- Achievement definitions matched client-side against unlocked IDs
- Toast triggered by comparing achievement count before/after a `refetch()`

---

## Future-Proofing

- Table structure supports public read policies for other players' achievements
- Achievement definitions are client-side, so any player can render another's badges
- Condition types are extensible (add new union members for colonization, PvP achievements later)

---

## Verification

1. Complete a building upgrade → achievement should unlock and toast should appear
2. Achievements page should show correct locked/unlocked state
3. Sidebar badge count should update in real-time after unlocks
4. Achievement should persist across page reloads (stored in DB)
