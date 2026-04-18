import perimeterTurretImg from '../assets/defense/perimeter_turret.jpg'
import ionCannonImg from '../assets/defense/ion_turret.jpg'
import missileBatteryImg from '../assets/defense/missile_battery.jpg'
import shieldGeneratorImg from '../assets/defense/shield_generator.jpg'
import sensorJammerImg from '../assets/defense/jammer.jpg'
import orbitalPlatformImg from '../assets/defense/orbital_platform.jpg'

export type DefensePrereq =
  | { kind: 'building'; buildingId: string; level: number }
  | { kind: 'defense'; defenseType: string; count: number }

export type DefenseConfig = {
  id: string
  name: string
  description: string
  cost: { metal: number; gas: number }
  baseBuildTimeSeconds: number
  attack: number
  defense: number
  prerequisites: DefensePrereq[]
  image: string
}

export const DEFENSES: DefenseConfig[] = [
  {
    id: 'perimeter_turret',
    name: 'Perimeter Turret',
    description: 'Automated ballistic turrets forming the first line of planetary defense. Fast to build, cheap to maintain.',
    cost: { metal: 150, gas: 50 },
    baseBuildTimeSeconds: 45,
    attack: 20,
    defense: 15,
    prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 2 }],
    image: perimeterTurretImg,
  },
  {
    id: 'sensor_jammer',
    name: 'Sensor Jammer',
    description: 'Electronic warfare array that disrupts targeting systems, reducing attacker accuracy. Low power, high utility.',
    cost: { metal: 200, gas: 200 },
    baseBuildTimeSeconds: 75,
    attack: 15,
    defense: 25,
    prerequisites: [{ kind: 'building', buildingId: 'headquarters', level: 4 }],
    image: sensorJammerImg,
  },
  {
    id: 'missile_battery',
    name: 'Missile Battery',
    description: 'Guided warhead launchers with excellent range. A balanced mix of firepower and efficiency.',
    cost: { metal: 250, gas: 150 },
    baseBuildTimeSeconds: 90,
    attack: 55,
    defense: 35,
    prerequisites: [
      { kind: 'building', buildingId: 'headquarters', level: 3 },
      { kind: 'defense', defenseType: 'perimeter_turret', count: 3 },
    ],
    image: missileBatteryImg,
  },
  {
    id: 'ion_cannon',
    name: 'Ion Cannon',
    description: 'High-energy directed beam weapon. Devastating against capital ships but draws significant power.',
    cost: { metal: 400, gas: 250 },
    baseBuildTimeSeconds: 120,
    attack: 90,
    defense: 50,
    prerequisites: [
      { kind: 'building', buildingId: 'headquarters', level: 4 },
      { kind: 'building', buildingId: 'research_lab', level: 2 },
    ],
    image: ionCannonImg,
  },
  {
    id: 'shield_generator',
    name: 'Shield Generator',
    description: 'Projects an energy barrier that absorbs incoming damage before structures take hits. The defensive cornerstone of any fortified colony.',
    cost: { metal: 500, gas: 350 },
    baseBuildTimeSeconds: 150,
    attack: 0,
    defense: 120,
    prerequisites: [
      { kind: 'building', buildingId: 'headquarters', level: 5 },
      { kind: 'building', buildingId: 'research_lab', level: 3 },
    ],
    image: shieldGeneratorImg,
  },
  {
    id: 'orbital_platform',
    name: 'Orbital Platform',
    description: 'A weapons platform in low orbit. The ultimate planetary defense — expensive to build and maintain but unmatched in firepower.',
    cost: { metal: 800, gas: 500 },
    baseBuildTimeSeconds: 200,
    attack: 180,
    defense: 100,
    prerequisites: [
      { kind: 'building', buildingId: 'headquarters', level: 7 },
      { kind: 'defense', defenseType: 'ion_cannon', count: 5 },
    ],
    image: orbitalPlatformImg,
  },
]

export function getDefenseConfig(id: string): DefenseConfig {
  const cfg = DEFENSES.find((d) => d.id === id)
  if (!cfg) throw new Error(`Unknown defense type: ${id}`)
  return cfg
}

export const DEFENSE_IDS = new Set(DEFENSES.map((d) => d.id))
