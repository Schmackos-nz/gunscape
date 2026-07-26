import React, { useState } from 'react';
import { GameState } from '../types';

interface DeckRevealScreenProps {
  gameState: GameState;
  onContinue: () => void;
}

const DECK_LABELS: Record<string, string> = {
  offensive: 'Offensive Deck',
  defensive: 'Defensive Deck',
  balanced: 'Balanced Deck',
};

export const DeckRevealScreen: React.FC<DeckRevealScreenProps> = ({ gameState, onContinue }) => {
  const [showCards, setShowCards] = useState(false);
  const reveal = gameState.deckReveal;

  if (!reveal) return null;

  if (reveal.isMythical && reveal.mythicalCard) {
    const card = reveal.mythicalCard;
    return (
      <div className="loot-screen">
        <div className="loot-modal deck-offer-modal mythical-modal">
          <h2 className="loot-title">🌈 Mythical Deck Claimed! 🌈</h2>

          <p className="deck-offer-desc">
            Your deck is now a <strong>Mythical Balanced Deck</strong>: every attack card also
            shields you, and every defense card also strikes the enemy, both halved. Hidden among
            its 52 cards is one unique Mythical card:
          </p>

          <div className="empowered-card-list">
            <div className="empowered-card-row mythical-card-row">
              <span className="empowered-card-star">🌈</span>
              <span className="empowered-card-name">{card.name}</span>
              <span className="empowered-card-value">{card.description}</span>
            </div>
          </div>

          <div className="loot-actions">
            <button className="btn" onClick={onContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loot-screen">
      <div className="loot-modal deck-offer-modal">
        <h2 className="loot-title">⭐ Deck Empowered! ⭐</h2>

        <p className="deck-offer-desc">
          Your <strong>{DECK_LABELS[reveal.deckType]}</strong> now has{' '}
          <strong>{reveal.empoweredCards.length}</strong> empowered card
          {reveal.empoweredCards.length === 1 ? '' : 's'} - each either cheaper to play or 50%
          stronger, marked with a star when drawn.
        </p>

        {!showCards ? (
          <button className="btn-small" onClick={() => setShowCards(true)}>
            View Empowered Cards
          </button>
        ) : (
          <div className="empowered-card-list">
            {reveal.empoweredCards.map((card) => (
              <div key={card.id} className="empowered-card-row">
                <span className="empowered-card-star">★</span>
                <span className="empowered-card-name">{card.name}</span>
                <span className="empowered-card-value">
                  Cost {card.cost} · Value {card.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="loot-actions">
          <button className="btn" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
