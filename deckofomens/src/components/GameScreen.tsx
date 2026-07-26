import React, { useEffect, useState } from 'react';
import { GameState, Card } from '../types';
import { HeartIcon, BoltIcon, ArmorIcon, SwordIcon, ShieldIcon, EnemySprite, PlayerSprite } from './Icons';

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

  const canPlayCard = (_card: Card) => {
    const cardCost = 1;
    return combat.playerEnergy >= cardCost && !combat.gameOver;
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
          <div className="stat-box energy-stat">
            <BoltIcon size={20} />
            <span className="stat-label">Energy</span>
            <span className="stat-value">
              {combat.playerEnergy}/{combat.playerMaxEnergy}
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
            <div className="enemy-sprite-container">
              <EnemySprite name={combat.enemy.name} size={140} />
            </div>
            <div className="enemy-card">
              <div className="enemy-name">{combat.enemy.name}</div>
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
                  Deals {combat.enemy.nextIntentDamage} DMG next turn
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="board-section">
          <div className="player-container">
            <div className="player-sprite-wrapper">
              <PlayerSprite size={110} />
            </div>
          </div>
          <div className="hand-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div className="hand-label">Hand ({combat.hand.length})</div>
              <div className="deck-pile">
                <div className="deck-count">{combat.deck.length + combat.discard.length}</div>
              </div>
            </div>
            <div className="hand">
              {combat.hand.length === 0 ? (
                <p style={{ color: '#808080', fontSize: '0.9rem' }}>No cards in hand</p>
              ) : (
                combat.hand.map((card, idx) => (
                  <div
                    key={card.id}
                    className={`card ${card.type} ${
                      !canPlayCard(card) ? 'disabled' : ''
                    } ${drawnCards.has(card.id) ? 'drawn' : ''}`}
                    style={{
                      animationDelay: `${idx * 0.15}s`,
                    }}
                    onClick={() => canPlayCard(card) && onPlayCard(card)}
                    title={card.description}
                  >
                    <div className="card-icon">
                      {card.type === 'attack' ? (
                        <SwordIcon size={28} />
                      ) : (
                        <ShieldIcon size={28} />
                      )}
                    </div>
                    <div className="card-name">{card.name}</div>
                    <div className="card-value">{card.value}</div>
                    <div className="card-desc">{card.description}</div>
                  </div>
                ))
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
