import React from 'react';
import { GameState } from '../types';
import { getRarityColor } from '../itemData';

interface LootScreenProps {
  gameState: GameState;
  onContinue: (choice?: 'item' | 'coin') => void;
}

export const LootScreen: React.FC<LootScreenProps> = ({ gameState, onContinue }) => {
  const loot = gameState.lootReward;

  if (!loot) return null;

  return (
    <div className="loot-screen">
      <div className="loot-modal">
        <h2 className="loot-title">🎉 Victory!</h2>

        <div className="loot-rewards">
          <div className="reward-group">
            <h3 style={{ marginBottom: '1rem', color: '#ffaa33' }}>Rewards</h3>
            <div className="reward-row">
              <span>Experience</span>
              <span style={{ color: '#88dd55', fontWeight: 'bold' }}>+{loot.experience} XP</span>
            </div>
            <div className="reward-row">
              <span>Gold</span>
              <span style={{ color: '#ffaa33', fontWeight: 'bold' }}>+{loot.gold} Gold</span>
            </div>
          </div>

          {!loot.coinOffered && loot.items.length > 0 && (
            <div className="reward-group" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#ff6b9d' }}>Item Found</h3>
              <div className="loot-items">
                {loot.items.map((item) => (
                  <div key={item.id} className="loot-item" style={{ borderColor: getRarityColor(item.rarity) }}>
                    <div className="loot-item-header">
                      <span className="loot-item-name">{item.name}</span>
                      <span
                        className="loot-rarity"
                        style={{
                          color: getRarityColor(item.rarity),
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.rarity}
                      </span>
                    </div>
                    <div className="loot-item-type" style={{ fontSize: '0.75rem', color: '#a0a0a0', marginBottom: '0.3rem' }}>
                      {item.type}
                    </div>
                    <div className="loot-item-desc">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loot.coinOffered && (
            <div className="reward-group" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#ff6b9d' }}>Choose Your Reward</h3>
              <div className="loot-choice-options">
                {loot.items.map((item) => (
                  <div
                    key={item.id}
                    className="loot-item loot-choice"
                    style={{ borderColor: getRarityColor(item.rarity) }}
                    onClick={() => onContinue('item')}
                  >
                    <div className="loot-item-header">
                      <span className="loot-item-name">{item.name}</span>
                      <span
                        style={{
                          color: getRarityColor(item.rarity),
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.rarity}
                      </span>
                    </div>
                    <div className="loot-item-desc">{item.description}</div>
                    <button className="btn-small loot-choice-btn">Take Item</button>
                  </div>
                ))}

                <div className="loot-item loot-choice coin-choice" onClick={() => onContinue('coin')}>
                  <div className="loot-item-header">
                    <span className="loot-item-name">🪙 A Coin</span>
                  </div>
                  <div className="loot-item-desc">Spend it to swap your deck for an empowered one found in the field.</div>
                  <button className="btn-small loot-choice-btn">Take Coin</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!loot.coinOffered && (
          <div className="loot-actions">
            <button className="btn" onClick={() => onContinue()}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
