# Phonemic — paste text, get IPA back in the same shape

A single-page web app that converts raw English text into IPA (or ARPAbet, or
plain-English respelling) while preserving the original structure exactly:
line breaks, indentation, spacing and punctuation all come through untouched —
only the words are converted.

Open `index.html`. No build step, no server, no network calls.

## What it does

- **Three accents** — General American, British RP, NZ/Australian. Non-rhotic
  accents drop coda /r/ properly (`car` → `kɑː`), keep linking /r/ before a
  vowel, and use the right vowel for each lexical set (`lot` is `ɒ` in RP but
  `ɑ` in GA).
- **Five notations** — IPA, CMU-style ARPAbet (`F AH0 N EH1 T IH0 K S`), a
  dictionary-style respelling (`fuh-NE-tiks`), **sound-alike spelling**, which
  rewrites each word as a different spelling that reads the same
  (*I know their time is right* → *Eye no there thyme iz write*), and
  **typos**, which misspells each word so subtly that it still sounds
  identical: *an independent government tomorrow* → *an independant
  governmant tommorrow*.
- **Three layouts** — in place, original word above its transcription, or
  aligned monospace columns.
- **Options** — stress marks, syllable dots, narrow transcription
  (aspiration `tʰ`, flapping `ɾ`, dark `ɫ`, syllabic `l̩ n̩`), weak forms for
  function words, and numbers read out as words (`42` → `ˈfɔɹti tu`).
- **Length filter** — transcribe only words longer (or shorter) than N
  letters, leaving the rest in their original spelling. Useful for glossing
  just the hard words in a passage.
- **Advanced rules** — mix notations in one pass by word length. Each rule is
  a letter-count band (either end optional) pointing at a notation, checked
  top to bottom with first match winning; unmatched words fall back to the
  main Notation setting. So *1–3 letters → sound-alike, 4–6 → leave alone,
  7+ → IPA* gives:

  > Thuh quick brown foks jumps over un ˈɛkstɹəɔɹdɪnəɹɪli lazy daug.

  Rules replace the simple length filter while any exist, and persist between
  sessions.
- Words sounded out by rule rather than looked up are underlined, so you can
  see which transcriptions are estimates.

## How the transcription works

Two stages, in `src/`:

1. **`ipa-data.js` — lexicon.** Around 400 hand-written entries covering the
   words English spelling lies about (*colonel, yacht, though, Wednesday,
   women*), all the common function words with both strong and weak forms, and
   contractions. Regular inflections (`-s -es -ed -ing -ly`) are derived from
   their base entry with the correct voicing, so `laughed` → `L AE F T`.

2. **`ipa.js` — letter-to-sound rules.** Everything not in the lexicon is
   sounded out with the NRL ruleset (Elovitz et al., 1976), ~340 ordered
   context-sensitive rules of the form `LEFT[MATCH]RIGHT=PHONEMES`. Context
   matching backtracks, which the original description glosses over but which
   real words need — a greedy `:` in `#^:[Y] ` never matches *study*.

   Phonemes then go through stress assignment (suffix-driven, e.g. `-tion`
   pulls stress to the penult; `-ity` to the antepenult), vowel reduction to
   schwa in unstressed syllables, maximal-onset syllabification, and finally
   the accent-specific IPA mapping.

Rule-derived pronunciations land in the right neighbourhood the large majority
of the time, but stress in particular is a guess — English stress is not
recoverable from spelling. That's what the underline marks.

**Sound-alike spelling** has three outcomes per word, distinguished in the
output. A curated list of ~250 homophone groups is checked first, so real
words win (*time → thyme*, *rough → ruff*, *would → wood*). Failing that the
word is respelled from its phonemes using a grapheme table whose first choice
is always the plainest option — that's what produces the simplified-spelling
look (*kwik, broun, skool, byootiful, luv*); those are underlined as invented.
If the plainest respelling is what English already uses (*jumps*, *speech*),
the word is left as-is in grey, because forcing a difference there only yields
noise like *speach*.

**Typos** works the other way round: instead of respelling from the sounds, it
mutates the spelling and then checks the sound. Candidates are generated
liberally — an unstressed vowel written as another vowel (*grammer*), the
endings English can't keep straight (*independant*, *docter*), a doubled
consonant added or lost (*tommorrow*, *ocurred*), a letter dropped inside a
consonant cluster (*quik*) — and each one is sounded out by the letter-to-sound
rules with the lexicon switched off, so like is compared with like. It survives
only if it lands on exactly the same syllables, vowels and stress. That check
is what lets *definately* through, rejects *definate* (which the rules read as
*def-in-ATE*), and stops *later* becoming *latter*. Candidates that are
recognisably other words are dropped too, so *hears* never comes back as
*heirs* — though the lexicon only holds English's irregulars, so that guard is
best-effort. Words of three letters or fewer are never touched, and words where
no slip survives the check are left alone in grey.

## Files

```
index.html        markup + styles
src/ipa-data.js   lexicon, weak forms, letter-to-sound rules, number words
src/ipa.js        engine: rules, stress, syllables, accents, renderers
src/app.js        UI wiring, layouts, stats, copy/save
test/smoke.cjs     node test/smoke.cjs — prints transcriptions, asserts key cases
```

## Test

```
node test/smoke.cjs
```

Prints sample transcriptions for eyeballing and asserts a handful of cases
that must not regress (rhotic vs non-rhotic, structure preservation, stress on
*phonetics*, number expansion).
