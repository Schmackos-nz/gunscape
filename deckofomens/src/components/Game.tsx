import React, { useState } from 'react';
import { GameState, Card, DeckType, Enemy, Item, Player } from '../types';
import { generateDeck, drawCards } from '../cardData';
import { generateLoot } from '../itemData';
import { playSound } from '../audio';
import { DeckSelection } from './DeckSelection';
import { GameScreen } from './GameScreen';
import { World3D } from './World3D';
import { LootScreen } from './LootScreen';
import { InventoryScreen } from './InventoryScreen';

export const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showInventory, setShowInventory] = useState(false);

  const initializeGame = (deckType: DeckType) => {
    const initialPlayer: Player = {
      level: 1,
      experience: 0,
      maxHP: 100,
      hp: 100,
      attackPower: 5,
      defense: 0,
      inventory: [],
      equippedItems: {},
      gold: 0,
    };

    const state: GameState = {
      screen: 'world',
      player: initialPlayer,
      currentLevel: 1,
      maxLevels: 5,
      worldPosition: 0,
      worldLength: 30,
      deckType,
    };

    setGameState(state);
  };

  const startCombat = (enemy: Enemy) => {
    if (!gameState) return;

    const deck = generateDeck(gameState.deckType);
    const { hand, deck: newDeck, discard } = drawCards(deck, [], 5, []);

    const newState = { ...gameState };
    newState.screen = 'combat';
    newState.combat = {
      playerHP: gameState.player.hp,
      playerMaxHP: gameState.player.maxHP,
      playerEnergy: 3,
      playerMaxEnergy: 3,
      defense: 0,
      turn: 1,
      hand,
      deck: newDeck,
      discard,
      enemy,
      gameOver: false,
      playerWon: false,
      message: `Encountered ${enemy.name}!`,
    };

    setGameState(newState);
  };

  const playCard = (card: Card) => {
    if (!gameState?.combat || gameState.combat.gameOver) return;

    const cardCost = 1;
    if (gameState.combat.playerEnergy < cardCost) {
      setGameState({
        ...gameState,
        combat: { ...gameState.combat, message: 'Not enough energy!' },
      });
      return;
    }

    playSound('card');

    const combat = { ...gameState.combat };
    combat.playerEnergy -= cardCost;
    combat.hand = combat.hand.filter((c) => c.id !== card.id);
    combat.discard.push(card);
    combat.message = '';

    if (card.type === 'attack') {
      playSound('attack');
      const damage = card.value + gameState.player.attackPower;
      combat.enemy.hp -= damage;
      combat.message = `Dealt ${damage} damage!`;

      if (combat.enemy.hp <= 0) {
        combat.gameOver = true;
        combat.playerWon = true;
        combat.message = `Defeated ${combat.enemy.name}!`;
      }
    } else {
      playSound('defense');
      const armor = card.value + gameState.player.defense;
      combat.defense += armor;
      combat.message = `Gained ${armor} armor!`;
    }

    setGameState({ ...gameState, combat });
  };

  const endTurn = () => {
    if (!gameState?.combat || gameState.combat.gameOver) return;

    const combat = { ...gameState.combat };
    const defense = combat.defense;
    combat.defense = 0;
    combat.turn += 1;

    const enemyDamage = combat.enemy.nextIntentDamage;
    const damageAfterDefense = Math.max(1, enemyDamage - defense);

    playSound('damage');
    combat.playerHP -= damageAfterDefense;

    if (combat.playerHP <= 0) {
      playSound('defeat');
      combat.gameOver = true;
      combat.playerWon = false;
      combat.message = `${combat.enemy.name} dealt ${damageAfterDefense} damage. You were defeated!`;
    } else {
      const nextIntents = [6, 8, 10, 12, 15, 18, 20];
      combat.enemy.nextIntentDamage =
        nextIntents[Math.floor(Math.random() * nextIntents.length)];
    }

    const { hand, deck, discard } = drawCards(combat.deck, combat.discard, 5, []);
    combat.hand = hand;
    combat.deck = deck;
    combat.discard = discard;
    combat.playerEnergy = combat.playerMaxEnergy;

    setGameState({ ...gameState, combat });
  };

  const handleCombatVictory = () => {
    if (!gameState?.combat) return;

    playSound('victory');

    const player = { ...gameState.player };
    const expGain = gameState.combat.enemy.defeatReward;
    const goldGain = gameState.combat.enemy.level * 20;
    const items = generateLoot(gameState.combat.enemy.level);

    player.experience += expGain;
    player.gold += goldGain;
    player.hp = Math.min(gameState.player.maxHP, gameState.combat.playerHP + 10);

    const nextState = { ...gameState };
    nextState.player = player;
    nextState.screen = 'loot';
    nextState.lootReward = {
      items,
      gold: goldGain,
      experience: expGain,
    };

    setGameState(nextState);
  };

  const handleCombatDefeat = () => {
    if (!gameState) return;
    setGameState({ ...gameState, screen: 'world', worldPosition: 0 });
  };

  const continueLoot = () => {
    if (!gameState?.lootReward) return;

    const player = { ...gameState.player };
    player.inventory.push(...gameState.lootReward.items);

    const nextState = { ...gameState };
    nextState.player = player;
    nextState.screen = 'world';
    nextState.lootReward = undefined;

    setGameState(nextState);
  };

  const handleLevelComplete = () => {
    if (!gameState) return;

    if (gameState.currentLevel >= gameState.maxLevels) {
      playSound('victory');
      setGameState({ ...gameState, screen: 'menu' });
      return;
    }

    playSound('levelup');

    const nextState = { ...gameState };
    nextState.currentLevel += 1;
    nextState.worldPosition = 0;
    nextState.player.level += 1;
    nextState.player.maxHP += 10;
    nextState.player.hp = nextState.player.maxHP;

    setGameState(nextState);
  };

  const handleEncounter = (enemy: Enemy) => {
    if (!gameState) return;
    const newState = { ...gameState };
    newState.worldPosition += 1;
    setGameState(newState);
    startCombat(enemy);
  };

  const equipItem = (item: Item, slot: 'weapon' | 'armor' | 'accessory') => {
    if (!gameState) return;

    const player = { ...gameState.player };
    const unequipped = player.equippedItems[slot];

    player.equippedItems[slot] = item;
    player.inventory = player.inventory.filter((i) => i.id !== item.id);

    if (unequipped) {
      player.inventory.push(unequipped);
    }

    player.attackPower = 5;
    player.defense = 0;
    player.maxHP = 100;

    Object.values(player.equippedItems).forEach((eq) => {
      if (eq) {
        player.attackPower += eq.bonus.attackPower || 0;
        player.defense += eq.bonus.defense || 0;
        player.maxHP += eq.bonus.maxHP || 0;
      }
    });

    if (player.hp > player.maxHP) {
      player.hp = player.maxHP;
    }

    setGameState({ ...gameState, player });
  };

  const unequipItem = (slot: 'weapon' | 'armor' | 'accessory') => {
    if (!gameState) return;

    const player = { ...gameState.player };
    const item = player.equippedItems[slot];

    if (item) {
      delete player.equippedItems[slot];
      player.inventory.push(item);

      player.attackPower = 5;
      player.defense = 0;
      player.maxHP = 100;

      Object.values(player.equippedItems).forEach((eq) => {
        if (eq) {
          player.attackPower += eq.bonus.attackPower || 0;
          player.defense += eq.bonus.defense || 0;
          player.maxHP += eq.bonus.maxHP || 0;
        }
      });

      if (player.hp > player.maxHP) {
        player.hp = player.maxHP;
      }
    }

    setGameState({ ...gameState, player });
  };

  if (!gameState) {
    return <DeckSelection onSelectDeck={initializeGame} />;
  }

  if (showInventory) {
    return (
      <InventoryScreen
        gameState={gameState}
        onEquip={equipItem}
        onUnequip={unequipItem}
        onClose={() => setShowInventory(false)}
      />
    );
  }

  if (gameState.screen === 'world') {
    return (
      <World3D
        gameState={gameState}
        onEncounter={handleEncounter}
        onLevelComplete={handleLevelComplete}
        onOpenInventory={() => setShowInventory(true)}
      />
    );
  }

  if (gameState.screen === 'combat') {
    return (
      <GameScreen
        gameState={gameState}
        onPlayCard={playCard}
        onEndTurn={endTurn}
        onVictory={handleCombatVictory}
        onDefeat={handleCombatDefeat}
        onMenu={() => setGameState(null)}
      />
    );
  }

  if (gameState.screen === 'loot') {
    return <LootScreen gameState={gameState} onContinue={continueLoot} />;
  }

  return null;
};
