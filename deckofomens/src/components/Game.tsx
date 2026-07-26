import React, { useEffect, useState } from 'react';
import { GameState, Card, CombatState, DeckType, DeckOffer, Enemy, Item, Player } from '../types';
import { generateDeck, generateEmpoweredDeck, generateMythicalDeck, shuffleDeck, drawCards } from '../cardData';
import { generateLoot, generateBossLoot } from '../itemData';
import { generateDeckPickups } from '../worldGen';
import { playSound } from '../audio';
import { getRandomTaunt, getRandomEnemyTaunt, getRandomVictoryLine, getRandomDefeatLine, getEnemyVoice, speak } from '../taunts';
import { saveGame, loadGame, clearSave, hasSave } from '../saveGame';
import { TitleScreen } from './TitleScreen';
import { DeckSelection } from './DeckSelection';
import { GameScreen } from './GameScreen';
import { World3D } from './World3D';
import { LootScreen } from './LootScreen';
import { InventoryScreen } from './InventoryScreen';
import { DeckOfferScreen } from './DeckOfferScreen';
import { DeckRevealScreen } from './DeckRevealScreen';

// Applies a single card's effect to a combat state and returns the updated
// copy. Shared by playCard (for the card just clicked) and the Mythical
// "Overload" card (which replays every other card in hand through the exact
// same logic, ignoring their energy cost).
function applyCardEffect(combat: CombatState, card: Card, player: Player): CombatState {
  const next = { ...combat };

  if (card.type === 'attack') {
    playSound('attack');
    const hits = card.name.includes('Assault') ? 2 : 1;
    const withGear = card.value * (1 + player.attackPercent / 100) * hits;
    const armorReduction = next.enemy.armor ? 1 - next.enemy.armor / 100 : 1;
    const damage = Math.max(1, Math.round(withGear * armorReduction));
    next.enemy = { ...next.enemy, hp: next.enemy.hp - damage };
    next.message = hits > 1 ? `Dealt ${damage} damage (2 hits)!` : `Dealt ${damage} damage!`;

    // Mythical hybrid attack cards also grant shield at the same time.
    if (card.isMythical) {
      const shield = Math.round(card.value * (1 + player.defensePercent / 100));
      next.defense += shield;
      next.message += ` Gained ${shield} armor!`;
    }

    if (card.name.includes('Pummel')) {
      const drawn = drawCards(next.deck, next.discard, 1, next.hand, next.onlyDrawEmpowered);
      next.hand = drawn.hand;
      next.deck = drawn.deck;
      next.discard = drawn.discard;
    }

    if (next.enemy.hp <= 0) {
      next.gameOver = true;
      next.playerWon = true;
      next.message = `Defeated ${next.enemy.name}!`;
      next.resultLine = getRandomVictoryLine();
      speak(next.resultLine);
    }
  } else if (card.type === 'defense') {
    playSound('defense');
    const armor = Math.round(card.value * (1 + player.defensePercent / 100));
    next.defense += armor;
    next.message = `Gained ${armor} armor!`;

    // Mythical hybrid defense cards also deal damage at the same time.
    if (card.isMythical) {
      const withGear = card.value * (1 + player.attackPercent / 100);
      const armorReduction = next.enemy.armor ? 1 - next.enemy.armor / 100 : 1;
      const damage = Math.max(1, Math.round(withGear * armorReduction));
      next.enemy = { ...next.enemy, hp: next.enemy.hp - damage };
      next.message += ` Dealt ${damage} damage!`;

      if (next.enemy.hp <= 0) {
        next.gameOver = true;
        next.playerWon = true;
        next.message = `Defeated ${next.enemy.name}!`;
        next.resultLine = getRandomVictoryLine();
        speak(next.resultLine);
      }
    }

    if (card.name.includes('Dodge')) {
      const drawn = drawCards(next.deck, next.discard, 1, next.hand, next.onlyDrawEmpowered);
      next.hand = drawn.hand;
      next.deck = drawn.deck;
      next.discard = drawn.discard;
    }

    if (card.name.includes('Fortify')) {
      next.blockNextHit = true;
      next.message += ' Next hit will be blocked!';
    }
  } else {
    playSound('utility');
    if (card.effect === 'draw' || card.effect === 'drawEnergy') {
      const drawn = drawCards(next.deck, next.discard, card.value, next.hand, next.onlyDrawEmpowered);
      next.hand = drawn.hand;
      next.deck = drawn.deck;
      next.discard = drawn.discard;
    }
    if (card.effect === 'energy') {
      next.playerEnergy += card.value;
    }
    if (card.effect === 'drawEnergy') {
      next.playerEnergy += 1;
    }
    // Mythical "Restorative Surge" - heals a percentage of max HP.
    if (card.effect === 'heal') {
      playSound('healing');
      const healAmount = Math.round(next.playerMaxHP * (card.value / 100));
      next.playerHP = Math.min(next.playerMaxHP, next.playerHP + healAmount);
      next.message = `Healed ${healAmount} HP!`;
    }
    // Mythical "Aegis" - negates every hit the enemy lands this turn,
    // checked in endTurn so it beats even a multi-attack special boss.
    if (card.effect === 'immune') {
      next.immuneThisTurn = true;
    }
    // Mythical "Ascendance" - persists for the rest of the fight, filters
    // every future draw (see drawCards' onlyEmpowered param).
    if (card.effect === 'empoweredDraws') {
      next.onlyDrawEmpowered = true;
    }
    if (card.effect !== 'heal') {
      next.message = card.description;
    }
  }

  return next;
}

