import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameState, Enemy, DeckOffer, DeckType } from '../types';
import { playSound } from '../audio';
import { getEnemySpriteUrl, getEnemySpriteHeight } from '../enemySprites';

interface World3DProps {
  gameState: GameState;
  onEncounter: (enemy: Enemy) => void;
  onLevelComplete: () => void;
  onOpenInventory: () => void;
  onDeckPickup: (offer: DeckOffer) => void;
}

interface Enemy3D {
  enemy: Enemy;
  mesh: THREE.Sprite;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  position: THREE.Vector3;
  triggerRadius: number;
}

interface DeckPickup3D {
  id: string;
  offer: DeckOffer;
  position: THREE.Vector3;
  triggerRadius: number;
}

// Matches the vertex displacement applied to the terrain plane below - kept
// as one function so the visual mesh and gameplay height sampling can never
// drift apart.
function getTerrainHeight(worldX: number, worldZ: number): number {
  return Math.sin(worldX * 0.1) * 2 + Math.cos(worldZ * 0.1) * 2;
}

const WORLD_HALF = 155;
const LEVEL_COMPLETE_Z = -145;

// Each boss's display name embeds one of the archetype substrings from
// enemySprites.ts/Icons.tsx, so it automatically gets that creature's combat
// portrait and world sprite without needing separate boss-specific art.
const BOSS_NAMES = [
  'The Ashen Dark Knight',
  'Voidspawn Shadow Beast',
  'Grimjaw the Orc Titan',
  'The Phantom Bandit King',
];

const BOSS_CORNERS = [
  { x: 130, z: 130 },
  { x: -130, z: 130 },
  { x: 130, z: -130 },
  { x: -130, z: -130 },
];

