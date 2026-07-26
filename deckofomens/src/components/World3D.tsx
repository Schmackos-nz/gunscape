import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameState, Enemy } from '../types';
import { playSound } from '../audio';

interface World3DProps {
  gameState: GameState;
  onEncounter: (enemy: Enemy) => void;
  onLevelComplete: () => void;
  onOpenInventory: () => void;
}

interface Enemy3D {
  enemy: Enemy;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
}

// Matches the vertex displacement applied to the terrain plane below - kept
// as one function so the visual mesh and gameplay height sampling can never
// drift apart.
function getTerrainHeight(worldX: number, worldZ: number): number {
  return Math.sin(worldX * 0.1) * 2 + Math.cos(worldZ * 0.1) * 2;
}

export const World3D: React.FC<World3DProps> = ({
  gameState,
  onEncounter,
  onLevelComplete,
  onOpenInventory,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef(new THREE.Vector3(0, 0, 0));
  const keysRef = useRef<Record<string, boolean>>({});
  const enemiesRef = useRef<Enemy3D[]>([]);
  const hasEncounteredRef = useRef<Set<string>>(new Set());
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 100, 300);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
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
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Terrain
    const terrainGeometry = new THREE.PlaneGeometry(200, 200, 64, 64);
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
    const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
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
    hasEncounteredRef.current = new Set();

    // Enemy spawning
    const spawnEnemies = () => {
      const levelDifficulty = gameState.currentLevel;

      const enemySpawns = [
        { x: -30, z: -30 },
        { x: 30, z: -50 },
        { x: -50, z: 20 },
        { x: 50, z: 30 },
        { x: 0, z: -80 },
        { x: -60, z: 60 },
        { x: 60, z: 50 },
        { x: 20, z: 80 },
      ];

      const enemyNames = ['Goblin Scout', 'Orc Raider', 'Bandit', 'Dark Knight', 'Shadow Beast'];

      enemySpawns.forEach((spawn, idx) => {
        const enemyLevel = levelDifficulty + Math.floor(Math.random() * 2);
        const hp = 25 + enemyLevel * 5 + Math.random() * 20;
        const damage = 6 + enemyLevel * 1.5 + Math.random() * 4;

        const enemy: Enemy = {
          id: `enemy-${gameState.currentLevel}-${idx}`,
          name: enemyNames[idx % enemyNames.length],
          level: enemyLevel,
          maxHP: Math.floor(hp),
          hp: Math.floor(hp),
          nextIntentDamage: Math.floor(damage),
          defeatReward: 20 * enemyLevel,
        };

        // Create enemy mesh styled to match its combat portrait
        const enemyAppearance: Record<string, { color: number; emissive: number; geometry: THREE.BufferGeometry; height: number }> = {
          'Goblin Scout': { color: 0x6b9d1a, emissive: 0x2a3d0a, geometry: new THREE.ConeGeometry(1.6, 3.2, 8), height: 1.6 },
          'Orc Raider': { color: 0x8b6d47, emissive: 0x3d2d1a, geometry: new THREE.ConeGeometry(2.2, 4.4, 8), height: 2.2 },
          Bandit: { color: 0x5a4a3a, emissive: 0x1a1a1a, geometry: new THREE.CylinderGeometry(1.6, 1.8, 4, 8), height: 2 },
          'Dark Knight': { color: 0x2a2a3a, emissive: 0x4a0a0a, geometry: new THREE.BoxGeometry(3, 5, 2), height: 2.5 },
          'Shadow Beast': { color: 0x3a1a4a, emissive: 0x6a1a8a, geometry: new THREE.SphereGeometry(2.4, 12, 12), height: 2.4 },
        };
        const appearance = enemyAppearance[enemy.name] ?? {
          color: 0xff4444,
          emissive: 0x4a0a0a,
          geometry: new THREE.ConeGeometry(2, 4, 8),
          height: 2,
        };

        const groundY = getTerrainHeight(spawn.x, spawn.z);

        const enemyMaterial = new THREE.MeshStandardMaterial({
          color: appearance.color,
          roughness: 0.5,
          emissive: appearance.emissive,
          emissiveIntensity: 0.6,
        });
        const enemyMesh = new THREE.Mesh(appearance.geometry, enemyMaterial);
        enemyMesh.position.set(spawn.x, groundY + appearance.height, spawn.z);
        enemyMesh.castShadow = true;
        enemyMesh.receiveShadow = true;
        scene.add(enemyMesh);

        // Add detection radius visualization (torus ring on ground)
        const radiusGeometry = new THREE.TorusGeometry(10, 0.3, 8, 32);
        const radiusMaterial = new THREE.MeshStandardMaterial({
          color: 0xff4444,
          emissive: 0xff4444,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.3,
        });
        const radiusMesh = new THREE.Mesh(radiusGeometry, radiusMaterial);
        radiusMesh.rotation.x = -Math.PI / 2;
        radiusMesh.position.set(spawn.x, groundY + 0.05, spawn.z);
        radiusMesh.receiveShadow = false;
        scene.add(radiusMesh);

        // Add point light above enemy for visibility
        const pointLight = new THREE.PointLight(0xff4444, 0.5, 25);
        pointLight.position.set(spawn.x, groundY + 4, spawn.z);
        scene.add(pointLight);

        enemiesRef.current.push({
          enemy,
          mesh: enemyMesh,
          position: new THREE.Vector3(spawn.x, groundY, spawn.z),
        });
      });
    };

    spawnEnemies();

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
    for (let i = 0; i < 6; i++) {
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.012, 0.22),
        i === 5 ? cardBackMaterial : cardFaceMaterial
      );
      card.position.set(0.38, -0.25 + i * 0.014, -0.1 + i * 0.004);
      card.rotation.y = -0.3 + i * 0.02;
      handGroup.add(card);
    }

    handGroup.position.set(0.5, -0.45, -0.9);
    handGroup.rotation.x = 0.15;
    camera.add(handGroup);

    // WASD Controls
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Mouse-look via the Pointer Lock API: click the canvas to engage,
    // Escape (browser default) releases it.
    let yaw = 0;
    let pitch = 0.35;
    const MOUSE_SENSITIVITY = 0.0025;
    const MIN_PITCH = -0.8;
    const MAX_PITCH = 1.1;

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * MOUSE_SENSITIVITY;
      pitch -= e.movementY * MOUSE_SENSITIVITY;
      pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));
    };

    const handleCanvasClick = () => {
      renderer.domElement.requestPointerLock();
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

    // Animation loop
    const animate = () => {
      if (!isActive || hasTransitioned) return;
      animationFrameId = requestAnimationFrame(animate);

      const moveSpeed = 0.3;

      // Movement is relative to the camera's yaw, so mouse-look and WASD
      // work together the way a third-person controller normally does.
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
        playerRef.current.x += moveDir.x;
        playerRef.current.z += moveDir.z;

        // Constrain player within world bounds
        playerRef.current.x = Math.max(-90, Math.min(90, playerRef.current.x));
        playerRef.current.z = Math.max(-90, Math.min(90, playerRef.current.z));

        footstepDistance += moveSpeed;
        if (footstepDistance > 4) {
          footstepDistance = 0;
          playSound('footstep');
        }

        bobPhase += 0.15;
        handGroup.position.y = -0.45 + Math.sin(bobPhase) * 0.03;
      } else {
        handGroup.position.y += (-0.45 - handGroup.position.y) * 0.2;
      }

      // Follow the terrain: feet sit at ground height under the player.
      playerRef.current.y = getTerrainHeight(playerRef.current.x, playerRef.current.z);

      // Orbit camera around the player, driven by mouse yaw/pitch.
      const eyeHeight = 1.8;
      const orbitDistance = 6;
      const horizDist = orbitDistance * Math.cos(pitch);
      const vertOffset = orbitDistance * Math.sin(pitch);

      const camTarget = new THREE.Vector3(
        playerRef.current.x - Math.sin(yaw) * horizDist,
        playerRef.current.y + eyeHeight + 1.5 + vertOffset,
        playerRef.current.z + Math.cos(yaw) * horizDist
      );
      camera.position.lerp(camTarget, 0.15);
      camera.lookAt(
        playerRef.current.x,
        playerRef.current.y + eyeHeight,
        playerRef.current.z
      );

      // Check for collisions with enemies (horizontal distance only, so
      // hills near an enemy don't affect the trigger radius)
      for (const e3d of enemiesRef.current) {
        const dx = playerRef.current.x - e3d.position.x;
        const dz = playerRef.current.z - e3d.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 10 && !hasEncounteredRef.current.has(e3d.enemy.id)) {
          hasEncounteredRef.current.add(e3d.enemy.id);
          hasTransitioned = true;
          onEncounter(e3d.enemy);
          return;
        }

        // Make enemies face player
        const angle = Math.atan2(dx, dz);
        e3d.mesh.rotation.y = angle;
      }

      // Check level completion
      if (playerRef.current.z < -85) {
        hasTransitioned = true;
        onLevelComplete();
        return;
      }

      renderer.render(scene, camera);
    };

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
  }, [gameState.currentLevel, onEncounter, onLevelComplete]);

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
          <div>Mouse - Look around</div>
          <div>Click view - Enable mouse look</div>
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
