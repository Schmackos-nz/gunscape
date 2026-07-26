import React, { useEffect, useState } from 'react';
import { GameState, Card, DeckType, DeckOffer, Enemy, Item, Player } from '../types';
import { generateDeck, generateEmpoweredDeck, shuffleDeck, drawCards } from '../cardData';
import { generateLoot, generateBossLoot } from '../itemData';
import { playSound } from '../audio';
import { getRandomTaunt, getRandomEnemyTaunt, getRandomVictoryLine, getRandomDefeatLine, getEnemyVoice, speak } from '../taunts';
import { saveGame, loadGame, clearSave } from '../saveGame';
import { DeckSelection } from './DeckSelection';
import { GameScreen } from './GameScreen';
import { World3D } from './World3D';
import { LootScreen } from './LootScreen';
import { InventoryScreen } from './InventoryScreen';
import { DeckOfferScreen } from './DeckOfferScreen';
import { DeckRevealScreen } from './DeckRevealScreen';

export const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(() => loadGame());
  const [showInventory, setShowInventory] = useState(false);

  useEffect(() => {
    if (gameState) saveGame(gameState);
  }, [gameState]);

  // Death is a full reset - permadeath back to deck selection, no carrying
  // progress, inventory, or bossTier over into the next run.
  const resetToMenu = () => {
    clearSave();
    setGameState(null);
  };

  const initializeGame = (deckType: DeckType) => {
    const initialPlayer: Player = {
      level: 1,
      experience: 0,
      maxHP: 100,
      hp: 100,
      attackPower: 5,
      defense: 0,
      bonusEnergy: 0,
      bonusDraw: 0,
      inventory: [],
      equippedItems: {},
      gold: 0,
      coins: 0,
    };

    const state: GameState = {
      screen: 'world',
      player: initialPlayer,
      currentLevel: 1,
      maxLevels: 5,
      worldPosition: 0,
      worldLength: 30,
      deckType,
      deckCards: generateDeck(deckType),
      bossTier: 0,
    };

    setGameState(state);
  };

  const startCombat = (enemy: Enemy) => {
    if (!gameState) return;

    playSound('encounter');
    const taunt = getRandomTaunt();
    const enemyTaunt = getRandomEnemyTaunt(enemy.isBoss);
    // The enemy gets the first word in; the player's line queues right
    // after it since SpeechSynthesis plays queued utterances in order.
    speak(enemyTaunt, getEnemyVoice(enemy.name, enemy.isBoss));
    speak(taunt);

    // Reshuffles the player's persistent deck pool for this fight - the
    // pool itself only changes when they swap it for one found in the
    // world, not every combat.
    const deck = shuffleDeck(gameState.deckCards);
    const startingEnergy = 3 + gameState.player.bonusEnergy;
    const startingDraw = 5 + gameState.player.bonusDraw;
    const { hand, deck: newDeck, discard } = drawCards(deck, [], startingDraw, []);

    const newState = { ...gameState };
    newState.screen = 'combat';
    newState.combat = {
      playerHP: gameState.player.hp,
      playerMaxHP: gameState.player.maxHP,
      playerEnergy: startingEnergy,
      playerMaxEnergy: startingEnergy,
      defense: 0,
      turn: 1,
      hand,
      deck: newDeck,
      discard,
      enemy,
      gameOver: false,
      playerWon: false,
      message: `Encountered ${enemy.name}!`,
      playerTaunt: taunt,
      enemyTaunt,
    };

    setGameState(newState);
  };

  const playCard = (card: Card) => {
    if (!gameState?.combat || gameState.combat.gameOver) return;

    const cardCost = card.cost;
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
        combat.resultLine = getRandomVictoryLine();
        speak(combat.resultLine);
      }
    } else if (card.type === 'defense') {
      playSound('defense');
      const armor = card.value + gameState.player.defense;
      combat.defense += armor;
      combat.message = `Gained ${armor} armor!`;
    } else {
      playSound('utility');
      if (card.effect === 'draw' || card.effect === 'drawEnergy') {
        const { hand, deck, discard } = drawCards(combat.deck, combat.discard, card.value, combat.hand);
        combat.hand = hand;
        combat.deck = deck;
        combat.discard = discard;
      }
      if (card.effect === 'energy') {
        combat.playerEnergy += card.value;
      }
      if (card.effect === 'drawEnergy') {
        combat.playerEnergy += 1;
      }
      combat.message = card.description;
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
      combat.resultLine = getRandomDefeatLine();
      speak(combat.resultLine, { pitch: 1.3, rate: 0.85 });
    } else {
      const nextIntents = [6, 8, 10, 12, 15, 18, 20];
      combat.enemy.nextIntentDamage =
        nextIntents[Math.floor(Math.random() * nextIntents.length)];
    }

    const drawCount = 5 + gameState.player.bonusDraw;
    const { hand, deck, discard } = drawCards(combat.deck, combat.discard, drawCount, []);
    combat.hand = hand;
    combat.deck = deck;
    combat.discard = discard;
    combat.playerEnergy = combat.playerMaxEnergy;

    setGameState({ ...gameState, combat });
  };

  const handleCombatVictory = () => {
    if (!gameState?.combat) return;

    const enemy = gameState.combat.enemy;
    const isBoss = !!enemy.isBoss;

    playSound(isBoss ? 'bossVictory' : 'victory');

    const player = { ...gameState.player };
    const expGain = enemy.defeatReward;
    const goldGain = enemy.level * 20;
    const items = isBoss ? generateBossLoot(enemy.level) : generateLoot(enemy.level);
    // A kill sometimes also offers a coin - spendable on deck pickups found
    // in the world - as an alternative to the item, never both.
    const coinOffered = Math.random() < 0.3;

    player.experience += expGain;
    player.gold += goldGain;
    player.hp = Math.min(gameState.player.maxHP, gameState.combat.playerHP + 10);

    const nextState = { ...gameState };
    nextState.player = player;
    nextState.screen = 'loot';
    // Defeating a boss "upgrades" the world: the tier feeds into every
    // subsequent enemy AND boss spawn, so things get slightly harder from
    // here on, and the next boss lair moves to a new corner of the map.
    if (isBoss) {
      nextState.bossTier = gameState.bossTier + 1;
    }
    nextState.lootReward = {
      items,
      gold: goldGain,
      experience: expGain,
      coinOffered,
    };

    setGameState(nextState);
  };

  const handleCombatDefeat = () => {
    resetToMenu();
  };

  const continueLoot = (choice?: 'item' | 'coin') => {
    if (!gameState?.lootReward) return;

    playSound('pickup');

    const player = { ...gameState.player };
    if (gameState.lootReward.coinOffered) {
      if (choice === 'coin') {
        player.coins += 1;
      } else {
        player.inventory.push(...gameState.lootReward.items);
      }
    } else {
      player.inventory.push(...gameState.lootReward.items);
    }

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
      resetToMenu();
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

  const handleDeckPickup = (offer: DeckOffer) => {
    if (!gameState) return;
    playSound('pickup');
    setGameState({ ...gameState, screen: 'deckOffer', deckOffer: offer });
  };

  const swapDeck = () => {
    if (!gameState?.deckOffer || gameState.player.coins < 1) return;

    playSound('levelup');

    const { cards } = generateEmpoweredDeck(gameState.deckOffer.deckType, gameState.deckOffer.empoweredCount);
    const empoweredCards = cards.filter((c) => c.isEmpowered);

    const player = { ...gameState.player, coins: gameState.player.coins - 1 };
    setGameState({
      ...gameState,
      player,
      deckType: gameState.deckOffer.deckType,
      deckCards: cards,
      screen: 'deckReveal',
      deckOffer: undefined,
      deckReveal: { deckType: gameState.deckOffer.deckType, empoweredCards },
    });
  };

  const declineDeckOffer = () => {
    if (!gameState) return;
    playSound('click');
    setGameState({ ...gameState, screen: 'world', deckOffer: undefined });
  };

  const continueDeckReveal = () => {
    if (!gameState) return;
    setGameState({ ...gameState, screen: 'world', deckReveal: undefined });
  };

  // Resets stats to their base values then re-sums every equipped item's
  // bonuses - shared by equip/unequip so the two paths can't drift apart.
  const recalculateStats = (player: Player) => {
    player.attackPower = 5;
    player.defense = 0;
    player.maxHP = 100;
    player.bonusEnergy = 0;
    player.bonusDraw = 0;

    Object.values(player.equippedItems).forEach((eq) => {
      if (eq) {
        player.attackPower += eq.bonus.attackPower || 0;
        player.defense += eq.bonus.defense || 0;
        player.maxHP += eq.bonus.maxHP || 0;
        player.bonusEnergy += eq.bonus.energyBonus || 0;
        player.bonusDraw += eq.bonus.drawBonus || 0;
      }
    });

    if (player.hp > player.maxHP) {
      player.hp = player.maxHP;
    }
  };

  const equipItem = (item: Item, slot: 'weapon' | 'armor' | 'accessory') => {
    if (!gameState) return;

    playSound('click');

    const player = { ...gameState.player };
    const unequipped = player.equippedItems[slot];

    player.equippedItems[slot] = item;
    player.inventory = player.inventory.filter((i) => i.id !== item.id);

    if (unequipped) {
      player.inventory.push(unequipped);
    }

    recalculateStats(player);
    setGameState({ ...gameState, player });
  };

  const unequipItem = (slot: 'weapon' | 'armor' | 'accessory') => {
    if (!gameState) return;

    const player = { ...gameState.player };
    const item = player.equippedItems[slot];

    if (item) {
      delete player.equippedItems[slot];
      player.inventory.push(item);
      recalculateStats(player);
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
        onClose={() => {
          playSound('click');
          setShowInventory(false);
        }}
      />
    );
  }

  if (gameState.screen === 'world') {
    return (
      <World3D
        gameState={gameState}
        onEncounter={handleEncounter}
        onLevelComplete={handleLevelComplete}
        onDeckPickup={handleDeckPickup}
        onOpenInventory={() => {
          playSound('click');
          setShowInventory(true);
        }}
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
        onMenu={resetToMenu}
      />
    );
  }

  if (gameState.screen === 'loot') {
    return <LootScreen gameState={gameState} onContinue={continueLoot} />;
  }

  if (gameState.screen === 'deckOffer') {
    return <DeckOfferScreen gameState={gameState} onSwap={swapDeck} onDecline={declineDeckOffer} />;
  }

  if (gameState.screen === 'deckReveal') {
    return <DeckRevealScreen gameState={gameState} onContinue={continueDeckReveal} />;
  }

  return null;
};
