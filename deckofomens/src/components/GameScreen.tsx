import React, { useEffect, useRef, useState } from 'react';
import { GameState, Card } from '../types';
import { HeartIcon, BoltIcon, ArmorIcon, SwordIcon, ShieldIcon, SparkleIcon, EnemySprite, PlayerSprite } from './Icons';
import { playerAttackRating, playerDefenseRating, applyMitigation } from '../combatMath';

interface GameScreenProps {
  gameState: GameState;
  onPlayCard: (card: Card) => void;
  onEndTurn: () => void;
  onVictory: () => void;
  onDefeat: () => void;
  onMenu: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  onPlayCard,
  onEndTurn,
  onVictory,
  onDefeat,
  onMenu,
}) => {
  const combat = gameState.combat;
  const [drawnCards, setDrawnCards] = useState<Set<string>>(new Set());
  const [showEnemyTaunt, setShowEnemyTaunt] = useState(true);
  const [showPlayerTaunt, setShowPlayerTaunt] = useState(false);
  const [damageHit, setDamageHit] = useState<{ amount: number; key: number } | null>(null);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const prevPlayerHPRef = useRef<number | undefined>(combat?.playerHP);

  // Whenever the enemy's attack lands (playerHP drops), show a big floating
  // damage number and lunge the enemy sprite forward.
  useEffect(() => {
    if (!combat) return;
    const prevHP = prevPlayerHPRef.current;
    let hitTimer: ReturnType<typeof setTimeout> | undefined;
    let lungeTimer: ReturnType<typeof setTimeout> | undefined;

    if (prevHP !== undefined && combat.playerHP < prevHP) {
      const amount = prevHP - combat.playerHP;
      setDamageHit({ amount, key: Date.now() });
      setEnemyAttacking(true);
      hitTimer = setTimeout(() => setDamageHit(null), 1000);
      lungeTimer = setTimeout(() => setEnemyAttacking(false), 500);
    }

    prevPlayerHPRef.current = combat.playerHP;
    return () => {
      if (hitTimer) clearTimeout(hitTimer);
      if (lungeTimer) clearTimeout(lungeTimer);
    };
  }, [combat?.playerHP]);

  // Enemy gets the first word in, player's line follows shortly after -
  // matches the order the lines are actually spoken in (see Game.tsx).
  useEffect(() => {
    const hideEnemy = setTimeout(() => setShowEnemyTaunt(false), 2600);
    const showPlayer = setTimeout(() => setShowPlayerTaunt(true), 1400);
    const hidePlayer = setTimeout(() => setShowPlayerTaunt(false), 4000);
    return () => {
      clearTimeout(hideEnemy);
      clearTimeout(showPlayer);
      clearTimeout(hidePlayer);
    };
  }, []);

  useEffect(() => {
    if (!combat) return;
    if (combat.gameOver && combat.playerWon) {
      setTimeout(onVictory, 800);
    }
    if (combat.gameOver && !combat.playerWon) {
      setTimeout(onDefeat, 800);
    }
  }, [combat, onVictory, onDefeat]);

  // Animate cards being drawn
  useEffect(() => {
    if (!combat) return;
    const newCards = combat.hand.filter((c) => !drawnCards.has(c.id));
    newCards.forEach((c, i) => {
      setTimeout(() => {
        setDrawnCards((prev) => new Set([...prev, c.id]));
      }, i * 150);
    });
  }, [combat, drawnCards]);

  if (!combat) return null;

  const enemyHPPercent = (combat.enemy.hp / combat.enemy.maxHP) * 100;

  const canPlayCard = (card: Card) => {
    return combat.playerEnergy >= card.cost && !combat.gameOver;
  };

  const atkRating = playerAttackRating(gameState.player);
  const enemyDef = combat.enemy.defenseRating ?? 0;

  // The value shown on a card should reflect what it will ACTUALLY do,
  // including gear bonuses and the enemy's defense-rating mitigation.
  const getEffectiveValue = (card: Card): string | number => {
    const hits = card.name.includes('Assault') ? 2 : 1;
    const raw = card.value * (1 + gameState.player.attackPercent / 100) * hits;
    const damage = applyMitigation(raw, enemyDef, atkRating, 1);
    const shield = Math.round(card.value * (1 + gameState.player.defensePercent / 100));

    // Mythical hybrid cards do both at once - show both numbers.
    if (card.isMythical && (card.type === 'attack' || card.type === 'defense')) {
      return `${damage}⚔ ${shield}🛡`;
    }
    if (card.type === 'attack') return damage;
    if (card.type === 'defense') return shield;
    return card.value;
  };

  if (combat.gameOver) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <h2 className="modal-title">
            {combat.playerWon ? '🎉 Victory!' : '💀 Defeat'}
          </h2>
          <p className="modal-text">
            {combat.playerWon
              ? `You defeated ${combat.enemy.name}!`
              : `You were defeated by ${combat.enemy.name}...`}
          </p>
          {combat.resultLine && (
            <p
              className="modal-text"
              style={{
                fontStyle: 'italic',
                color: combat.playerWon ? '#88dd55' : '#a0a0c0',
              }}
            >
              "{combat.resultLine}"
            </p>
          )}
          {!combat.playerWon && (
            <div className="modal-buttons">
              <button className="btn" onClick={onMenu}>
                Return to Menu
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const playerHPPercent = (Math.max(0, combat.playerHP) / combat.playerMaxHP) * 100;
  const attacksPerTurn = combat.enemy.attacksPerTurn ?? 1;

  // Player's defense rating folds in this turn's shield, so it climbs live as
  // defense cards are played; the intent shows the resulting mitigated hit.
  const playerDefRating = playerDefenseRating(gameState.player, combat.defense);
  const incomingPerHit = applyMitigation(
    combat.enemy.nextIntentDamage,
    playerDefRating,
    combat.enemy.attackRating
  );

  // Energy shown as discrete gems so the player reads their pool at a glance.
  // Cards can push energy above the normal max (Focus, Second Wind); those
  // overflow gems render in a distinct "bonus" color rather than being lost.
  const totalPips = Math.max(combat.playerMaxEnergy, combat.playerEnergy);
  const energyPips = Array.from({ length: totalPips }, (_, i) => ({
    filled: i < combat.playerEnergy,
    bonus: i >= combat.playerMaxEnergy,
  }));

  return (
    <div className="game-screen">
      <div className="combat-hud">
        <div className="hud-player">
          <div className="hp-meter">
            <span className="hud-heart">
              <HeartIcon size={22} />
            </span>
            <div className="hp-track">
              <div className="hp-track-fill" style={{ width: `${playerHPPercent}%` }} />
              <span className="hp-track-text">
                {Math.max(0, combat.playerHP)} / {combat.playerMaxHP}
              </span>
            </div>
          </div>
          <div className={`armor-badge${combat.defense > 0 ? '' : ' empty'}`}>
            <ArmorIcon size={18} />
            <span>{combat.defense}</span>
          </div>
        </div>
        <div className="hud-meta">
          <span className="turn-pill">Turn {combat.turn}</span>
          <button className="btn-menu" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>

      <div className="game-board">
        <div className="board-section">
          <div className="enemy-zone">
            <div
              className={`enemy-sprite-container${enemyAttacking ? ' attacking' : ''}`}
              style={{ position: 'relative' }}
            >
              {showEnemyTaunt && combat.enemyTaunt && (
                <div className="speech-bubble enemy-bubble">{combat.enemyTaunt}</div>
              )}
              <EnemySprite name={combat.enemy.name} size={140} />
            </div>
            <div className={`enemy-card${combat.enemy.isBoss ? ' boss-card' : ''}`}>
              <div className="enemy-name">
                {combat.enemy.name}
                {combat.enemy.isBoss && <span className="boss-tag">BOSS</span>}
              </div>
              <div className="rating-row">
                <span
                  className="rating-badge atk-rating"
                  title="Attack rating — raise your Defense toward it to reduce its hits"
                >
                  <SwordIcon size={13} /> {combat.enemy.attackRating}
                </span>
                {enemyDef > 0 && (
                  <span
                    className="rating-badge def-rating"
                    title="Defense rating — mitigates your card damage"
                  >
                    <ArmorIcon size={13} /> {enemyDef}
                  </span>
                )}
              </div>
              <div className="enemy-hp">
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${Math.max(0, enemyHPPercent)}%` }}
                  />
                  <span className="enemy-hp-text">
                    {Math.max(0, combat.enemy.hp)} / {combat.enemy.maxHP}
                  </span>
                </div>
              </div>
              <div className="enemy-intents">
                {combat.enemy.nextIntentDamage > 0 && (
                  <div className="intent-badge attack-intent">
                    <SwordIcon size={14} />
                    <span>
                      {incomingPerHit}
                      {attacksPerTurn > 1 ? ` ×${attacksPerTurn}` : ''} dmg
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="board-section">
          <div className="player-container" style={{ position: 'relative' }}>
            {showPlayerTaunt && combat.playerTaunt && (
              <div className="speech-bubble">{combat.playerTaunt}</div>
            )}
            {damageHit && (
              <div className="damage-number" key={damageHit.key}>
                -{damageHit.amount}
              </div>
            )}
            <div className="player-sprite-wrapper">
              <PlayerSprite size={110} />
            </div>
            <div className="player-ratings">
              <span
                className="rating-badge atk-rating"
                title="Your Attack rating — higher pierces enemy Defense"
              >
                <SwordIcon size={14} /> {atkRating}
              </span>
              <span
                className="rating-badge def-rating"
                title="Your Defense rating (incl. this turn's shield) — beat the enemy's Attack to halve hits"
              >
                <ArmorIcon size={14} /> {playerDefRating}
              </span>
            </div>
          </div>
          <div className="hand-container">
            <div className="hand-toolbar">
              <div className="hand-label">Hand · {combat.hand.length}</div>
              <div className="energy-track">
                <BoltIcon size={18} />
                <div className="energy-gems">
                  {energyPips.map((pip, i) => (
                    <span
                      key={i}
                      className={`energy-pip${pip.filled ? ' filled' : ''}${
                        pip.bonus ? ' bonus' : ''
                      }`}
                    />
                  ))}
                </div>
                <span className="energy-count">
                  {combat.playerEnergy}/{combat.playerMaxEnergy}
                </span>
              </div>
              <div className="draw-pile-count" title="Cards remaining in deck + discard">
                <span className="draw-pile-icon">🂠</span>
                {combat.deck.length + combat.discard.length}
              </div>
            </div>
            <div className="hand">
              {combat.hand.length === 0 ? (
                <p className="hand-empty">No cards in hand</p>
              ) : (
                combat.hand.map((card, idx) => {
                  const alreadyDrawn = drawnCards.has(card.id);
                  const effVal = getEffectiveValue(card);
                  const isHybrid = typeof effVal === 'string';
                  return (
                  <div
                    key={card.id}
                    className={`card ${card.type} ${
                      !canPlayCard(card) ? 'disabled' : ''
                    } ${alreadyDrawn ? 'drawn' : ''} ${card.isEmpowered ? 'empowered' : ''} ${
                      card.isMythical ? 'mythical' : ''
                    }`}
                    style={
                      alreadyDrawn ? undefined : { animationDelay: `${idx * 0.15}s` }
                    }
                    onClick={() => canPlayCard(card) && onPlayCard(card)}
                    title={card.description}
                  >
                    <div className="card-cost">{card.cost}</div>
                    {card.isEmpowered && <div className="card-star">★</div>}
                    {card.isMythical && <div className="card-star mythical-star">🌈</div>}
                    <div className="card-top">
                      <div className="card-icon">
                        {card.type === 'attack' ? (
                          <SwordIcon size={30} />
                        ) : card.type === 'defense' ? (
                          <ShieldIcon size={30} />
                        ) : (
                          <SparkleIcon size={30} />
                        )}
                      </div>
                      <div className="card-name">{card.name}</div>
                      <div className={`card-value${isHybrid ? ' hybrid' : ''}`}>{effVal}</div>
                    </div>
                    <div className="card-desc">
                      <span className="card-desc-text">{card.description}</span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="turn-controls">
            <button
              className="btn-end-turn"
              onClick={onEndTurn}
              disabled={combat.gameOver}
            >
              End Turn
            </button>
            {combat.message && <p className="combat-message">{combat.message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
