const PLAYER_TAUNTS = [
  "Let's duel!",
  "You're going down!",
  "I'm all fired up!",
  "This ends now!",
  "Bring it on!",
  "I won't lose this one!",
  "Time to show my strength!",
  "You picked the wrong fight!",
  "En garde!",
  "Get ready for a beating!",
];

export function getRandomTaunt(): string {
  return PLAYER_TAUNTS[Math.floor(Math.random() * PLAYER_TAUNTS.length)];
}

export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    // speech synthesis unavailable - the on-screen speech bubble still shows
  }
}
