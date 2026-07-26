import React, { useEffect, useRef, useState } from 'react';
import { GameState, Card } from '../types';
import { HeartIcon, BoltIcon, ArmorIcon, SwordIcon, ShieldIcon, SparkleIcon, EnemySprite, PlayerSprite } from './Icons';

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

  // The value shown on a card should reflect what it will ACTUALLY do,
  // including equipped item bonuses - not just the card's base number.
  const getEffectiveValue = (card: Card) => {
    if (card.type === 'attack') {
      const hits = card.name.includes('Assault') ? 2 : 1;
      const withGear = card.value * (1 + gameState.player.attackPercent / 100) * hits;
      const armorReduction = combat.enemy.armor ? 1 - combat.enemy.armor / 100 : 1;
      return Math.max(1, Math.round(withGear * armorReduction));
    }
    if (card.type === 'defense') return Math.round(card.value * (1 + gameState.player.defensePercent / 100));
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

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className="player-stats">
          <div className="stat-box hp-stat">
            <HeartIcon size={20} />
            <span className="stat-label">Health</span>
            <span className="stat-value">
              {Math.max(0, combat.playerHP)}/{combat.playerMaxHP}
            </span>
          </div>
          <div className="stat-box" style={{ color: '#6ba3ff' }}>
            <ArmorIcon size={20} />
            <span className="stat-label">Armor</span>
            <span className="stat-value">{combat.defense}</span>
          </div>
        </div>
        <span className="turn-counter">Turn {combat.turn}</span>
        <button className="btn-menu" onClick={onMenu}>
          Menu
        </button>
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
              <div className="enemy-hp">
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${Math.max(0, enemyHPPercent)}%` }}
                  />
                </div>
                <span>{Math.max(0, combat.enemy.hp)}</span>
              </div>
              {combat.enemy.nextIntentDamage > 0 && (
                <div className="enemy-intent">
                  <span style={{ marginRight: '0.3rem', display: 'inline-flex' }}>
                    <BoltIcon size={14} />
                  </span>
                  Deals {combat.enemy.nextIntentDamage} DMG
                  {(combat.enemy.attacksPerTurn ?? 1) > 1 ? ` x${combat.enemy.attacksPerTurn} hits` : ''} next turn
                </div>
              )}
              {!!combat.enemy.armor && (
                <div className="enemy-intent" style={{ color: '#6ba3ff' }}>
                  <span style={{ marginRight: '0.3rem', display: 'inline-flex' }}>
                    <ArmorIcon size={14} />
                  </span>
                  {combat.enemy.armor}% damage reduction
                </div>
              )}
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
          </div>
          <div className="hand-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div className="hand-label">Hand ({combat.hand.length})</div>
              <div className="hand-energy">
                <BoltIcon size={20} />
                <span className="stat-value">
                  {combat.playerEnergy}/{combat.playerMaxEnergy}
                </span>
              </div>
              <div className="deck-pile">
                <div className="deck-count">{combat.deck.length + combat.discard.length}</div>
              </div>
            </div>
            <div className="hand">
              {combat.hand.length === 0 ? (
                <p style={{ color: '#808080', fontSize: '0.9rem' }}>No cards in hand</p>
              ) : (
                combat.hand.map((card, idx) => {
                  const alreadyDrawn = drawnCards.has(card.id);
                  return (
                  <div
                    key={card.id}
                    className={`card ${card.type} ${
                      !canPlayCard(card) ? 'disabled' : ''
                    } ${alreadyDrawn ? 'drawn' : ''} ${card.isEmpowered ? 'empowered' : ''}`}
                    style={
                      alreadyDrawn ? undefined : { animationDelay: `${idx * 0.15}s` }
                    }
                    onClick={() => canPlayCard(card) && onPlayCard(card)}
                    title={card.description}
                  >
                    <div className="card-cost">{card.cost}</div>
                    {card.isEmpowered && <div className="card-star">★</div>}
                    <div className="card-icon">
                      {card.type === 'attack' ? (
                        <SwordIcon size={28} />
                      ) : card.type === 'defense' ? (
                        <ShieldIcon size={28} />
                      ) : (
                        <SparkleIcon size={28} />
                      )}
                    </div>
                    <div className="card-name">{card.name}</div>
                    <div className="card-value">{getEffectiveValue(card)}</div>
                    <div className="card-desc">{card.description}</div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <button
              className="btn"
              onClick={onEndTurn}
              disabled={combat.gameOver}
              style={{
                opacity: combat.gameOver ? 0.5 : 1,
                cursor: combat.gameOver ? 'not-allowed' : 'pointer',
              }}
            >
              End Turn
            </button>
            {combat.message && (
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#ffaa33',
                  minHeight: '1.2rem',
                }}
              >
                {combat.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
