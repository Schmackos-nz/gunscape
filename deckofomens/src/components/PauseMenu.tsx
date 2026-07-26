import React from 'react';

interface PauseMenuProps {
  inCombat: boolean;
  onResume: () => void;
  onInventory: () => void;
  onQuit: () => void;
}

// Overlay shown when the player opens the menu mid-game. Pausing here (rather
// than dumping straight to the title screen) lets them check their deck and
// gear even in the middle of a fight before deciding to resume or quit.
export const PauseMenu: React.FC<PauseMenuProps> = ({ inCombat, onResume, onInventory, onQuit }) => (
  <div className="pause-overlay">
    <div className="pause-modal">
      <h2 className="pause-title">Paused</h2>
      {inCombat && <p className="pause-subtitle">The battle waits...</p>}
      <div className="pause-buttons">
        <button className="btn btn-omen" onClick={onResume}>
          Resume
        </button>
        <button className="btn btn-omen secondary" onClick={onInventory}>
          Deck &amp; Inventory
        </button>
        <button className="btn btn-omen danger" onClick={onQuit}>
          Quit to Menu
        </button>
      </div>
    </div>
  </div>
);
