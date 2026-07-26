import React from 'react';
import { DeckType } from '../types';
import { playSound } from '../audio';
import { SwordIcon, ShieldIcon, SparkleIcon } from './Icons';
import { OmenLogo } from './OmenLogo';

interface DeckSelectionProps {
  onSelectDeck: (deckType: DeckType) => void;
}

const DECKS: {
  type: DeckType;
  className: string;
  name: string;
  description: string;
  attack: number;
  defense: number;
  utility: number;
  ratioLabel: string;
  icon: React.FC<{ size?: number }>;
  tag?: string;
}[] = [
  {
    type: 'offensive',
    className: 'offensive',
    name: 'Offensive Deck',
    description: 'Master the art of attack. Strike fast, strike hard, and overwhelm your enemies.',
    attack: 35,
    defense: 12,
    utility: 5,
    ratioLabel: '75% Attack / 25% Defense',
    icon: SwordIcon,
  },
  {
    type: 'balanced',
    className: 'balanced',
    name: 'Balanced Deck',
    description: 'A well-rounded approach. Balance offense and defense for a steady victory.',
    attack: 23,
    defense: 24,
    utility: 5,
    ratioLabel: '50% Attack / 50% Defense',
    icon: SparkleIcon,
    tag: 'Recommended for new players',
  },
  {
    type: 'defensive',
    className: 'defensive',
    name: 'Defensive Deck',
    description: 'Fortify yourself. Weather any storm and outlast your foes.',
    attack: 12,
    defense: 35,
    utility: 5,
    ratioLabel: '25% Attack / 75% Defense',
    icon: ShieldIcon,
  },
];

export const DeckSelection: React.FC<DeckSelectionProps> = ({ onSelectDeck }) => {
  const selectDeck = (deckType: DeckType) => {
    playSound('click');
    onSelectDeck(deckType);
  };

  return (
    <div className="deck-selection">
      <div className="deck-bg-glow deck-bg-glow-1" />
      <div className="deck-bg-glow deck-bg-glow-2" />
      <div className="floating-card floating-card-1" />
      <div className="floating-card floating-card-2" />
      <div className="floating-card floating-card-3" />
      <div className="floating-card floating-card-4" />

      <div className="deck-selection-content">
        <OmenLogo compact />
        <p className="subtitle">Choose your deck and face the trials ahead</p>

        <div className="deck-options">
          {DECKS.map((deck) => {
            const Icon = deck.icon;
            const attackPercent = (deck.attack / (deck.attack + deck.defense)) * 100;
            return (
              <div
                key={deck.type}
                className={`deck-card ${deck.className}`}
                onClick={() => selectDeck(deck.type)}
              >
                {deck.tag && <div className="deck-tag">{deck.tag}</div>}
                <div className="deck-icon-badge">
                  <Icon size={36} />
                </div>
                <h2 className="deck-name">{deck.name}</h2>
                <p className="deck-description">{deck.description}</p>

                <div className="deck-ratio-bar">
                  <div className="deck-ratio-attack" style={{ width: `${attackPercent}%` }} />
                  <div className="deck-ratio-defense" style={{ width: `${100 - attackPercent}%` }} />
                </div>
                <p className="deck-ratio-label">{deck.ratioLabel}</p>

                <div className="deck-stats">
                  <div className="stat">
                    <div className="stat-value">{deck.attack}</div>
                    <div className="stat-label">Attack</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{deck.defense}</div>
                    <div className="stat-label">Defense</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{deck.utility}</div>
                    <div className="stat-label">Utility</div>
                  </div>
                </div>

                <button className="deck-choose-btn" onClick={() => selectDeck(deck.type)}>
                  Choose Deck
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
