/* app.js — UI wiring for the transcriber. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    input: $('in'), out: $('out'), main: $('main'), outLabel: $('outLabel'),
    accent: $('accent'), notation: $('notation'), view: $('view'),
    brackets: $('brackets'),
    stressMarks: $('stressMarks'), syllableBreaks: $('syllableBreaks'),
    narrow: $('narrow'), weakForms: $('weakForms'),
    expandNumbers: $('expandNumbers'), markEstimates: $('markEstimates'),
    lengthMode: $('lengthMode'), lengthN: $('lengthN'),
    lengthUnit: $('lengthUnit'),
    sWords: $('sWords'), sSyl: $('sSyl'), sPhon: $('sPhon'), sLex: $('sLex'),
    sLexLabel: $('sLexLabel'), sSkip: $('sSkip'), sSkipWrap: $('sSkipWrap'),
    footNote: $('footNote'),
    toast: $('toast'), legendBody: $('legendBody')
  };

  var EXAMPLE =
    'The quick brown fox jumps over the lazy dog.\n' +
    '\n' +
    "Phonetics is the study of speech sounds: how they're made,\n" +
    'how they travel, and how a listener hears them.\n' +
    '\n' +
    '  1. Colonel Wednesday bought 42 chocolate croissants.\n' +
    '  2. She thought the rough cough might last through the night.\n' +
    '  3. A yacht, an island, and a subtle receipt — all silent letters.';

  var SETTINGS = ['accent', 'notation', 'view', 'brackets', 'stressMarks',
    'syllableBreaks', 'narrow', 'weakForms', 'expandNumbers', 'markEstimates',
    'lengthMode', 'lengthN'];

  // ------------------------------------------------------------------ state
  function opts() {
    return {
      accent: el.accent.value,
      notation: el.notation.value,
      brackets: el.brackets.value,
      stressMarks: el.stressMarks.checked,
      syllableBreaks: el.syllableBreaks.checked,
      narrow: el.narrow.checked,
      weakForms: el.weakForms.checked,
      expandNumbers: el.expandNumbers.checked,
      lengthMode: el.lengthMode.value,
      lengthN: el.lengthN.value
    };
  }

  function save() {
    try {
      var o = {};
      SETTINGS.forEach(function (k) {
        o[k] = el[k].type === 'checkbox' ? el[k].checked : el[k].value;
      });
      localStorage.setItem('phonemic.settings', JSON.stringify(o));
      localStorage.setItem('phonemic.text', el.input.value);
    } catch (e) { /* private mode — settings just won't persist */ }
  }

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem('phonemic.settings') || '{}');
      SETTINGS.forEach(function (k) {
        if (!(k in o)) return;
        if (el[k].type === 'checkbox') el[k].checked = !!o[k];
        else el[k].value = o[k];
      });
      var t = localStorage.getItem('phonemic.text');
      el.input.value = (t === null ? EXAMPLE : t);
      var theme = localStorage.getItem('phonemic.theme');
      if (theme) document.documentElement.dataset.theme = theme;
    } catch (e) { el.input.value = EXAMPLE; }
  }

  // ---------------------------------------------------------------- render
  var lastPlain = '';

  function render() {
    var o = opts();
    var text = el.input.value;
    var view = el.view.value;
    var mono = view === 'aligned' || o.notation === 'arpabet';

    el.out.className = (mono ? 'mono' : '') + (el.markEstimates.checked ? ' mark' : '');
    el.outLabel.textContent = {
      ipa: 'IPA', arpabet: 'ARPAbet', respell: 'Respelling',
      alt: 'Sound-alike spelling'
    }[o.notation] + (o.notation === 'ipa' ? ' · ' + IPA.accents[o.accent].name : '');

    var alt = o.notation === 'alt';
    el.sLexLabel.textContent = alt ? 'real homophones' : 'from dictionary';
    el.footNote.innerHTML = alt
      ? '<span class="swatch"></span> underlined = invented spelling · ' +
        'grey = no better spelling exists'
      : '<span class="swatch"></span> underlined = spelled out by rule, not looked up';

    if (!text.trim()) {
      el.out.innerHTML = '<span class="empty">Nothing to transcribe yet.</span>';
      lastPlain = '';
      stats(null);
      return;
    }

    // one pass over the whole text keeps linking-r and structure intact
    var tokens = IPA.transcribe(text, o);
    lastPlain = IPA.tokensToText(tokens);

    if (view === 'inline') renderInline(tokens);
    else if (view === 'stacked') renderStacked(tokens);
    else renderAligned(text, o);

    stats(tokens);
  }

  // also escapes " because the same helper fills title="…" attributes
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function title(t) {
    var b = t.built && t.built[0] && t.built[0][0];
    var bits = [t.raw];
    if (t.words && t.words.join(' ') !== t.raw) bits.push('“' + t.words.join(' ') + '”');
    if (b) {
      bits.push(b.phones.join(' '));
      bits.push(b.syllables.length + (b.syllables.length === 1 ? ' syllable' : ' syllables'));
      if (t.homophone) bits.push('real homophone');
      else if (t.unchanged) bits.push('no better spelling exists');
      else if (b.altReal === false) bits.push('invented spelling');
      else bits.push(b.source === 'lexicon' ? 'dictionary entry' : 'spelling rules (estimate)');
    }
    return esc(bits.join('  ·  '));
  }

  function skipped(t) {
    return '<span class="skip" title="' + esc(t.raw) +
      ' — outside the length filter">' + esc(t.raw) + '</span>';
  }

  function renderInline(tokens) {
    var html = tokens.map(function (t) {
      if (t.type !== 'word') return esc(t.raw);
      if (t.skipped) return skipped(t);
      return '<span class="w' + (t.estimated ? ' est' : '') +
        (t.unchanged ? ' same' : '') + '" title="' +
        title(t) + '">' + esc(t.out) + '</span>';
    }).join('');
    el.out.innerHTML = html;
  }

  function renderStacked(tokens) {
    var html = tokens.map(function (t) {
      if (t.type !== 'word') return esc(t.raw);
      if (t.skipped) return skipped(t);
      return '<span class="pair w' + (t.estimated ? ' est' : '') + '" title="' + title(t) +
        '"><span class="src">' + esc(t.raw) + '</span>' +
        '<span class="ipa">' + esc(t.out) + '</span></span>';
    }).join('');
    el.out.innerHTML = html;
  }

  /* Column view: transcribe line by line so the original and the IPA can be
   * padded to the same width and stay lined up in a monospace block. */
  function renderAligned(text, o) {
    var out = [];
    text.split('\n').forEach(function (line) {
      if (!line.trim()) { out.push('', ''); return; }
      var toks = IPA.transcribe(line, o);
      var top = '', bot = '';
      toks.forEach(function (t) {
        if (t.type !== 'word') {
          // punctuation and spacing are identical on both rows, which is
          // exactly what keeps the two lines in step
          top += t.raw;
          bot += t.raw;
          return;
        }
        var w = Math.max(width(t.raw), width(t.out));
        top += pad(t.raw, w);
        bot += pad(t.out, w);
      });
      out.push(top.replace(/\s+$/, ''), bot.replace(/\s+$/, ''), '');
    });
    el.out.innerHTML = out.map(esc).join('\n');
  }

  // IPA diacritics (ˈ ː ̩ ͡ …) sit on top of the previous glyph, so they take
  // no width in a monospace grid.
  var ZERO_WIDTH = new RegExp('[\\u0300-\\u036f\\u02c8\\u02cc]', 'g');
  function width(s) { return s.replace(ZERO_WIDTH, '').length; }
  function pad(s, w) {
    var n = w - width(s);
    return s + (n > 0 ? new Array(n + 1).join(' ') : '');
  }

  function stats(tokens) {
    if (!tokens) {
      el.sWords.textContent = el.sSyl.textContent = el.sPhon.textContent = '0';
      el.sLex.textContent = '0%';
      return;
    }
    var words = 0, syl = 0, phon = 0, lex = 0, skip = 0, homo = 0;
    tokens.forEach(function (t) {
      if (t.type !== 'word') return;
      if (t.skipped) { skip++; return; }
      words++;
      syl += t.syllables || 0;
      phon += t.phonemeCount || 0;
      if (!t.estimated) lex++;
      if (t.homophone) homo++;
    });
    el.sWords.textContent = words;
    el.sSyl.textContent = syl;
    el.sPhon.textContent = phon;
    el.sLex.textContent = el.notation.value === 'alt' ? homo
      : (words ? Math.round(lex / words * 100) + '%' : '0%');
    el.sSkip.textContent = skip;
    el.sSkipWrap.hidden = !skip;
  }

  // ---------------------------------------------------------------- legend
  var LEGEND = {
    'Vowels': [
      ['i / iː', 'fleece, see'], ['ɪ', 'kit, bid'], ['ɛ / e', 'dress, bed'],
      ['æ', 'trap, cat'], ['ʌ', 'strut, cup'], ['ə', 'about, sofa'],
      ['ɑ / ɑː', 'father, palm'], ['ɒ', 'lot (British)'], ['ɔ / ɔː', 'thought, law'],
      ['ʊ', 'foot, put'], ['u / uː', 'goose, boot'], ['ɝ / ɜː', 'nurse, bird'],
      ['ɚ / ə', 'letter, doctor']
    ],
    'Diphthongs': [
      ['eɪ', 'face, day'], ['aɪ', 'price, my'], ['ɔɪ', 'choice, boy'],
      ['aʊ', 'mouth, now'], ['oʊ / əʊ', 'goat, no'], ['ɪə', 'near (British)'],
      ['eə', 'square (British)'], ['ʊə', 'cure (British)']
    ],
    'Consonants': [
      ['θ', 'thin'], ['ð', 'this'], ['ʃ', 'ship'], ['ʒ', 'measure'],
      ['tʃ', 'chip'], ['dʒ', 'judge'], ['ŋ', 'sing'], ['j', 'yes'],
      ['ɹ / r', 'red'], ['ɡ', 'go']
    ],
    'Marks': [
      ['ˈ', 'primary stress on the next syllable'],
      ['.', 'syllable boundary'],
      ['ː', 'long vowel'],
      ['tʰ', 'aspirated (narrow mode)'],
      ['ɾ', 'flapped t, as in "water" (narrow)'],
      ['ɫ', 'dark l, as in "ball" (narrow)'],
      ['l̩ n̩', 'syllabic l / n, as in "bottle" (narrow)']
    ]
  };

  function buildLegend() {
    var html = Object.keys(LEGEND).map(function (k) {
      var rows = LEGEND[k].map(function (r) {
        return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
      }).join('');
      return '<div class="legend-col"><h4>' + k + '</h4><table>' + rows + '</table></div>';
    }).join('');
    html += '<div class="legend-col" style="max-width:34ch">' +
      '<h4>How it works</h4>' +
      '<p class="note">Every word is first looked up in a built-in dictionary of ' +
      'English irregulars (<i>colonel, yacht, though</i>). Anything not in it is ' +
      'sounded out with ordered letter-to-sound rules, so invented words and ' +
      'names still get a plausible pronunciation — those are the ones ' +
      'underlined in the output.</p>' +
      '<p class="note">Stress and syllable splits on rule-derived words are ' +
      'estimated, not looked up. Everything runs locally; nothing is uploaded.</p>' +
      '<h4>Sound-alike spelling</h4>' +
      '<p class="note">Rewrites each word as a different spelling that reads ' +
      'the same aloud. A real homophone wins where one exists ' +
      '(<i>time → thyme</i>, <i>night → knight</i>); otherwise the word is ' +
      'respelled from its sounds (<i>quick → kwik</i>, <i>school → skool</i>). ' +
      'Words English already spells the plain way — <i>jumps</i>, <i>speech</i> ' +
      '— are left alone in grey rather than mangled into something worse.</p>' +
      '</div>';
    el.legendBody.innerHTML = html;
  }

  // ---------------------------------------------------------------- actions
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove('show'); }, 1400);
  }

  $('copy').addEventListener('click', function () {
    var text = lastPlain;
    if (!text) return toast('Nothing to copy');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied'); },
        function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied'); }
    catch (e) { toast('Copy failed'); }
    document.body.removeChild(ta);
  }

  $('download').addEventListener('click', function () {
    if (!lastPlain) return toast('Nothing to save');
    var blob = new Blob([lastPlain], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'transcription-' + el.notation.value + '.txt';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('example').addEventListener('click', function () {
    el.input.value = EXAMPLE;
    update();
  });
  $('clear').addEventListener('click', function () {
    el.input.value = '';
    el.input.focus();
    update();
  });
  $('paste').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      return toast('Use Ctrl+V — this browser blocks reading the clipboard');
    }
    navigator.clipboard.readText().then(function (t) {
      el.input.value = t;
      update();
    }, function () { toast('Clipboard permission denied — use Ctrl+V'); });
  });

  $('theme').addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('phonemic.theme', next); } catch (e) {}
  });

  // ------------------------------------------------------------------ events
  var timer = null;
  function update() {
    document.querySelectorAll('.toggle').forEach(function (t) {
      var box = t.querySelector('input');
      t.dataset.on = box && box.checked ? '1' : '';
    });
    var filtering = !!el.lengthMode.value;
    el.lengthN.disabled = !filtering;
    el.lengthUnit.classList.toggle('off', !filtering);
    render();
    save();
  }
  function debounced() {
    clearTimeout(timer);
    timer = setTimeout(update, 90);
  }

  el.input.addEventListener('input', debounced);
  SETTINGS.forEach(function (k) { el[k].addEventListener('change', update); });
  el.lengthN.addEventListener('input', debounced); // react while typing/spinning

  // keep the two panes scrolled together in the aligned/inline views
  el.input.addEventListener('scroll', function () {
    var r = el.input.scrollTop / Math.max(1, el.input.scrollHeight - el.input.clientHeight);
    el.out.scrollTop = r * (el.out.scrollHeight - el.out.clientHeight);
  });

  load();
  buildLegend();
  update();
})();
