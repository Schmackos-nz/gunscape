import React from 'react';
import { GameState } from '../types';

interface DeckOfferScreenProps {
  gameState: GameState;
  onSwap: () => void;
  onDecline: () => void;
}

const DECK_LABELS: Record<string, string> = {
  offensive: 'Offensive Deck',
  defensive: 'Defensive Deck',
  balanced: 'Balanced Deck',
};

export const DeckOfferScreen: React.FC<DeckOfferScreenProps> = ({ gameState, onSwap, onDecline }) => {
  const offer = gameState.deckOffer;

  if (!offer) return null;

  const canAfford = gameState.player.coins >= 1;

  return (
    <div className="loot-screen">
      <div className={`loot-modal deck-offer-modal${offer.isMythical ? ' mythical-modal' : ''}`}>
        <h2 className="loot-title deck-offer-title">
          {offer.isMythical ? '🌈 MYTHICAL DECK! 🌈' : '✨ EMPOWERED DECK! ✨'}
        </h2>

        {offer.isMythical ? (
          <p className="deck-offer-desc">
            A shimmering, impossible deck radiates power far beyond a normal find. Every attack card
            also shields you, and every defense card also strikes back - both halved in exchange for
            doing both at once. Some of its cards are also empowered, and hidden within it is one
            unique Mythical card with a game-changing effect - but you won't know how many, or what it
            does, until you claim it.
          </p>
        ) : (
          <p className="deck-offer-desc">
            A mysterious <strong>{DECK_LABELS[offer.deckType]}</strong> radiates power. Some of its
            cards have been empowered - either cheaper to play or 50% stronger, marked with a star -
            but you won't know how many, or which ones, until you claim it.
          </p>
        )}

        <div className="deck-offer-cost">
          <span>Cost to swap</span>
          <span className="deck-offer-coin">🪙 1 Coin</span>
        </div>

        <p className="deck-offer-warning">
          Swapping replaces your current deck entirely. You have {gameState.player.coins} coin
          {gameState.player.coins === 1 ? '' : 's'}.
        </p>

        <div className="modal-buttons">
          <button className="btn" onClick={onSwap} disabled={!canAfford} style={!canAfford ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            Swap Deck
          </button>
          <button className="btn secondary" onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};
