import React from 'react';
import { DeckType } from '../types';
import { playSound } from '../audio';

interface DeckSelectionProps {
  onSelectDeck: (deckType: DeckType) => void;
}

export const DeckSelection: React.FC<DeckSelectionProps> = ({ onSelectDeck }) => {
  const selectDeck = (deckType: DeckType) => {
    playSound('click');
    onSelectDeck(deckType);
  };

  return (
    <div className="deck-selection">
      <h1 className="title">Deck of Omens</h1>
      <p className="subtitle">Choose your deck and face the trials ahead</p>

      <div className="deck-options">
        <div
          className="deck-card offensive"
          onClick={() => selectDeck('offensive')}
        >
          <h2 className="deck-name">Offensive Deck</h2>
          <p className="deck-description">
            Master the art of attack. Strike fast, strike hard, and overwhelm your enemies.
          </p>
          <div className="deck-stats">
            <div className="stat">
              <div className="stat-value">35</div>
              <div className="stat-label">Attack Cards</div>
            </div>
            <div className="stat">
              <div className="stat-value">12</div>
              <div className="stat-label">Defense Cards</div>
            </div>
            <div className="stat">
              <div className="stat-value">5</div>
              <div className="stat-label">Utility Cards</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#808080' }}>75% Attack / 25% Defense + 5 Utility</p>
        </div>

        <div
          className="deck-card balanced"
          onClick={() => selectDeck('balanced')}
        >
          <h2 className="deck-name">Balanced Deck</h2>
          <p className="deck-description">
            A well-rounded approach. Balance offense and defense for a steady victory.
          </p>
          <div className="deck-stats">
            <div className="stat">
              <div className="stat-value">23</div>
              <div className="stat-label">Attack Cards</div>
            </div>
            <div className="stat">
              <div className="stat-value">24</div>
              <div className="stat-label">Defense Cards</div>
            </div>
            <div className="stat">
              <div className="stat-value">5</div>
              <div className="stat-label">Utility Cards</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#808080' }}>50% Attack / 50% Defense + 5 Utility</p>
        </div>

        <div
          className="deck-card defensive"
          onClick={() => selectDeck('defensive')}
        >
          <h2 className="deck-name">Defensive Deck</h2>
          <p className="deck-description">
            Fortify yourself. Weather any storm and outlast your foes.
          </p>
          <div className="deck-stats">
            <div className="stat">
              <div className="stat-value">12</div>
              <div className="stat-label">Attack Cards</div>
            </div>
            <div className="stat">
              <div className="stat-value">35</div>
              <div className="stat-label">Defense Cards</div>
            </div>
            <div className="stat">
              <div className="stat-value">5</div>
              <div className="stat-label">Utility Cards</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#808080' }}>25% Attack / 75% Defense + 5 Utility</p>
        </div>
      </div>
    </div>
  );
};
