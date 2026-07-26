import React, { useEffect, useState } from 'react';
import { GameState, Item } from '../types';
import { getRarityColor } from '../itemData';

interface InventoryScreenProps {
  gameState: GameState;
  onEquip: (item: Item, slot: 'weapon' | 'armor' | 'accessory') => void;
  onUnequip: (slot: 'weapon' | 'armor' | 'accessory') => void;
  onClose: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  gameState,
  onEquip,
  onUnequip,
  onClose,
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getAvailableSlots = (item: Item) => {
    if (item.type === 'weapon') return ['weapon'];
    if (item.type === 'armor') return ['armor'];
    return ['accessory'];
  };

  return (
    <div className="inventory-screen">
      <div className="inventory-modal">
        <div className="inventory-header">
          <h2>Inventory</h2>
          <button className="btn-small" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="inventory-content">
          <div className="equipment-section">
            <h3 style={{ marginBottom: '1rem', color: '#ff6b9d' }}>Equipment</h3>
            <div className="equipment-slots">
              <div className="equipment-slot">
                <span className="slot-name">Weapon</span>
                {gameState.player.equippedItems.weapon ? (
                  <div
                    className="equipped-item"
                    style={{ borderColor: getRarityColor(gameState.player.equippedItems.weapon.rarity) }}
                  >
                    <div>{gameState.player.equippedItems.weapon.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>
                      {gameState.player.equippedItems.weapon.description}
                    </div>
                    <button
                      className="btn-unequip"
                      onClick={() => onUnequip('weapon')}
                    >
                      Unequip
                    </button>
                  </div>
                ) : (
                  <div className="empty-slot">Empty</div>
                )}
              </div>

              <div className="equipment-slot">
                <span className="slot-name">Armor</span>
                {gameState.player.equippedItems.armor ? (
                  <div
                    className="equipped-item"
                    style={{ borderColor: getRarityColor(gameState.player.equippedItems.armor.rarity) }}
                  >
                    <div>{gameState.player.equippedItems.armor.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>
                      {gameState.player.equippedItems.armor.description}
                    </div>
                    <button
                      className="btn-unequip"
                      onClick={() => onUnequip('armor')}
                    >
                      Unequip
                    </button>
                  </div>
                ) : (
                  <div className="empty-slot">Empty</div>
                )}
              </div>

              <div className="equipment-slot">
                <span className="slot-name">Accessory</span>
                {gameState.player.equippedItems.accessory ? (
                  <div
                    className="equipped-item"
                    style={{ borderColor: getRarityColor(gameState.player.equippedItems.accessory.rarity) }}
                  >
                    <div>{gameState.player.equippedItems.accessory.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#a0a0a0' }}>
                      {gameState.player.equippedItems.accessory.description}
                    </div>
                    <button
                      className="btn-unequip"
                      onClick={() => onUnequip('accessory')}
                    >
                      Unequip
                    </button>
                  </div>
                ) : (
                  <div className="empty-slot">Empty</div>
                )}
              </div>
            </div>
          </div>

          <div className="backpack-section">
            <h3 style={{ marginBottom: '1rem', color: '#88dd55' }}>
              Backpack ({gameState.player.inventory.length})
            </h3>
            {gameState.player.inventory.length === 0 ? (
              <p style={{ color: '#808080' }}>No items in backpack</p>
            ) : (
              <div className="backpack-items">
                {gameState.player.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="backpack-item"
                    style={{
                      borderColor: getRarityColor(item.rarity),
                      backgroundColor: selectedItem?.id === item.id ? 'rgba(255, 107, 157, 0.2)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="item-header">
                      <span>{item.name}</span>
                      <span style={{ color: getRarityColor(item.rarity), fontSize: '0.75rem' }}>
                        {item.rarity}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#a0a0a0', marginTop: '0.3rem' }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedItem && (
          <div className="item-actions">
            {getAvailableSlots(selectedItem).map((slot) => (
              <button
                key={slot}
                className="btn-small"
                onClick={() => {
                  onEquip(selectedItem, slot as 'weapon' | 'armor' | 'accessory');
                  setSelectedItem(null);
                }}
              >
                Equip as {slot}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
