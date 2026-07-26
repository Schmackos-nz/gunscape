import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameState, Enemy } from '../types';

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
    camera.position.set(0, 3, 0);
    cameraRef.current = camera;

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
      positions[i + 2] = Math.sin(positions[i] * 0.1) * 2 + Math.cos(positions[i + 1] * 0.1) * 2;
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
    playerRef.current.set(0, 0, 0);
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

        const enemyMaterial = new THREE.MeshStandardMaterial({
          color: appearance.color,
          roughness: 0.5,
          emissive: appearance.emissive,
          emissiveIntensity: 0.6,
        });
        const enemyMesh = new THREE.Mesh(appearance.geometry, enemyMaterial);
        enemyMesh.position.set(spawn.x, appearance.height, spawn.z);
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
        radiusMesh.position.set(spawn.x, 0.05, spawn.z);
        radiusMesh.receiveShadow = false;
        scene.add(radiusMesh);

        // Add point light above enemy for visibility
        const pointLight = new THREE.PointLight(0xff4444, 0.5, 25);
        pointLight.position.set(spawn.x, 4, spawn.z);
        scene.add(pointLight);

        enemiesRef.current.push({
          enemy,
          mesh: enemyMesh,
          position: new THREE.Vector3(spawn.x, 0, spawn.z),
        });
      });
    };

    spawnEnemies();

    // WASD Controls
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Guards so this effect instance can only ever trigger ONE transition
    // (encounter or level-complete) and stops driving the loop once it has -
    // without these, a leaked rAF loop kept re-firing the callback every
    // frame after the transition, which read as an infinite fight<->world loop.
    let isActive = true;
    let hasTransitioned = false;
    let animationFrameId = 0;

    // Animation loop
    const animate = () => {
      if (!isActive || hasTransitioned) return;
      animationFrameId = requestAnimationFrame(animate);

      const moveSpeed = 0.3;
      const direction = new THREE.Vector3();

      if (keysRef.current['w']) direction.z -= moveSpeed;
      if (keysRef.current['s']) direction.z += moveSpeed;
      if (keysRef.current['a']) direction.x -= moveSpeed;
      if (keysRef.current['d']) direction.x += moveSpeed;

      playerRef.current.add(direction);

      // Constrain player within world bounds
      playerRef.current.x = Math.max(-90, Math.min(90, playerRef.current.x));
      playerRef.current.z = Math.max(-90, Math.min(90, playerRef.current.z));

      // Camera follows player
      const cameraOffset = new THREE.Vector3(0, 3, 5);
      const cameraTarget = playerRef.current.clone().add(cameraOffset);
      camera.position.lerp(cameraTarget, 0.1);
      camera.lookAt(playerRef.current.x, 1, playerRef.current.z);

      // Check for collisions with enemies
      for (const e3d of enemiesRef.current) {
        const distance = playerRef.current.distanceTo(e3d.position);
        if (distance < 10 && !hasEncounteredRef.current.has(e3d.enemy.id)) {
          hasEncounteredRef.current.add(e3d.enemy.id);
          hasTransitioned = true;
          onEncounter(e3d.enemy);
          return;
        }

        // Make enemies face player
        const direction = playerRef.current.clone().sub(e3d.position);
        const angle = Math.atan2(direction.x, direction.z);
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
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
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
          <div>W - Forward</div>
          <div>S - Backward</div>
          <div>A - Strafe Left</div>
          <div>D - Strafe Right</div>
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
    </div>
  );
};
