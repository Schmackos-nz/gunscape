/* Quick smoke test: node test/smoke.js
 * Prints transcriptions so mistakes are eyeballable, and asserts a few
 * cases that must not regress. */
var path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'src', 'ipa-data.js'));
require(path.join(__dirname, '..', 'src', 'ipa.js'));
var IPA = global.IPA;

function conv(text, opts) {
  return IPA.tokensToText(IPA.transcribe(text, opts));
}

var samples = [
  'The quick brown fox jumps over the lazy dog.',
  'Phonetics is the study of speech sounds.',
  "Hello, world! I don't know what you're talking about.",
  'She thought the rough cough might last through the night.',
  'Colonel Wednesday bought forty-two chocolate croissants.',
  'A yacht, an island, and a subtle receipt.',
  'photography biology information nation logical activity',
  'water butter city better little bottle',
  'car park doctor here nearer sure four floor',
  'Line one.\n  Indented line two.\n\nParagraph three: 1,234.5 items!'
];

console.log('=== General American (broad IPA) ===');
samples.forEach(function (s) {
  console.log('  ' + JSON.stringify(s));
  console.log('   -> ' + conv(s));
});

console.log('\n=== British RP ===');
['car park doctor here nearer sure four floor', 'a bath of water in the garage']
  .forEach(function (s) { console.log('  ' + s + '\n   -> ' + conv(s, { accent: 'rp' })); });

console.log('\n=== NZ / Australian ===');
console.log('  ' + conv('six fish and chips in the kitchen', { accent: 'nz' }));

console.log('\n=== Narrow (GA) ===');
console.log('  ' + conv('water bottle potato little top', { narrow: true }));

console.log('\n=== ARPAbet ===');
console.log('  ' + conv('phonetics is amazing', { notation: 'arpabet' }));

console.log('\n=== Respelling ===');
console.log('  ' + conv('phonetics is amazing', { notation: 'respell' }));

console.log('\n=== Syllable breaks + weak forms ===');
console.log('  ' + conv('a bottle of water for the doctor',
  { syllableBreaks: true, weakForms: true }));

// ---- assertions
var fails = 0;
function eq(got, want, label) {
  if (got !== want) { console.log('FAIL ' + label + '\n  got  ' + got + '\n  want ' + want); fails++; }
}
eq(conv('dog'), 'dɔɡ', 'dog');
eq(conv('the'), 'ðə', 'the');
eq(conv('cat'), 'kæt', 'cat');
eq(conv('phonetics'), 'fəˈnɛtɪks', 'phonetics');
eq(conv('Hello,  world!\n'), 'həˈloʊ,  wɝld!\n', 'structure preserved');
eq(conv('  spaced  '), '  speɪst  ', 'padding preserved');
eq(conv('car', { accent: 'rp' }), 'kɑː', 'RP non-rhotic car');
eq(conv('car', { accent: 'ga' }), 'kɑɹ', 'GA rhotic car');
eq(conv('study'), 'ˈstʌdi', 'study');
eq(conv('city'), 'ˈsɪti', 'city');
eq(conv('42', { notation: 'respell' }), 'FAWR-tee too', 'number expansion');

console.log(fails ? '\n' + fails + ' assertion(s) failed.' : '\nAll assertions passed.');
