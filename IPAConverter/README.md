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
- **Three notations** — IPA, CMU-style ARPAbet (`F AH0 N EH1 T IH0 K S`), and
  a dictionary-style respelling (`fuh-NE-tiks`).
- **Three layouts** — in place, original word above its transcription, or
  aligned monospace columns.
- **Options** — stress marks, syllable dots, narrow transcription
  (aspiration `tʰ`, flapping `ɾ`, dark `ɫ`, syllabic `l̩ n̩`), weak forms for
  function words, and numbers read out as words (`42` → `ˈfɔɹti tu`).
- **Length filter** — transcribe only words longer (or shorter) than N
  letters, leaving the rest in their original spelling. Useful for glossing
  just the hard words in a passage.
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
