// Spoken civilian voice lines via the browser SpeechSynthesis API — real
// speech, no audio files. Globally throttled so the street doesn't become a
// cacophony, with randomized pitch/rate per utterance for variety.
const GREET = [
  "Hey there.", "Morning!", "How's it going?", "Lovely day, isn't it?",
  "Hello.", "Good to see ya.", "Afternoon.", "Hiya.",
];
const ABUSE = [
  "Hey, watch it!", "Get outta my way!", "What's your problem?!",
  "Rude!", "Move it, pal!", "Hey! Eyes up!", "You blind?!",
];
const EMPATHY = [
  "Oh my god!", "Somebody help!", "That poor person!", "Call the police!",
  "This is horrible!", "Are you okay?!", "Help, please!",
];
const FARMER = [
  "Hey! My crops!", "Get off my land!", "Thief! Thief!", "Those are my vegetables!",
  "Oi! Hands off!", "I'm calling the cops!", "You little crook!",
];

export class Voice {
  private last = 0;
  private enabled = typeof window !== "undefined" && "speechSynthesis" in window;

  private say(lines: string[], minGap = 1300) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.last < minGap) return;
    if (window.speechSynthesis.speaking) return;
    this.last = now;
    const u = new SpeechSynthesisUtterance(lines[(Math.random() * lines.length) | 0]);
    u.pitch = 0.6 + Math.random() * 0.8;
    u.rate = 0.9 + Math.random() * 0.4;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
  }

  greet() { this.say(GREET); }
  abuse() { this.say(ABUSE); }
  empathy() { this.say(EMPATHY); }
  farmer() { this.say(FARMER, 800); } // farmers get priority — they're yelling
}