export const Game: React.FC = () => {
  // Never auto-load on mount - the title screen is always what decides
  // whether to resume a save or start fresh, even if one exists.
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [view, setView] = useState<'title' | 'deckSelect'>('title');

  useEffect(() => {
    if (gameState) saveGame(gameState);
  }, [gameState]);

  // Death is a full reset - permadeath back to deck selection, no carrying
  // progress, inventory, or bossTier over into the next run.
  const resetToMenu = () => {
    clearSave();
    setGameState(null);
    setView('title');
  };

  const initializeGame = (deckType: DeckType) => {
    const initialPlayer: Player = {
      level: 1,
      experience: 0,
      maxHP: 100,
      hp: 100,
      attackPercent: 0,
      defensePercent: 0,
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
      playerPosition: { x: 0, z: 0 },
      deckPickups: generateDeckPickups(1),
      defeatedEnemyIds: [],
      collectedDeckIds: [],
    };

    setGameState(state);
  };

  const startCombat = (enemy: Enemy, position: { x: number; z: number }) => {
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
    newState.worldPosition = gameState.worldPosition + 1;
    newState.playerPosition = position;
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

    let combat = { ...gameState.combat };
    combat.playerEnergy -= cardCost;
    combat.hand = combat.hand.filter((c) => c.id !== card.id);
    combat.discard = [...combat.discard, card];
    combat.message = '';

    combat = applyCardEffect(combat, card, gameState.player);

    // Mythical "Overload" - plays every remaining card in hand through the
    // same logic, ignoring their energy cost entirely.
    if (card.effect === 'playAll') {
      const remaining = combat.hand;
      combat.hand = [];
      for (const handCard of remaining) {
        if (combat.gameOver) {
          combat.discard = [...combat.discard, handCard];
          continue;
        }
        combat.discard = [...combat.discard, handCard];
        combat = applyCardEffect(combat, handCard, gameState.player);
      }
      combat.message = 'Played every card in hand!';
    }

    setGameState({ ...gameState, combat });
  };

  const endTurn = () => {
    if (!gameState?.combat || gameState.combat.gameOver) return;

    const combat = { ...gameState.combat };
    const defense = combat.defense;
    combat.defense = 0;
    combat.turn += 1;

    // Special bosses can attack more than once per turn - Fortify's block
    // only negates one of those hits, the rest still land. Mythical "Aegis"
    // (immuneThisTurn) negates every hit outright, before any of that math.
    const wasImmune = !!combat.immuneThisTurn;
    combat.immuneThisTurn = false;
    const attacksPerTurn = combat.enemy.attacksPerTurn ?? 1;
    const enemyDamage = combat.enemy.nextIntentDamage;
    let totalDamage = 0;
    let blockedAHit = false;

    if (!wasImmune) {
      for (let i = 0; i < attacksPerTurn; i++) {
        if (combat.blockNextHit && !blockedAHit) {
          blockedAHit = true;
          continue;
        }
        totalDamage += Math.max(1, enemyDamage - defense);
      }
    }
    combat.blockNextHit = false;

    playSound(wasImmune || (blockedAHit && !totalDamage) ? 'defense' : 'damage');
    combat.playerHP -= totalDamage;
    combat.message = wasImmune
      ? 'Aegis made you immune to all damage this turn!'
      : blockedAHit
      ? `Fortify blocked one hit! Took ${totalDamage} damage${attacksPerTurn > 1 ? ' from the rest' : ''}.`
      : `${combat.enemy.name} dealt ${totalDamage} damage${attacksPerTurn > 1 ? ` (${attacksPerTurn} hits)` : ''}!`;

    if (combat.playerHP <= 0) {
      playSound('defeat');
      combat.gameOver = true;
      combat.playerWon = false;
      combat.message = `${combat.enemy.name} dealt ${totalDamage} damage. You were defeated!`;
      combat.resultLine = getRandomDefeatLine();
      speak(combat.resultLine, { pitch: 1.3, rate: 0.85 });
    } else {
      const nextIntents = [6, 8, 10, 12, 15, 18, 20];
      combat.enemy.nextIntentDamage =
        nextIntents[Math.floor(Math.random() * nextIntents.length)];
    }

    const drawCount = 5 + gameState.player.bonusDraw;
    const { hand, deck, discard } = drawCards(combat.deck, combat.discard, drawCount, [], combat.onlyDrawEmpowered);
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
    // Special bosses drop loot rolled a level higher than they actually are.
    const lootLevel = enemy.isSpecialBoss ? enemy.level + 1 : enemy.level;
    const items = isBoss ? generateBossLoot(lootLevel) : generateLoot(lootLevel);
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
    } else {
      // Regular enemies despawn permanently once killed - the boss doesn't
      // need this since advancing bossTier already relocates it elsewhere.
      nextState.defeatedEnemyIds = [...gameState.defeatedEnemyIds, enemy.id];
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
    nextState.playerPosition = { x: 0, z: 0 };
    nextState.player.level += 1;
    nextState.player.maxHP += 10;
    nextState.player.hp = nextState.player.maxHP;
    nextState.deckPickups = generateDeckPickups(nextState.currentLevel);
    nextState.defeatedEnemyIds = [];
    nextState.collectedDeckIds = [];

    setGameState(nextState);
  };

  const handleDeckPickup = (offer: DeckOffer, position: { x: number; z: number }) => {
    if (!gameState) return;
    playSound('pickup');
    setGameState({ ...gameState, screen: 'deckOffer', deckOffer: offer, playerPosition: position });
  };

  const swapDeck = () => {
    if (!gameState?.deckOffer || gameState.player.coins < 1) return;

    playSound('levelup');

    const player = { ...gameState.player, coins: gameState.player.coins - 1 };
    const claimedId = gameState.deckOffer.id;

    if (gameState.deckOffer.isMythical) {
      const { cards, mythicalCard } = generateMythicalDeck();
      setGameState({
        ...gameState,
        player,
        deckType: 'balanced',
        deckCards: cards,
        screen: 'deckReveal',
        deckOffer: undefined,
        deckReveal: { deckType: 'balanced', empoweredCards: [], isMythical: true, mythicalCard },
        collectedDeckIds: [...gameState.collectedDeckIds, claimedId],
      });
      return;
    }

    const { cards } = generateEmpoweredDeck(gameState.deckOffer.deckType, gameState.deckOffer.empoweredCount);
    const empoweredCards = cards.filter((c) => c.isEmpowered);

    setGameState({
      ...gameState,
      player,
      deckType: gameState.deckOffer.deckType,
      deckCards: cards,
      screen: 'deckReveal',
      deckOffer: undefined,
      deckReveal: { deckType: gameState.deckOffer.deckType, empoweredCards },
      // Claimed - despawns permanently. Declining leaves it untouched so it
      // stays there for next time.
      collectedDeckIds: [...gameState.collectedDeckIds, claimedId],
    });
  };

  const declineDeckOffer = () => {
    if (!gameState?.deckOffer) return;
    playSound('click');

    // Declining leaves the pickup in place, and the player is still
    // standing inside its trigger radius - without pushing them back, the
    // next mount immediately re-collides and pops the same offer right back
    // up, forever. Push them away from the pickup, past the radius.
    const pickup = gameState.deckPickups.find((p) => p.id === gameState.deckOffer!.id);
    let playerPosition = gameState.playerPosition;

    if (pickup) {
      const dx = gameState.playerPosition.x - pickup.x;
      const dz = gameState.playerPosition.z - pickup.z;
      const dist = Math.hypot(dx, dz);
      const pushDistance = 6; // clears the 4-unit trigger radius with room to spare

      playerPosition =
        dist > 0.01
          ? { x: pickup.x + (dx / dist) * pushDistance, z: pickup.z + (dz / dist) * pushDistance }
          : { x: pickup.x, z: pickup.z + pushDistance };
    }

    setGameState({ ...gameState, screen: 'world', deckOffer: undefined, playerPosition });
  };

  const continueDeckReveal = () => {
    if (!gameState) return;
    setGameState({ ...gameState, screen: 'world', deckReveal: undefined });
  };

  // Resets stats to their base values then re-sums every equipped item's
  // bonuses - shared by equip/unequip so the two paths can't drift apart.
  const recalculateStats = (player: Player) => {
    player.attackPercent = 0;
    player.defensePercent = 0;
    player.maxHP = 100;
    player.bonusEnergy = 0;
    player.bonusDraw = 0;

    Object.values(player.equippedItems).forEach((eq) => {
      if (eq) {
        player.attackPercent += eq.bonus.attackPercent || 0;
        player.defensePercent += eq.bonus.defensePercent || 0;
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
    if (view === 'title') {
      return (
        <TitleScreen
          hasSave={hasSave()}
          onNewGame={() => setView('deckSelect')}
          onContinue={() => {
            const saved = loadGame();
            if (saved) setGameState(saved);
          }}
        />
      );
    }
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
        onEncounter={startCombat}
        onLevelComplete={handleLevelComplete}
        onDeckPickup={handleDeckPickup}
        onOpenInventory={(position) => {
          playSound('click');
          setGameState({ ...gameState, playerPosition: position });
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
