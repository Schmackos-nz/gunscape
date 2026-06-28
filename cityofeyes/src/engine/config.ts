// Central tuning knobs. The camera is the soul of this game, so most of these
// live here so we can iterate on "feel" without spelunking through systems.

export const CONFIG = {
  world: {
    half: 170, // half-extent of the whole map (town + surrounding farmland)
    townHalf: 75, // buildings only within this central radius; beyond it is rural
    blockSize: 24, // building block footprint
    streetWidth: 18, // full gap between building rows
    roadWidth: 9, // asphalt carriageway (narrower than the gap, leaving pavement)
    shopCount: 7, // buildings turned into enterable shops
  },

  player: {
    walkSpeed: 5.5,
    sprintSpeed: 9.5,
    radius: 0.45,
    height: 1.8,
    turnSpeed: 2.9, // radians/sec the avatar turns with A/D (tank-style)
    energyMax: 100,
    sprintDrain: 20, // energy/sec while sprinting
    energyRegen: 14, // energy/sec while not sprinting
    buffDrainMul: 0.35, // energy-drink buff makes sprinting cost much less
  },

  farm: {
    plots: 14,
    cropsPerPlot: 18,
    farmers: 10,
    witnessRange: 26, // a farmer this close (with line of sight) reports the theft
    interactRange: 2.6,
  },

  crowd: {
    count: 70,
    walkSpeed: 1.6,
    eyeHeight: 1.66,
    eyeForwardOffset: 0.42, // push the lens just past the face
    arriveRadius: 1.2,
    // how far from a road centreline the pavement sits (cars drive nearer the
    // middle, pedestrians hug the curb)
    sidewalkOffset: 6.5, // sits beyond the asphalt edge, on the pavement
    sidewalkSpread: 1.3, // per-ped jitter across the pavement width
    bodyRadius: 0.36, // collision radius for shoving
    health: 60,
    aggroToFight: 1.4, // sustained-contact aggression that can spark a brawl
  },

  traffic: {
    count: 22,
    speed: 11,
    speedVariance: 4,
    laneOffset: 2.2, // distance from road centreline to a lane (right-hand)
    hitDamage: 34, // damage to the player on a car strike
    panicTime: 6, // seconds vehicles speed away after a gunshot
  },

  drones: {
    count: 5, // roaming camera drones — a close lens when no person/CCTV can see you
    orbitSpeed: 0.45,
    radius: 17,
    height: 8.5,
  },

  combat: {
    bulletDamage: 35,
    moneyMin: 15,
    moneyMax: 80,
  },

  wanted: {
    perCivilianKill: 1,
    perCopKill: 2,
    max: 5,
    decayDelay: 9, // seconds crime-free before the level starts dropping
    decayRate: 0.06, // stars/sec
    policePerStar: 1.4, // officers on the street scale with the level
  },

  police: {
    speed: 5.2,
    health: 90,
    shootRange: 24,
    shootCooldown: 1.2,
    damage: 11,
    spawnDist: 64, // spawn this far from the player, then close in
    arrestRange: 2.2,
  },

  spectator: {
    // distance scoring: peak comfort zone for framing the player
    minRange: 4,
    sweetSpotNear: 7,
    sweetSpotFar: 22,
    maxRange: 75, // generous so wall-mounted CCTV across the plaza still qualify
    // how much the *current* lens resists being replaced (anti-twitch)
    stickyBonus: 0.22,
    // a candidate must beat the active lens by this much to steal the shot
    handoffHysteresis: 0.08,
    // below this best-score, we drop to the "unobserved" fallback cam
    unobservedFloor: 0.12,
    // re-evaluate the active lens this often (seconds)
    evalInterval: 0.25,
    // squared world-distance between two eyes above which a handoff is a hard
    // CUT (with black flash) instead of a smooth ease
    cutDistanceSq: 14 * 14,
    easeTime: 0.45,
  },

  attention: {
    sightRange: 30, // how far a ped can witness an alarming act
    brandishGain: 0.6, // alarm/sec added to peds that see you brandishing
    fireGain: 2.5, // instant alarm spike to all who see a gunshot
    calmDecay: 0.25, // alarm/sec bled off when a ped can't see you
    witnessThreshold: 0.5, // alarm above this = active witness
    panicThreshold: 0.85,
    // heat (manhunt) follows witness count
    heatPerWitness: 0.18,
    heatDecay: 0.12, // per second when unwitnessed
    fleeSpeed: 4.2,
  },
} as const;
