/* ipa.js — the transcription engine.
 *
 * Pipeline:  text -> tokens -> (lexicon | letter-to-sound rules) -> phonemes
 *            -> stress -> vowel reduction -> syllables -> accent mapping
 *            -> IPA / ARPAbet / respelling
 *
 * Structure is preserved by design: only word tokens are converted, every
 * space, newline and punctuation mark is copied through untouched.
 */
(function (root) {
  'use strict';

  var D = root.IPA_DATA;

  var VOWELS = {
    AA: 1, AE: 1, AH: 1, AO: 1, AW: 1, AY: 1, EH: 1, ER: 1, EY: 1, IH: 1,
    IY: 1, OW: 1, OY: 1, UH: 1, UW: 1, AX: 1, IX: 1, Q: 1
  };

  function isVowelPhone(p) { return !!VOWELS[p]; }

  // ------------------------------------------------------------ rule parsing
  var COMPILED = null;

  function compileRules() {
    COMPILED = {};
    Object.keys(D.RULES).forEach(function (letter) {
      COMPILED[letter] = D.RULES[letter].map(function (raw) {
        var open = raw.indexOf('[');
        var close = raw.indexOf(']', open);
        var eq = raw.indexOf('=', close);
        var phones = raw.slice(eq + 1).trim();
        return {
          left: raw.slice(0, open),
          match: raw.slice(open + 1, close),
          right: raw.slice(close + 1, eq),
          phones: phones ? phones.split(/\s+/) : [],
          raw: raw
        };
      });
    });
  }

  var LETTER_VOWELS = 'AEIOUY';
  var FRONT = 'EIY';
  var VOICED = 'BDVGJLMNRWZ';
  var SIBILANT = 'SCGZXJ';
  var LONG_U_CONS = 'TSRDLZNJ';
  var SUFFIXES = ['ING', 'ELY', 'ED', 'ER', 'ES', 'E'];

  function isLetter(c) { return c >= 'A' && c <= 'Z'; }
  function isLetterVowel(c) { return LETTER_VOWELS.indexOf(c) >= 0; }
  function isLetterCons(c) { return isLetter(c) && LETTER_VOWELS.indexOf(c) < 0; }

  /* Context matching. `:` (zero or more consonants) and `#` (one or more
   * vowels) are variable width, so both directions backtrack — without it
   * "#^:[Y] " never matches STUDY, because a greedy ":" eats the D that "^"
   * needs. dir is +1 walking right, -1 walking left. */
  function matchCtx(text, start, pat, dir) {
    var at = function (k) { return (k < 0 || k >= text.length) ? ' ' : text[k]; };
    // when walking left, patterns are consumed from the end
    var pIdx = function (n) { return dir > 0 ? n : pat.length - 1 - n; };
    var cur = function (i) { return at(dir > 0 ? i : i - 1); };
    var ahead = function (i, k) { return at(dir > 0 ? i + k : i - 1 - k); };

    function rec(i, n) {
      if (n >= pat.length) return true;
      var c = pat[pIdx(n)];
      if (c === ':') {
        var j = 0;
        for (;;) {
          if (rec(i + dir * j, n + 1)) return true;
          if (!isLetterCons(cur(i + dir * j))) return false;
          if (++j > 6) return false;
        }
      }
      if (c === '#') {
        var run = 0;
        while (isLetterVowel(cur(i + dir * run)) && run < 6) run++;
        for (var k = run; k >= 1; k--) if (rec(i + dir * k, n + 1)) return true;
        return false;
      }
      if (c === '^') {
        return isLetterCons(cur(i)) && rec(i + dir, n + 1);
      }
      if (c === '.') {
        return VOICED.indexOf(cur(i)) >= 0 && rec(i + dir, n + 1);
      }
      if (c === '+') {
        return FRONT.indexOf(cur(i)) >= 0 && rec(i + dir, n + 1);
      }
      if (c === '&') {
        if (SIBILANT.indexOf(cur(i)) >= 0 && rec(i + dir, n + 1)) return true;
        // digraphs CH / SH, read in whichever direction we are travelling
        var a = dir > 0 ? cur(i) : ahead(i, 1);
        var b = dir > 0 ? ahead(i, 1) : cur(i);
        if (b === 'H' && (a === 'C' || a === 'S')) return rec(i + dir * 2, n + 1);
        return false;
      }
      if (c === '@') {
        if (LONG_U_CONS.indexOf(cur(i)) >= 0 && rec(i + dir, n + 1)) return true;
        var a2 = dir > 0 ? cur(i) : ahead(i, 1);
        var b2 = dir > 0 ? ahead(i, 1) : cur(i);
        if (b2 === 'H' && 'TCS'.indexOf(a2) >= 0) return rec(i + dir * 2, n + 1);
        return false;
      }
      if (c === '%') {
        for (var s = 0; s < SUFFIXES.length; s++) {
          var suf = SUFFIXES[s];
          var ok = true;
          for (var q = 0; q < suf.length; q++) {
            var ch = dir > 0 ? ahead(i, q) : ahead(i, suf.length - 1 - q);
            if (ch !== suf[q]) { ok = false; break; }
          }
          if (ok && rec(i + dir * suf.length, n + 1)) return true;
        }
        return false;
      }
      return cur(i) === c && rec(i + dir, n + 1);
    }
    return rec(start, 0);
  }

  function matchRight(text, pos, pat) { return matchCtx(text, pos, pat, 1); }
  function matchLeft(text, pos, pat) { return matchCtx(text, pos, pat, -1); }

  // Letter-to-sound: uppercase alphabetic word -> array of phoneme strings.
  function rulesToPhones(word) {
    if (!COMPILED) compileRules();
    var text = ' ' + word + ' ';
    var out = [];
    var pos = 1;
    var guard = 0;
    while (pos < text.length - 1 && guard++ < 400) {
      var c = text[pos];
      var group = COMPILED[c];
      if (!group) { pos++; continue; }
      var applied = false;
      for (var r = 0; r < group.length; r++) {
        var rule = group[r];
        if (text.substr(pos, rule.match.length) !== rule.match) continue;
        if (rule.left && !matchLeft(text, pos, rule.left)) continue;
        if (rule.right && !matchRight(text, pos + rule.match.length, rule.right)) continue;
        for (var k = 0; k < rule.phones.length; k++) out.push(rule.phones[k]);
        pos += rule.match.length;
        applied = true;
        break;
      }
      if (!applied) pos++;
    }
    return out;
  }

  // ------------------------------------------------------------------ stress
  function vowelIndexes(phones) {
    var idx = [];
    for (var i = 0; i < phones.length; i++) if (isVowelPhone(phones[i])) idx.push(i);
    return idx;
  }

  var PREFIXES = ['be', 'con', 'com', 'dis', 'em', 'en', 'ex', 'im', 'in',
    'ob', 'per', 'pre', 'pro', 'sub', 'sur'];

  // Heuristic English stress placement. Returns the syllable number to stress.
  function guessStressSyllable(word, nSyl) {
    var w = word.toLowerCase();
    if (nSyl < 2) return 0;
    var pick = function (n) { return Math.max(0, Math.min(nSyl - 1, n)); };

    if (/(ically)$/.test(w)) return pick(nSyl - 4);
    if (/(ical|icals)$/.test(w)) return pick(nSyl - 3);
    if (/(tion|sion|cion|cian|tial|cial|cious|tious|geous|gion|gious)s?$/.test(w)) return pick(nSyl - 2);
    if (/(ic|ics|ically)$/.test(w)) return pick(nSyl - 2);
    if (/(ity|ities|ety|ogy|ogies|logy|graphy|nomy|cracy|metry|tomy|ular|ulous|imous|inous)$/.test(w)) return pick(nSyl - 3);
    if (/(ee|eer|ese|ette|esque|oon|aire)s?$/.test(w)) return pick(nSyl - 1);
    if (nSyl >= 3 && /(ate|ates|ated|ating|ise|ize|ises|izes|ising|izing|ify|ifies)$/.test(w)) return pick(nSyl - 3);

    for (var i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i];
      if (w.length > p.length + 2 && w.slice(0, p.length) === p) {
        // only when the prefix is followed by exactly one consonant + a vowel
        var rest = w.slice(p.length);
        if (/^[^aeiouy][aeiouy]/.test(rest)) return pick(1);
      }
    }
    return 0;
  }

  // ------------------------------------------------------------ syllabifying
  var LEGAL_ONSETS = {};
  ['P L', 'P R', 'B L', 'B R', 'T R', 'T W', 'D R', 'D W', 'K L', 'K R',
    'K W', 'G L', 'G R', 'F L', 'F R', 'TH R', 'TH W', 'SH R', 'S L', 'S P',
    'S T', 'S K', 'S M', 'S N', 'S W', 'S F', 'HH W', 'V R', 'S P L', 'S P R',
    'S T R', 'S K R', 'S K W', 'P Y', 'B Y', 'K Y', 'G Y', 'F Y', 'V Y',
    'M Y', 'N Y', 'HH Y', 'L Y', 'S Y', 'T Y', 'D Y', 'TH Y'
  ].forEach(function (o) { LEGAL_ONSETS[o] = 1; });

  function legalOnset(arr) {
    if (arr.length <= 1) return true;
    return !!LEGAL_ONSETS[arr.join(' ')];
  }

  /* Split a phoneme array into syllables using maximal onset.
   * Each syllable: { onset:[], nucleus:'AA', coda:[], stress:0|1 } */
  function syllabify(phones) {
    var vIdx = vowelIndexes(phones);
    if (!vIdx.length) {
      return [{ onset: phones.slice(), nucleus: null, coda: [], stress: 0 }];
    }
    var syls = [];
    for (var s = 0; s < vIdx.length; s++) {
      var v = vIdx[s];
      var prevV = s === 0 ? -1 : vIdx[s - 1];
      var nextV = s === vIdx.length - 1 ? phones.length : vIdx[s + 1];
      // consonants between previous nucleus and this one
      var run = phones.slice(prevV + 1, v);
      var onset;
      if (s === 0) {
        onset = run;
      } else {
        // maximal onset: give the longest legal tail of the run to this onset
        var take = 0;
        for (var t = Math.min(3, run.length); t >= 1; t--) {
          if (legalOnset(run.slice(run.length - t))) { take = t; break; }
        }
        onset = run.slice(run.length - take);
        var coda = run.slice(0, run.length - take);
        for (var c = 0; c < coda.length; c++) syls[syls.length - 1].coda.push(coda[c]);
      }
      var tail = (s === vIdx.length - 1) ? phones.slice(v + 1) : [];
      syls.push({ onset: onset, nucleus: phones[v], coda: tail, stress: 0 });
    }
    return syls;
  }

  // ------------------------------------------------------------ accent maps
  var CONS = {
    B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ',
    K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ', S: 's',
    SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', WH: 'w', Y: 'j', Z: 'z',
    ZH: 'ʒ'
  };

  var ACCENTS = {
    ga: {
      name: 'General American',
      rhotic: true,
      r: 'ɹ',
      v: {
        AA: 'ɑ', Q: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
        EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ',
        UH: 'ʊ', UW: 'u', AX: 'ə', IX: 'ɪ'
      },
      unstressedER: 'ɚ',
      flapping: true
    },
    rp: {
      name: 'British (RP)',
      rhotic: false,
      r: 'r',
      v: {
        AA: 'ɑː', Q: 'ɒ', AE: 'æ', AH: 'ʌ', AO: 'ɔː', AW: 'aʊ', AY: 'aɪ',
        EH: 'e', ER: 'ɜː', EY: 'eɪ', IH: 'ɪ', IY: 'iː', OW: 'əʊ', OY: 'ɔɪ',
        UH: 'ʊ', UW: 'uː', AX: 'ə', IX: 'ɪ'
      },
      unstressedER: 'ə',
      rComb: {
        AA: 'ɑː', Q: 'ɔː', AO: 'ɔː', ER: 'ɜː', AX: 'ə', AE: 'ɑː', AH: 'ɜː',
        EH: 'eə', IH: 'ɪə', IY: 'ɪə', EY: 'eə', AY: 'aɪə', AW: 'aʊə',
        OW: 'ɔː', OY: 'ɔɪə', UH: 'ʊə', UW: 'ʊə', IX: 'ɪə'
      },
      flapping: false
    },
    nz: {
      name: 'New Zealand / Australian',
      rhotic: false,
      r: 'ɹ',
      v: {
        AA: 'ɐː', Q: 'ɒ', AE: 'ɛ', AH: 'ɐ', AO: 'ɔː', AW: 'æo', AY: 'ɑe',
        EH: 'e', ER: 'ɵː', EY: 'æɪ', IH: 'ɨ', IY: 'iː', OW: 'ɐʊ', OY: 'oe',
        UH: 'ʊ', UW: 'ʉː', AX: 'ə', IX: 'ɨ'
      },
      unstressedER: 'ə',
      rComb: {
        AA: 'ɐː', Q: 'ɔː', AO: 'ɔː', ER: 'ɵː', AX: 'ə', AE: 'ɐː', AH: 'ɵː',
        EH: 'eə', IH: 'iə', IY: 'iə', EY: 'eə', AY: 'ɑeə', AW: 'æoə',
        OW: 'ɔː', OY: 'oeə', UH: 'ʉə', UW: 'ʉə', IX: 'iə'
      },
      flapping: false
    }
  };

  var RESPELL_V = {
    AA: 'ah', Q: 'o', AE: 'a', AH: 'uh', AO: 'aw', AW: 'ow', AY: 'y',
    EH: 'e', ER: 'ur', EY: 'ay', IH: 'i', IY: 'ee', OW: 'oh', OY: 'oy',
    UH: 'uu', UW: 'oo', AX: 'uh', IX: 'i'
  };
  var RESPELL_C = {
    B: 'b', CH: 'ch', D: 'd', DH: 'th', F: 'f', G: 'g', HH: 'h', JH: 'j',
    K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ng', P: 'p', R: 'r', S: 's',
    SH: 'sh', T: 't', TH: 'th', V: 'v', W: 'w', WH: 'wh', Y: 'y', Z: 'z',
    ZH: 'zh'
  };

  // ------------------------------------------------------------- word lookup
  var COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');
  function stripDiacritics(s) {
    return s.normalize ? s.normalize('NFD').replace(COMBINING, '') : s;
  }

  /* Returns { phones:[...], stressSyl:int|null, source:'lexicon'|'rules' } */
  function lookupWord(word, opts) {
    var key = stripDiacritics(word).toLowerCase().replace(/’/g, "'");
    var entry = null;
    var source = 'rules';
    if (opts.weakForms && D.WEAK[key]) { entry = D.WEAK[key]; source = 'lexicon'; }
    if (!entry && D.LEXICON[key]) { entry = D.LEXICON[key]; source = 'lexicon'; }

    // regular inflections of a lexicon entry: -s, -es, -ed, -ing, -ly
    if (!entry) {
      var infl = inflect(key);
      if (infl) { entry = infl.phones; source = 'lexicon'; }
    }

    var phones, stressAt = null;
    if (entry) {
      phones = entry.split(/\s+/).map(function (p, i) {
        if (/1$/.test(p)) { stressAt = i; return p.slice(0, -1); }
        return p.replace(/[0-9]$/, '');
      });
    } else {
      var up = stripDiacritics(word).toUpperCase().replace(/['’]/g, '');
      phones = rulesToPhones(up);
    }
    return { phones: phones, stressPhone: stressAt, source: source };
  }

  var VOICELESS = { P: 1, T: 1, K: 1, F: 1, TH: 1, S: 1, SH: 1, CH: 1, HH: 1 };

  function inflect(key) {
    var tries = [];
    if (/ies$/.test(key)) tries.push([key.slice(0, -3) + 'y', 'Z']);
    if (/ied$/.test(key)) tries.push([key.slice(0, -3) + 'y', 'D']);
    if (/es$/.test(key)) tries.push([key.slice(0, -2), 'ES']);
    if (/s$/.test(key)) tries.push([key.slice(0, -1), 'S']);
    if (/ed$/.test(key)) tries.push([key.slice(0, -2), 'ED'], [key.slice(0, -1), 'ED']);
    if (/ing$/.test(key)) tries.push([key.slice(0, -3), 'ING'], [key.slice(0, -3) + 'e', 'ING']);
    if (/ly$/.test(key)) tries.push([key.slice(0, -2), 'LY']);
    for (var i = 0; i < tries.length; i++) {
      var base = tries[i][0], kind = tries[i][1];
      var e = D.LEXICON[base];
      if (!e) continue;
      var parts = e.split(/\s+/);
      var last = parts[parts.length - 1].replace(/[0-9]$/, '');
      if (kind === 'S' || kind === 'Z' || kind === 'ES') {
        if (kind === 'ES' && /^(S|Z|SH|ZH|CH|JH)$/.test(last)) parts.push('IH', 'Z');
        else if (/^(S|Z|SH|ZH|CH|JH)$/.test(last)) parts.push('IH', 'Z');
        else parts.push(VOICELESS[last] ? 'S' : 'Z');
      } else if (kind === 'D') {
        parts.push('D');
      } else if (kind === 'ED') {
        if (last === 'T' || last === 'D') parts.push('IH', 'D');
        else parts.push(VOICELESS[last] ? 'T' : 'D');
      } else if (kind === 'ING') {
        parts.push('IH', 'NG');
      } else if (kind === 'LY') {
        parts.push('L', 'IY');
      }
      return { phones: parts.join(' ') };
    }
    return null;
  }

  // ---------------------------------------------------------- word rendering
  function buildWord(word, opts) {
    var got = lookupWord(word, opts);
    var phones = got.phones.filter(function (p) { return !!p; });
    if (!phones.length) return null;

    var syls = syllabify(phones);
    var nSyl = syls.length;

    // stress placement
    var stressSyl = 0;
    if (got.stressPhone !== null) {
      var seen = -1;
      for (var i = 0; i < syls.length; i++) {
        // index of this syllable's nucleus inside phones
        seen += syls[i].onset.length + 1;
        var nucleusIdx = seen;
        seen += syls[i].coda.length;
        if (nucleusIdx >= got.stressPhone) { stressSyl = i; break; }
      }
    } else {
      stressSyl = guessStressSyllable(word, nSyl);
    }
    syls.forEach(function (s, i) { s.stress = (i === stressSyl) ? 1 : 0; });

    /* Vowel reduction. English unstressed syllables collapse towards schwa;
     * without this everything reads like a robot spelling words out.
     *   AH  -> always (ʌ and ə are the same vowel, stressed vs not)
     *   open unstressed syllable -> schwa   (a·MAZ·ing, po·LICE, bi·OL·o·gy)
     *   final -Vm/-Vn/-Vl        -> schwa   (item, problem, kitchen, novel) */
    if (opts.reduce !== false) {
      syls.forEach(function (s, i) {
        if (s.stress || !s.nucleus) return;
        if (s.nucleus === 'AH') { s.nucleus = 'AX'; return; }
        var open = s.coda.length === 0;
        if (open && /^(AE|EH|AA|Q|IX)$/.test(s.nucleus)) { s.nucleus = 'AX'; return; }
        // -Vm(s), -Vn(t), -Vl(s): ignore an inflectional S/Z/T/D on the end
        var tail = s.coda.filter(function (c, k) {
          return !(k > 0 && /^[SZTD]$/.test(c));
        });
        var nasalTail = tail.length === 1 && /^[NML]$/.test(tail[0]);
        if (nasalTail && i > 0 && /^(EH|AE|Q)$/.test(s.nucleus)) s.nucleus = 'AX';
      });
    }

    return {
      word: word,
      phones: phones,
      syllables: syls,
      stressSyl: stressSyl,
      source: got.source
    };
  }

  // Render one built word into a notation string.
  function renderWord(built, opts, linkR) {
    if (!built) return '';
    var mode = opts.notation || 'ipa';
    if (mode === 'arpabet') return renderArpabet(built);
    if (mode === 'respell') return renderRespell(built);
    return renderIPA(built, opts, linkR);
  }

  function renderIPA(built, opts, linkR) {
    var acc = ACCENTS[opts.accent] || ACCENTS.ga;
    var syls = built.syllables;
    var multi = syls.length > 1;
    var out = [];

    for (var i = 0; i < syls.length; i++) {
      var s = syls[i];
      var prev = syls[i - 1];
      var str = '';

      // ---- onset
      for (var o = 0; o < s.onset.length; o++) {
        var c = s.onset[o];
        var glyph = consGlyph(c, acc, opts);
        if (c === 'T' && opts.narrow && acc.flapping && o === 0 &&
            s.onset.length === 1 && !s.stress && prev && !prev.coda.length) {
          glyph = 'ɾ';
        } else if (opts.narrow && o === 0 && s.stress && /^[PTK]$/.test(c)) {
          glyph += 'ʰ';
        }
        str += glyph;
      }

      // ---- nucleus (+ possible r-colouring / dropping)
      var nuc = s.nucleus;
      var coda = s.coda.slice();
      var syllabic = null;

      if (nuc) {
        var vGlyph;
        var rIdx = coda.indexOf('R');
        var dropR = false;
        if (!acc.rhotic && rIdx >= 0) {
          var isFinalR = (i === syls.length - 1) && rIdx === coda.length - 1;
          dropR = !(isFinalR && linkR);
        }
        if (dropR) {
          vGlyph = (acc.rComb && acc.rComb[nuc]) || acc.v[nuc] || nuc;
          coda.splice(rIdx, 1);
        } else if (nuc === 'ER' && !s.stress) {
          vGlyph = acc.unstressedER;
        } else {
          vGlyph = acc.v[nuc] || nuc;
        }

        if (opts.narrow && (nuc === 'AX' || nuc === 'IX') && coda.length === 1 &&
            (coda[0] === 'L' || coda[0] === 'N' || coda[0] === 'M')) {
          syllabic = coda[0] === 'L' ? 'l̩' : (coda[0] === 'N' ? 'n̩' : 'm̩');
          coda = [];
          vGlyph = '';
        }
        str += vGlyph;
        if (syllabic) str += syllabic;
      }

      // ---- coda
      for (var k = 0; k < coda.length; k++) {
        var cc = coda[k];
        if (cc === 'R' && !acc.rhotic) continue;
        var g = consGlyph(cc, acc, opts);
        if (opts.narrow && cc === 'L') g = 'ɫ';
        str += g;
      }

      if (multi && opts.stressMarks !== false && s.stress) str = 'ˈ' + str;
      out.push(str);
    }

    var joiner = opts.syllableBreaks ? '.' : '';
    var body = out.join(joiner);
    if (opts.syllableBreaks) body = body.replace(/\.ˈ/g, 'ˈ');
    return body;
  }

  function consGlyph(c, acc, opts) {
    if (c === 'R') return acc.r;
    var g = CONS[c] || c.toLowerCase();
    if (opts.narrow) {
      if (c === 'CH') g = 't͡ʃ';
      if (c === 'JH') g = 'd͡ʒ';
    }
    return g;
  }

  function renderArpabet(built) {
    var out = [];
    built.syllables.forEach(function (s) {
      s.onset.forEach(function (c) { out.push(c); });
      if (s.nucleus) {
        // Q/AX/IX are internal; CMU-style ARPAbet spells them AA/AH/IH
        var v = { Q: 'AA', AX: 'AH', IX: 'IH' }[s.nucleus] || s.nucleus;
        out.push(v + (s.stress ? '1' : '0'));
      }
      s.coda.forEach(function (c) { out.push(c); });
    });
    return out.join(' ');
  }

  function renderRespell(built) {
    var parts = built.syllables.map(function (s) {
      var t = '';
      s.onset.forEach(function (c) { t += RESPELL_C[c] || c.toLowerCase(); });
      if (s.nucleus) t += RESPELL_V[s.nucleus] || s.nucleus.toLowerCase();
      s.coda.forEach(function (c) { t += RESPELL_C[c] || c.toLowerCase(); });
      return s.stress && built.syllables.length > 1 ? t.toUpperCase() : t;
    });
    if (parts.length === 1) return parts[0];
    return parts.join('-');
  }

  // -------------------------------------------------------- number expansion
  function under1000(n) {
    var out = [];
    if (n >= 100) {
      out.push(D.ONES[Math.floor(n / 100)], 'hundred');
      n %= 100;
      if (n) out.push('and');
    }
    if (n >= 20) {
      out.push(D.TENS[Math.floor(n / 10)]);
      if (n % 10) out.push(D.ONES[n % 10]);
    } else if (n > 0) {
      out.push(D.ONES[n]);
    }
    return out;
  }

  function intToWords(n) {
    if (n === 0) return ['zero'];
    var out = [];
    for (var i = 0; i < D.SCALES.length; i++) {
      var val = D.SCALES[i][0], name = D.SCALES[i][1];
      if (n >= val) {
        var count = Math.floor(n / val);
        out = out.concat(intToWords(count), [name]);
        n %= val;
      }
    }
    if (n > 0) out = out.concat(under1000(n));
    return out;
  }

  function numberToWords(str) {
    var clean = str.replace(/,/g, '');
    var neg = /^-/.test(clean);
    clean = clean.replace(/^-/, '');
    var bits = clean.split('.');
    var whole = parseInt(bits[0], 10);
    if (isNaN(whole)) return [];
    var words = intToWords(whole);
    if (bits[1]) {
      words.push('point');
      for (var i = 0; i < bits[1].length; i++) words.push(D.ONES[+bits[1][i]]);
    }
    if (neg) words.unshift('minus');
    return words;
  }

  // ------------------------------------------------------------- tokenizing
  var L = 'A-Za-z\\u00C0-\\u024F';
  var TOKEN_SRC = '[' + L + ']+(?:[\'’][' + L + ']+)*' +
                  '|\\d+(?:[.,]\\d+)*' +
                  '|[^' + L + '\\d]+';
  var WORD_START = new RegExp('^[' + L + ']');

  /* Convert a whole text. Returns an array of tokens:
   *   { type:'word', raw, out, syllables, source }
   *   { type:'other', raw }
   */
  function transcribe(text, options) {
    var opts = Object.assign({
      accent: 'ga',
      notation: 'ipa',
      stressMarks: true,
      syllableBreaks: false,
      narrow: false,
      weakForms: false,
      reduce: true,
      expandNumbers: true
    }, options || {});

    var tokens = [];
    var m;
    var tokenRe = new RegExp(TOKEN_SRC, 'g');
    while ((m = tokenRe.exec(text)) !== null) {
      var raw = m[0];
      if (WORD_START.test(raw)) {
        tokens.push({ type: 'word', raw: raw, words: [raw] });
      } else if (/^\d/.test(raw)) {
        if (opts.expandNumbers) {
          var ws = numberToWords(raw);
          if (ws.length) tokens.push({ type: 'word', raw: raw, words: ws, numeric: true });
          else tokens.push({ type: 'other', raw: raw });
        } else {
          tokens.push({ type: 'other', raw: raw });
        }
      } else {
        tokens.push({ type: 'other', raw: raw });
      }
    }

    // build phonemes first so linking-r can peek at the next word
    tokens.forEach(function (t) {
      if (t.type !== 'word') return;
      t.built = t.words.map(function (w) {
        return w.split('-').map(function (part) {
          return part ? buildWord(part, opts) : null;
        }).filter(Boolean);
      });
    });

    // flat order of every built word, so linking-r can peek at what follows
    var flat = [];
    tokens.forEach(function (t) {
      if (t.type !== 'word') return;
      t.built.forEach(function (group) {
        group.forEach(function (b) { b._i = flat.length; flat.push(b); });
      });
    });

    tokens.forEach(function (t) {
      if (t.type !== 'word') return;
      var pieces = [];
      var syl = 0, phCount = 0, unknown = false;
      t.built.forEach(function (group) {
        var sub = [];
        group.forEach(function (b) {
          var next = flat[b._i + 1];
          var linkR = !!(next && next.syllables[0] && !next.syllables[0].onset.length);
          sub.push(renderWord(b, opts, linkR));
          syl += b.syllables.length;
          phCount += b.phones.length;
          if (b.source !== 'lexicon') unknown = true;
        });
        pieces.push(sub.join('-'));
      });
      t.out = pieces.join(' ');
      t.syllables = syl;
      t.phonemeCount = phCount;
      t.estimated = unknown;
      if (opts.notation === 'ipa' && opts.brackets) {
        t.out = (opts.brackets === 'slashes' ? '/' + t.out + '/' : '[' + t.out + ']');
      }
    });

    return tokens;
  }

  function tokensToText(tokens) {
    return tokens.map(function (t) {
      return t.type === 'word' ? (t.out || t.raw) : t.raw;
    }).join('');
  }

  root.IPA = {
    transcribe: transcribe,
    tokensToText: tokensToText,
    accents: ACCENTS,
    buildWord: buildWord,
    rulesToPhones: rulesToPhones,
    numberToWords: numberToWords
  };
})(typeof window !== 'undefined' ? window : this);
