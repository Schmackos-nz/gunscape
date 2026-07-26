import React from 'react';
import { playSound } from '../audio';

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ hasSave, onNewGame, onContinue }) => {
  const handleNewGame = () => {
    playSound('click');
    onNewGame();
  };

  const handleContinue = () => {
    playSound('click');
    onContinue();
  };

  return (
    <div className="deck-selection">
      <div className="deck-bg-glow deck-bg-glow-1" />
      <div className="deck-bg-glow deck-bg-glow-2" />
      <div className="floating-card floating-card-1" />
      <div className="floating-card floating-card-2" />
      <div className="floating-card floating-card-3" />
      <div className="floating-card floating-card-4" />

      <div className="deck-selection-content title-screen-content">
        <h1 className="title title-screen-title">Deck of Omens</h1>
        <p className="subtitle">A roguelike deckbuilding adventure</p>

        <div className="title-screen-buttons">
          <button className="btn title-screen-btn" onClick={handleNewGame}>
            New Game
          </button>
          {hasSave && (
            <button className="btn secondary title-screen-btn" onClick={handleContinue}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