export const World3D: React.FC<World3DProps> = ({
  gameState,
  onEncounter,
  onLevelComplete,
  onOpenInventory,
  onDeckPickup,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef(new THREE.Vector3(0, 0, 0));
  const keysRef = useRef<Record<string, boolean>>({});
  const enemiesRef = useRef<Enemy3D[]>([]);
  const deckPickupsRef = useRef<DeckPickup3D[]>([]);
  const hasEncounteredRef = useRef<Set<string>>(new Set());
  const hasCollectedDeckRef = useRef<Set<string>>(new Set());
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 120, 480);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Yaw applied around world Y first, then pitch around the camera's own
    // X axis - this ordering can never introduce roll, unlike camera.lookAt()
    // which rebuilds a full basis via cross products with world-up each call
    // and starts to twist as pitch grows (that was the "weird rolling").
    camera.rotation.order = 'YXZ';
    cameraRef.current = camera;
    // The camera must be part of the scene graph for its child objects
    // (the held card-pack viewmodel) to be picked up by the render traversal.
    scene.add(camera);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(80, 80, 80);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 400;
    directionalLight.shadow.camera.left = -170;
    directionalLight.shadow.camera.right = 170;
    directionalLight.shadow.camera.top = 170;
    directionalLight.shadow.camera.bottom = -170;
    scene.add(directionalLight);

    // Terrain
    const terrainGeometry = new THREE.PlaneGeometry(320, 320, 96, 96);
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5f0b,
      roughness: 0.8,
      metalness: 0.2,
    });

    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.castShadow = true;
    terrain.receiveShadow = true;

    const positions = terrainGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      // Local (x, y) maps to world (x, z) once rotated flat - see
      // getTerrainHeight for the shared height formula.
      positions[i + 2] = getTerrainHeight(positions[i], -positions[i + 1]);
    }
    terrainGeometry.computeVertexNormals();

    scene.add(terrain);

    // Sky
    const skyGeometry = new THREE.SphereGeometry(650, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x2c3e50,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Reset per-run state so a re-run of this effect (or a fresh mount)
    // never inherits stale position/enemies from a previous run.
    playerRef.current.set(0, getTerrainHeight(0, 0), 0);
    enemiesRef.current = [];
    deckPickupsRef.current = [];
    hasEncounteredRef.current = new Set();
    hasCollectedDeckRef.current = new Set();

    // Enemy spawning - each enemy is a camera-facing sprite using the exact
    // same portrait art shown in combat, so what you meet in the field is
    // recognizably the thing you're about to fight.
    const textureLoader = new THREE.TextureLoader();

    const spawnEnemyAt = (
      spawn: { x: number; z: number },
      enemy: Enemy,
      opts: { spriteHeight: number; ringRadius: number; ringColor: number; lightIntensity: number }
    ) => {
      const groundY = getTerrainHeight(spawn.x, spawn.z);

      const texture = textureLoader.load(getEnemySpriteUrl(enemy.name));
      texture.colorSpace = THREE.SRGBColorSpace;
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const enemySprite = new THREE.Sprite(spriteMaterial);
      enemySprite.scale.set(opts.spriteHeight, opts.spriteHeight, 1);
      enemySprite.position.set(spawn.x, groundY + opts.spriteHeight / 2, spawn.z);
      scene.add(enemySprite);

      // Detection radius visualization (torus ring on ground)
      const radiusGeometry = new THREE.TorusGeometry(opts.ringRadius, 0.3, 8, 32);
      const radiusMaterial = new THREE.MeshStandardMaterial({
        color: opts.ringColor,
        emissive: opts.ringColor,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.3,
      });
      const radiusMesh = new THREE.Mesh(radiusGeometry, radiusMaterial);
      radiusMesh.rotation.x = -Math.PI / 2;
      radiusMesh.position.set(spawn.x, groundY + 0.05, spawn.z);
      radiusMesh.receiveShadow = false;
      scene.add(radiusMesh);

      // Point light above enemy for visibility
      const pointLight = new THREE.PointLight(opts.ringColor, opts.lightIntensity, opts.ringRadius * 2.5);
      pointLight.position.set(spawn.x, groundY + 4, spawn.z);
      scene.add(pointLight);

      enemiesRef.current.push({
        enemy,
        mesh: enemySprite,
        ring: radiusMesh,
        light: pointLight,
        position: new THREE.Vector3(spawn.x, groundY, spawn.z),
        triggerRadius: opts.ringRadius,
      });
    };

    const spawnEnemies = () => {
      const levelDifficulty = gameState.currentLevel;

      const enemySpawns = [
        { x: -55, z: -55 },
        { x: 55, z: -90 },
        { x: -90, z: 35 },
        { x: 90, z: 55 },
        { x: 0, z: -140 },
        { x: -110, z: 110 },
        { x: 110, z: 90 },
        { x: 35, z: 140 },
      ];

      const enemyNames = ['Goblin Scout', 'Orc Raider', 'Bandit', 'Dark Knight', 'Shadow Beast'];

      enemySpawns.forEach((spawn, idx) => {
        const enemyLevel = levelDifficulty + Math.floor(Math.random() * 2);
        const hp = 25 + enemyLevel * 5 + Math.random() * 20;
        const damage = 6 + enemyLevel * 1.5 + Math.random() * 4;
        const name = enemyNames[idx % enemyNames.length];

        const enemy: Enemy = {
          id: `enemy-${gameState.currentLevel}-${idx}`,
          name,
          level: enemyLevel,
          maxHP: Math.floor(hp),
          hp: Math.floor(hp),
          nextIntentDamage: Math.floor(damage),
          defeatReward: 20 * enemyLevel,
        };

        spawnEnemyAt(spawn, enemy, {
          spriteHeight: getEnemySpriteHeight(name),
          ringRadius: 10,
          ringColor: 0xff4444,
          lightIntensity: 0.5,
        });
      });
    };

    spawnEnemies();

    // Boss lair: a huge, guaranteed encounter in a deliberately ominous
    // corner of the map. Its stats and its lair's location both key off
    // bossTier, so defeating one visibly "upgrades" the world - the next
    // boss is tougher and waits somewhere new.
    const spawnBoss = () => {
      const bossIndex = gameState.bossTier % BOSS_NAMES.length;
      const bossName = BOSS_NAMES[bossIndex];
      const corner = BOSS_CORNERS[bossIndex];
      const bossLevelBasis = gameState.currentLevel + gameState.bossTier;

      const hp = Math.floor((60 + bossLevelBasis * 20) * 3);
      const damage = Math.floor((10 + bossLevelBasis * 3) * 2.5);

      const boss: Enemy = {
        id: `boss-${gameState.bossTier}`,
        name: bossName,
        level: bossLevelBasis + 5,
        maxHP: hp,
        hp,
        nextIntentDamage: damage,
        defeatReward: 150 * (bossLevelBasis + 1),
        isBoss: true,
      };

      const groundY = getTerrainHeight(corner.x, corner.z);

      // Ominous ground: a scorched dark disc under the boss...
      const scorchGeometry = new THREE.CircleGeometry(16, 32);
      const scorchMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a0505,
        roughness: 1,
        emissive: 0x330000,
        emissiveIntensity: 0.4,
      });
      const scorchMesh = new THREE.Mesh(scorchGeometry, scorchMaterial);
      scorchMesh.rotation.x = -Math.PI / 2;
      scorchMesh.position.set(corner.x, groundY + 0.03, corner.z);
      scene.add(scorchMesh);

      // ...ringed with jagged dark spikes...
      const spikeGeometry = new THREE.ConeGeometry(0.6, 4, 5);
      const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0x100505, roughness: 0.9 });
      const spikeCount = 14;
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const radius = 15 + Math.sin(i * 3) * 2;
        const sx = corner.x + Math.cos(angle) * radius;
        const sz = corner.z + Math.sin(angle) * radius;
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
        spike.position.set(sx, getTerrainHeight(sx, sz) + 2, sz);
        spike.rotation.z = (Math.random() - 0.5) * 0.4;
        spike.rotation.x = (Math.random() - 0.5) * 0.4;
        scene.add(spike);
      }

      // ...and heavy red haze hanging over the whole lair.
      const hazeLight1 = new THREE.PointLight(0xff2222, 1.2, 60);
      hazeLight1.position.set(corner.x, groundY + 10, corner.z);
      scene.add(hazeLight1);
      const hazeLight2 = new THREE.PointLight(0x880000, 0.8, 40);
      hazeLight2.position.set(corner.x, groundY + 2, corner.z);
      scene.add(hazeLight2);

      spawnEnemyAt(corner, boss, {
        spriteHeight: 12,
        ringRadius: 15,
        ringColor: 0xff1111,
        lightIntensity: 1,
      });
    };

    spawnBoss();

    // Decorative trees and bushes, scattered with InstancedMesh so a couple
    // hundred of them cost almost nothing to render. Trees block movement
    // (see treeColliders, checked in the animation loop); bushes stay purely
    // visual since they're low enough to walk through.
    const scatterPoint = () => ({
      x: (Math.random() * 2 - 1) * (WORLD_HALF - 10),
      z: (Math.random() * 2 - 1) * (WORLD_HALF - 10),
    });

    // Empowered deck pickups: a small glowing stack of cards, color-themed
    // per deck type, that offers a swap when walked into.
    const deckTypeColors: Record<DeckType, number> = {
      offensive: 0xff4444,
      defensive: 0x4488ff,
      balanced: 0xffaa33,
    };
    const deckTypes: DeckType[] = ['offensive', 'defensive', 'balanced'];
    const pickupVisuals: { group: THREE.Group; ring: THREE.Mesh; light: THREE.PointLight; baseY: number }[] = [];

    const DECK_PICKUP_COUNT = 4;
    for (let i = 0; i < DECK_PICKUP_COUNT; i++) {
      const { x, z } = scatterPoint();
      const groundY = getTerrainHeight(x, z);
      const deckType = deckTypes[Math.floor(Math.random() * deckTypes.length)];
      const empoweredCount = 1 + Math.floor(Math.random() * 52);
      const color = deckTypeColors[deckType];

      const pickupGroup = new THREE.Group();
      pickupGroup.position.set(x, groundY + 1.2, z);
      const cardMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.4,
      });
      for (let c = 0; c < 5; c++) {
        const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.3), cardMaterial);
        cardMesh.position.set(0, c * 0.1, 0);
        cardMesh.rotation.y = c * 0.15;
        pickupGroup.add(cardMesh);
      }
      scene.add(pickupGroup);

      const sparkleRing = new THREE.Mesh(
        new THREE.TorusGeometry(3, 0.15, 8, 32),
        new THREE.MeshStandardMaterial({
          color: 0xffe066,
          emissive: 0xffe066,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.5,
        })
      );
      sparkleRing.rotation.x = -Math.PI / 2;
      sparkleRing.position.set(x, groundY + 0.1, z);
      scene.add(sparkleRing);

      const pickupLight = new THREE.PointLight(color, 0.8, 15);
      pickupLight.position.set(x, groundY + 2, z);
      scene.add(pickupLight);

      pickupVisuals.push({ group: pickupGroup, ring: sparkleRing, light: pickupLight, baseY: groundY });

      deckPickupsRef.current.push({
        id: `deck-pickup-${gameState.currentLevel}-${i}`,
        offer: { deckType, empoweredCount },
        position: new THREE.Vector3(x, groundY, z),
        triggerRadius: 4,
      });
    }

    const treeColliders: { x: number; z: number; radius: number }[] = [];

    const TREE_COUNT = 150;
    const dummy = new THREE.Object3D();

    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.4, 0.5, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c4433, roughness: 0.9 }),
      TREE_COUNT
    );
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    const foliageMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.2, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d5a1f, roughness: 0.8 }),
      TREE_COUNT
    );
    foliageMesh.castShadow = true;

    for (let i = 0; i < TREE_COUNT; i++) {
      const { x, z } = scatterPoint();
      const groundY = getTerrainHeight(x, z);
      const scale = 0.8 + Math.random() * 0.6;
      const rotY = Math.random() * Math.PI * 2;

      treeColliders.push({ x, z, radius: 1.3 * scale });

      dummy.position.set(x, groundY + 1.5 * scale, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, groundY + 3.8 * scale, z);
      dummy.updateMatrix();
      foliageMesh.setMatrixAt(i, dummy.matrix);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    foliageMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh);
    scene.add(foliageMesh);

    const BUSH_COUNT = 100;
    const bushMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.9, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x3d6b28, roughness: 0.9 }),
      BUSH_COUNT
    );
    bushMesh.castShadow = true;
    bushMesh.receiveShadow = true;

    for (let i = 0; i < BUSH_COUNT; i++) {
      const { x, z } = scatterPoint();
      const groundY = getTerrainHeight(x, z);
      const scale = 0.7 + Math.random() * 0.8;

      dummy.position.set(x, groundY + 0.5 * scale, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scale, scale * 0.7, scale);
      dummy.updateMatrix();
      bushMesh.setMatrixAt(i, dummy.matrix);
    }
    bushMesh.instanceMatrix.needsUpdate = true;
    scene.add(bushMesh);

    // Held card-pack viewmodel: a right hand + a small stack of cards,
    // parented to the camera so it stays in view regardless of look angle.
    const handGroup = new THREE.Group();
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8), skinMaterial);
    forearm.rotation.z = Math.PI / 2.3;
    forearm.position.set(0.12, -0.18, 0.15);
    handGroup.add(forearm);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), skinMaterial);
    palm.position.set(0.38, -0.3, -0.12);
    palm.rotation.y = -0.3;
    handGroup.add(palm);

    const cardBackMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2d2d, roughness: 0.5 });
    const cardFaceMaterial = new THREE.MeshStandardMaterial({ color: 0xe0d0b0, roughness: 0.7 });
    const cardMeshes: THREE.Mesh[] = [];
    const CARD_BASE_X = 0.38;
    const cardBaseY = Array.from({ length: 6 }, (_, i) => -0.25 + i * 0.014);
    const cardBaseZ = Array.from({ length: 6 }, (_, i) => -0.1 + i * 0.004);
    const cardBaseRotY = Array.from({ length: 6 }, (_, i) => -0.3 + i * 0.02);
    for (let i = 0; i < 6; i++) {
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.012, 0.22),
        i === 5 ? cardBackMaterial : cardFaceMaterial
      );
      card.position.set(CARD_BASE_X, cardBaseY[i], cardBaseZ[i]);
      card.rotation.y = cardBaseRotY[i];
      handGroup.add(card);
      cardMeshes.push(card);
    }

    const resetCards = () => {
      cardMeshes.forEach((card, i) => {
        card.position.set(CARD_BASE_X, cardBaseY[i], cardBaseZ[i]);
        card.rotation.set(0, cardBaseRotY[i], 0);
      });
    };

    handGroup.position.set(0.5, -0.45, -0.9);
    handGroup.rotation.x = 0.15;
    camera.add(handGroup);

    // Jump: a simple velocity/gravity offset layered on top of the terrain
    // height, purely visual (camera bounces) - it never touches playerRef's
    // x/z or the horizontal encounter/collision checks.
    const JUMP_SPEED = 0.55;
    const GRAVITY = 0.03;
    let jumpVelocity = 0;
    let groundOffset = 0;

    // WASD Controls (Tab opens the inventory, matching the usual convention;
    // Space jumps)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onOpenInventory();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (groundOffset <= 0) {
          jumpVelocity = JUMP_SPEED;
        }
        return;
      }
      keysRef.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Mouse-look via the Pointer Lock API: click the canvas to engage,
    // Escape (browser default) releases it. Raw mouse deltas accumulate into
    // target angles instantly (so input never feels laggy); the camera then
    // eases toward those targets each frame, which is what actually smooths
    // the motion out and tames how twitchy a fast mouse flick feels.
    let targetYaw = 0;
    let targetPitch = 0.35;
    let yaw = 0;
    let pitch = 0.35;
    const MOUSE_SENSITIVITY = 0.0015;
    const LOOK_SMOOTHING = 0.15;
    const MIN_PITCH = -0.9;
    const MAX_PITCH = 1.2;

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      targetYaw += e.movementX * MOUSE_SENSITIVITY;
      targetPitch -= e.movementY * MOUSE_SENSITIVITY;
      targetPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, targetPitch));
    };

    // Card tricks: left click performs one, chosen at random. First click
    // just engages mouse-look (matches the existing pointer-lock gesture);
    // once locked, every click is free to trigger a trick instead.
    type TrickType = 'fan' | 'spin' | 'toss';
    const TRICK_DURATION: Record<TrickType, number> = { fan: 1.0, spin: 1.1, toss: 1.3 };
    let activeTrick: TrickType | null = null;
    let trickProgress = 0;

    const handleCanvasClick = () => {
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }
      if (!activeTrick) {
        const tricks: TrickType[] = ['fan', 'spin', 'toss'];
        activeTrick = tricks[Math.floor(Math.random() * tricks.length)];
        trickProgress = 0;
        playSound('card');
      }
    };

    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Guards so this effect instance can only ever trigger ONE transition
    // (encounter or level-complete) and stops driving the loop once it has -
    // without these, a leaked rAF loop kept re-firing the callback every
    // frame after the transition, which read as an infinite fight<->world loop.
    let isActive = true;
    let hasTransitioned = false;
    let animationFrameId = 0;
    let footstepDistance = 0;
    let bobPhase = 0;
    let handBob = 0;
    let headBob = 0;

    // Animation loop
    const animate = () => {
      if (!isActive || hasTransitioned) return;
      animationFrameId = requestAnimationFrame(animate);

      const isSprinting = !!keysRef.current['shift'];
      const moveSpeed = isSprinting ? 0.55 : 0.3;

      // Ease the look angles toward the raw mouse target each frame - this
      // is what actually smooths the camera; the raw deltas above stay
      // instant so input doesn't feel delayed.
      yaw += (targetYaw - yaw) * LOOK_SMOOTHING;
      pitch += (targetPitch - pitch) * LOOK_SMOOTHING;

      // Movement is relative to yaw only (horizontal), so mouse-look and
      // WASD work together like a normal third-person controller and
      // looking up/down doesn't change walk speed.
      const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const moveDir = new THREE.Vector3();

      if (keysRef.current['w']) moveDir.add(forward);
      if (keysRef.current['s']) moveDir.sub(forward);
      if (keysRef.current['a']) moveDir.sub(right);
      if (keysRef.current['d']) moveDir.add(right);

      const isMoving = moveDir.lengthSq() > 0;
      if (isMoving) {
        moveDir.normalize().multiplyScalar(moveSpeed);
        let newX = playerRef.current.x + moveDir.x;
        let newZ = playerRef.current.z + moveDir.z;

        // Trees block movement: push back out to the edge of any trunk
        // we'd otherwise walk into.
        for (const tree of treeColliders) {
          const tdx = newX - tree.x;
          const tdz = newZ - tree.z;
          const distSq = tdx * tdx + tdz * tdz;
          if (distSq < tree.radius * tree.radius) {
            const dist = Math.sqrt(distSq) || 0.001;
            newX = tree.x + (tdx / dist) * tree.radius;
            newZ = tree.z + (tdz / dist) * tree.radius;
          }
        }

        playerRef.current.x = newX;
        playerRef.current.z = newZ;

        // Constrain player within world bounds
        playerRef.current.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, playerRef.current.x));
        playerRef.current.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, playerRef.current.z));

        footstepDistance += moveSpeed;
        if (footstepDistance > 4) {
          footstepDistance = 0;
          playSound('footstep');
        }

        bobPhase += isSprinting ? 0.22 : 0.15;
      }

      // Follow the terrain: feet sit at ground height under the player.
      playerRef.current.y = getTerrainHeight(playerRef.current.x, playerRef.current.z);

      // Jump arc: gravity pulls the offset back down to the terrain.
      groundOffset += jumpVelocity;
      jumpVelocity -= GRAVITY;
      if (groundOffset <= 0) {
        groundOffset = 0;
        jumpVelocity = 0;
      }

      // Bob the hand and head with the walk cycle, easing back to rest when
      // the player stops instead of snapping.
      const targetBob = isMoving ? Math.sin(bobPhase) : 0;
      handBob += (targetBob - handBob) * 0.25;
      headBob += (targetBob - headBob) * 0.25;
      handGroup.position.y = -0.45 + handBob * 0.03;

      // True look-direction camera: pitch tilts the view itself (not just
      // camera height), which is what makes "look up" actually look up.
      const lookDir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      );

      // The pivot is the player's head - the camera orbits it at a fixed
      // radius along lookDir with no extra offset, so pitch swings the
      // camera around the head rather than sliding it up/down separately.
      const eyeHeight = 1.8 + headBob * 0.06 + groundOffset;
      const headPos = new THREE.Vector3(
        playerRef.current.x,
        playerRef.current.y + eyeHeight,
        playerRef.current.z
      );

      const orbitDistance = 6;
      const desiredCamPos = headPos.clone().addScaledVector(lookDir, -orbitDistance);
      camera.position.lerp(desiredCamPos, 0.12);

      // Orientation is set directly from yaw/pitch (not camera.lookAt, which
      // rebuilds its basis from world-up each call and rolls as pitch grows)
      // - negated yaw here matches Three's YXZ composition to this file's
      // yaw/lookDir sign convention used for movement.
      camera.rotation.set(pitch, -yaw, 0);

      // Card trick playback, triggered by clicking (see handleCanvasClick).
      if (activeTrick) {
        trickProgress += (1 / 60) / TRICK_DURATION[activeTrick];
        const p = Math.min(trickProgress, 1);

        if (activeTrick === 'fan') {
          const fanAmount = Math.sin(p * Math.PI);
          cardMeshes.forEach((card, i) => {
            const spread = i - (cardMeshes.length - 1) / 2;
            card.position.set(CARD_BASE_X + spread * 0.035 * fanAmount, cardBaseY[i], cardBaseZ[i]);
            card.rotation.set(0, cardBaseRotY[i], spread * 0.18 * fanAmount);
          });
        } else if (activeTrick === 'spin') {
          // A ripple of full spins runs down the stack, one card after another.
          cardMeshes.forEach((card, i) => {
            const ripple = Math.max(0, Math.min(1, p * 1.6 - i * 0.12));
            card.position.set(CARD_BASE_X, cardBaseY[i], cardBaseZ[i]);
            card.rotation.set(0, cardBaseRotY[i] + ripple * Math.PI * 4, 0);
          });
        } else {
          // Toss and catch: each card launches in sequence, arcs up in a fast
          // spin, and lands back in the stack - the "super extreme" one.
          const STAGGER = 0.12;
          const FLIGHT = 0.35;
          cardMeshes.forEach((card, i) => {
            const cardP = Math.max(0, Math.min(1, (p - i * STAGGER) / FLIGHT));
            const arc = Math.sin(cardP * Math.PI);
            card.position.set(
              CARD_BASE_X,
              cardBaseY[i] + arc * 0.4,
              cardBaseZ[i] - arc * 0.3
            );
            card.rotation.set(cardP * Math.PI * 6, cardBaseRotY[i] + cardP * Math.PI * 2, cardP * Math.PI * 8);
          });
        }

        if (p >= 1) {
          activeTrick = null;
          resetCards();
        }
      }

      // Check for collisions with enemies (horizontal distance only, so
      // hills near an enemy don't affect the trigger radius). Enemies within
      // aggro range but outside the trigger radius actively close the gap so
      // they can't just be strafed past - sprinting is the way out.
      for (const e3d of enemiesRef.current) {
        if (hasEncounteredRef.current.has(e3d.enemy.id)) continue;

        const dx = playerRef.current.x - e3d.position.x;
        const dz = playerRef.current.z - e3d.position.z;
        const distance = Math.hypot(dx, dz);

        if (distance < e3d.triggerRadius) {
          hasEncounteredRef.current.add(e3d.enemy.id);
          hasTransitioned = true;
          onEncounter(e3d.enemy);
          return;
        }

        const aggroRadius = e3d.enemy.isBoss ? 40 : 25;
        if (distance < aggroRadius) {
          const chaseSpeed = e3d.enemy.isBoss ? 0.22 : 0.16;
          e3d.position.x += (dx / distance) * chaseSpeed;
          e3d.position.z += (dz / distance) * chaseSpeed;
          e3d.position.y = getTerrainHeight(e3d.position.x, e3d.position.z);

          const halfHeight = e3d.mesh.scale.y / 2;
          e3d.mesh.position.set(e3d.position.x, e3d.position.y + halfHeight, e3d.position.z);
          e3d.ring.position.set(e3d.position.x, e3d.position.y + 0.05, e3d.position.z);
          e3d.light.position.set(e3d.position.x, e3d.position.y + 4, e3d.position.z);
        }
      }

      // Bob/spin the deck pickups and check if the player walked into one.
      const nowMs = performance.now();
      pickupVisuals.forEach((p, i) => {
        const phase = nowMs * 0.001 + i;
        p.group.position.y = p.baseY + 1.2 + Math.sin(phase * 1.5) * 0.2;
        p.group.rotation.y += 0.01;
        p.ring.rotation.z += 0.005;
        p.light.intensity = 0.6 + Math.sin(phase * 2) * 0.3;
      });

      for (const pickup of deckPickupsRef.current) {
        if (hasCollectedDeckRef.current.has(pickup.id)) continue;

        const dx = playerRef.current.x - pickup.position.x;
        const dz = playerRef.current.z - pickup.position.z;
        if (Math.hypot(dx, dz) < pickup.triggerRadius) {
          hasCollectedDeckRef.current.add(pickup.id);
          hasTransitioned = true;
          onDeckPickup(pickup.offer);
          return;
        }
      }

      // Check level completion
      if (playerRef.current.z < LEVEL_COMPLETE_Z) {
        hasTransitioned = true;
        onLevelComplete();
        return;
      }

      renderer.render(scene, camera);
    };

    // Place the camera at its correct orbit position immediately - without
    // this, it defaults to (0,0,0) and only lerps toward the real position
    // over the first several frames, rendering below the terrain surface
    // (which sits above y=0) until it catches up.
    const initialLookDir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    const initialHeadPos = new THREE.Vector3(
      playerRef.current.x,
      playerRef.current.y + 1.8,
      playerRef.current.z
    );
    camera.position.copy(initialHeadPos.addScaledVector(initialLookDir, -6));
    camera.rotation.set(pitch, -yaw, 0);

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isActive = false;
      cancelAnimationFrame(animationFrameId);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [gameState.currentLevel, gameState.bossTier, onEncounter, onLevelComplete, onDeckPickup]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(26, 26, 46, 0.9)',
          border: '2px solid #ff6b9d',
          borderRadius: '8px',
          padding: '1rem',
          color: '#e0e0e0',
          fontFamily: 'monospace',
          maxWidth: '300px',
        }}
      >
        <div style={{ marginBottom: '0.8rem' }}>
          <strong style={{ color: '#ff6b9d' }}>Level {gameState.currentLevel}</strong>
        </div>
        <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
          <div>❤️ HP: {gameState.player.hp}/{gameState.player.maxHP}</div>
          <div>💰 Gold: {gameState.player.gold}</div>
          <div>🪙 Coins: {gameState.player.coins}</div>
          <div>📊 Level: {gameState.player.level}</div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'rgba(26, 26, 46, 0.9)',
          border: '2px solid #6ba3ff',
          borderRadius: '8px',
          padding: '1rem',
          color: '#e0e0e0',
          fontFamily: 'monospace',
          maxWidth: '250px',
        }}
      >
        <div style={{ marginBottom: '0.8rem', fontWeight: 'bold' }}>Controls</div>
        <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
          <div>W / A / S / D - Move</div>
          <div>Shift - Sprint</div>
          <div>Space - Jump</div>
          <div>Mouse - Look around</div>
          <div>Click - Look around / card trick</div>
          <div>Tab - Inventory</div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          gap: '1rem',
        }}
      >
        <button
          onClick={onOpenInventory}
          style={{
            background: '#6ba3ff',
            color: 'white',
            border: 'none',
            padding: '0.8rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Inventory
        </button>
      </div>

      {!isPointerLocked && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(26, 26, 46, 0.85)',
            border: '2px solid #ff6b9d',
            borderRadius: '8px',
            padding: '1rem 1.5rem',
            color: '#e0e0e0',
            textAlign: 'center',
            fontSize: '1rem',
            pointerEvents: 'none',
          }}
        >
          Click to look around
        </div>
      )}
    </div>
  );
};
