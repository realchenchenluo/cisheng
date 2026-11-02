/*!
 * 词声 · core.js
 * 纯函数核心：词库解析、答案判定、释义脱敏、价值评分与出题。
 * 同时兼容浏览器（window.WordCore）与 Node（require）。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.WordCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 常量                                                                */
  /* ------------------------------------------------------------------ */

  const COMMON_WORDS = new Set(
    (
      'the be to of and a in that have i it for not on with he as you do at ' +
      'this but his by from they we say her she or an will my one all would ' +
      'there their what so up out if about who get which go me when make can ' +
      'like time no just him know take people into year your good some could ' +
      'them see other than then now look only come its over think also back ' +
      'after use two how our work first well way even new want because any ' +
      'these give day most us is are was were been being has had did does ' +
      'doing done am shall should may might must very much many more some ' +
      'such own same each every both few little long great old big small ' +
      'right left high low early late young large next last hard easy ' +
      'man woman child boy girl friend family home house school place world ' +
      'life hand part eye word thing name number water air sun day night ' +
      'week month today tomorrow yesterday here there where why while before ' +
      'under between through during without against within across around ' +
      'because although though since until unless however therefore ' +
      'always never often sometimes usually again already still yet ever ' +
      'nothing something anyone everyone someone nobody everybody ' +
      'find tell ask help try need feel become leave put mean keep let begin ' +
      'seem talk turn start show hear play run move live believe hold bring ' +
      'happen write provide sit stand lose pay meet include continue set ' +
      'learn change lead understand watch follow stop create speak read ' +
      'allow add spend grow open walk win offer remember love consider ' +
      'appear buy wait serve die send expect build stay fall cut reach kill'
    ).split(/\s+/)
  );

  const STOPWORDS = new Set(
    (
      'a an the of in on at to for with by from up down out off over under ' +
      'into onto upon and or nor but so yet as than that this these those ' +
      'is are was were be been being am do does did done have has had ' +
      'i you he she it we they me him her us them my your his its our their ' +
      'one something someone thing things'
    ).split(/\s+/)
  );

  const SPELLING_PAIRS = [
    ['colour', 'color'], ['behaviour', 'behavior'], ['favourite', 'favorite'],
    ['honour', 'honor'], ['labour', 'labor'], ['neighbour', 'neighbor'],
    ['humour', 'humor'], ['rumour', 'rumor'], ['flavour', 'flavor'],
    ['harbour', 'harbor'], ['endeavour', 'endeavor'], ['armour', 'armor'],
    ['savour', 'savor'], ['vapour', 'vapor'], ['centre', 'center'],
    ['metre', 'meter'], ['theatre', 'theater'], ['litre', 'liter'],
    ['fibre', 'fiber'], ['calibre', 'caliber'], ['analyse', 'analyze'],
    ['paralyse', 'paralyze'], ['catalyse', 'catalyze'],
    ['realise', 'realize'], ['organise', 'organize'],
    ['recognise', 'recognize'], ['apologise', 'apologize'],
    ['criticise', 'criticize'], ['emphasise', 'emphasize'],
    ['summarise', 'summarize'], ['prioritise', 'prioritize'],
    ['specialise', 'specialize'], ['visualise', 'visualize'],
    ['minimise', 'minimize'], ['maximise', 'maximize'],
    ['memorise', 'memorize'], ['customise', 'customize'],
    ['standardise', 'standardize'], ['authorise', 'authorize'],
    ['categorise', 'categorize'], ['generalise', 'generalize'],
    ['initialise', 'initialize'], ['stabilise', 'stabilize'],
    ['utilise', 'utilize'], ['civilise', 'civilize'],
    ['hypothesise', 'hypothesize'], ['jeopardise', 'jeopardize'],
    ['program', 'programme'], ['gray', 'grey'], ['defense', 'defence'],
    ['license', 'licence'], ['traveling', 'travelling'], ['traveled', 'travelled'],
    ['traveler', 'traveller'], ['canceled', 'cancelled'], ['canceling', 'cancelling'],
    ['labeled', 'labelled'], ['labeling', 'labelling'], ['modeled', 'modelled'],
    ['modeling', 'modelling'], ['fueled', 'fuelled'], ['fueling', 'fuelling'],
    ['jewelry', 'jewellery'], ['skillful', 'skilful'], ['fulfill', 'fulfil'],
    ['fulfillment', 'fulfilment'], ['enrollment', 'enrolment'], ['aging', 'ageing'],
    ['aluminum', 'aluminium'], ['skeptical', 'sceptical'],
    ['maneuver', 'manoeuvre'], ['pediatric', 'paediatric'],
    ['estrogen', 'oestrogen'], ['archaeology', 'archeology'],
    ['judgment', 'judgement'], ['acknowledgment', 'acknowledgement'],
    ['acknowledgments', 'acknowledgements'], ['cozy', 'cosy'],
    ['mustache', 'moustache'], ['plow', 'plough'], ['mold', 'mould'],
    ['molds', 'moulds'], ['molded', 'moulded'], ['smolder', 'smoulder'],
    ['catalog', 'catalogue'], ['catalogs', 'catalogues'],
    ['dialog', 'dialogue'], ['dialogs', 'dialogues'],
    ['analog', 'analogue'], ['analogs', 'analogues'], ['jail', 'gaol']
  ];

  const VARIANT_MAP = (function () {
    const map = new Map();
    SPELLING_PAIRS.forEach(function (pair) {
      const a = pair[0];
      const b = pair[1];
      if (!map.has(a)) map.set(a, new Set());
      if (!map.has(b)) map.set(b, new Set());
      map.get(a).add(b);
      map.get(b).add(a);
    });
    return map;
  })();

  const TERM_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9'’.\- ]{0,79}$/;
  const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
  const CJK_GLOBAL_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/g;
  const ASCII_LETTER_RE = /[A-Za-z]/;
  const POS_LABELS = {
    noun: '名词',
    verb: '动词',
    adjective: '形容词',
    adverb: '副词',
    pronoun: '代词',
    preposition: '介词',
    conjunction: '连词',
    interjection: '感叹词',
    determiner: '限定词',
    article: '冠词',
    numeral: '数词',
    phrase: '词组',
    'prepositional phrase': '介词短语',
    'verb phrase': '动词短语',
    'noun phrase': '名词短语',
    'adjective phrase': '形容词短语',
    'idiom': '习语',
    'idiomatic': '习语'
  };

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */

  function uid(prefix) {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 9);
    return (prefix || 'id') + '_' + stamp + '_' + rand;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeSpace(value) {
    return String(value == null ? '' : value)
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r\n\f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripWrappingQuotes(value) {
    let text = String(value == null ? '' : value).trim();
    const pairs = [['"', '"'], ['“', '”'], ['‘', '’'], ['「', '」'], ['『', '』']];
    for (let i = 0; i < pairs.length; i += 1) {
      const pair = pairs[i];
      if (text.length > 2 && text.startsWith(pair[0]) && text.endsWith(pair[1])) {
        text = text.slice(1, -1).trim();
        break;
      }
    }
    return text;
  }

  function decodeEntitiesBasic(value) {
    return String(value == null ? '' : value)
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  function cleanText(value) {
    return normalizeSpace(
      decodeEntitiesBasic(String(value == null ? '' : value).replace(/<[^>]*>/g, ' '))
    );
  }

  function hasCJK(value) {
    return CJK_RE.test(String(value == null ? '' : value));
  }

  function isMostlyChinese(value) {
    const text = String(value == null ? '' : value);
    const cjk = (text.match(CJK_GLOBAL_RE) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    return cjk > 0 && cjk >= latin;
  }

  function normalizeTerm(raw) {
    let term = String(raw == null ? '' : raw)
      .replace(/^\uFEFF/, '')
      .replace(/[’‘`´]/g, "'")
      .trim();
    term = stripWrappingQuotes(term);
    term = term.replace(/\s+/g, ' ').trim();
    term = term.replace(/[\s,;:：，；、|｜/\\]+$/g, '').trim();
    return term;
  }

  function normalizeKey(term) {
    return normalizeTerm(term).toLowerCase();
  }

  function detectType(term) {
    return /\s/.test(normalizeTerm(term)) ? 'phrase' : 'word';
  }

  function isValidTerm(term) {
    const normalized = normalizeTerm(term);
    if (!normalized || normalized.length > 80) return false;
    if (hasCJK(normalized)) return false;
    if (!ASCII_LETTER_RE.test(normalized)) return false;
    if (!TERM_RE.test(normalized)) return false;
    if (normalized.split(/\s+/).length > 10) return false;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* 词库解析                                                            */
  /* ------------------------------------------------------------------ */

  function isHeaderLine(line) {
    const compact = normalizeSpace(line.replace(/[|｜,，\t:：]+/g, ' ')).toLowerCase();
    if (
      compact === 'word definition' ||
      compact === 'word meaning' ||
      compact === 'term definition' ||
      compact === 'phrase definition' ||
      compact === '单词 释义' ||
      compact === '单词 英文释义' ||
      compact === '词组 释义' ||
      compact === '英文 中文' ||
      compact === '单词 中文'
    ) {
      return true;
    }
    return /^(word|term|phrase|vocabulary|单词|词组|词汇)\s*[|｜,，\t:：]\s*(definition|meaning|translation|释义|中文|解释)/i.test(line);
  }

  function splitCSVLine(line) {
    const fields = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map(function (field) { return field.trim(); });
  }

  function splitEntryLine(line) {
    if (line.indexOf('\t') !== -1) {
      return { fields: line.split('\t').map(function (s) { return s.trim(); }) };
    }

    if (/[|｜]/.test(line)) {
      return { fields: line.split(/\s*[|｜]\s*/).map(function (s) { return s.trim(); }) };
    }

    const dashMatch = line.match(/\s+[–—-]\s+/);
    if (dashMatch) {
      const idx = line.indexOf(dashMatch[0]);
      if (idx > 0) {
        return {
          fields: [
            line.slice(0, idx).trim(),
            line.slice(idx + dashMatch[0].length).trim()
          ]
        };
      }
    }

    if (!/[0-9]{1,2}:[0-9]{2}/.test(line)) {
      const colonMatch = line.match(/^(.{1,60}?)\s*[:：]\s*(.+)$/);
      if (colonMatch && ASCII_LETTER_RE.test(colonMatch[1])) {
        return { fields: [colonMatch[1].trim(), colonMatch[2].trim()] };
      }
    }

    if (line.indexOf(',') !== -1) {
      const fields = splitCSVLine(line);
      const hasQuotes = line.indexOf('"') !== -1;
      const allSingleWords = fields.length > 1 && fields.every(function (field) {
        return /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.\-]*$/.test(field);
      });
      if (!hasQuotes && allSingleWords && !fields.some(hasCJK)) {
        return { multiple: fields };
      }
      if (fields.length > 1) {
        return { fields: fields };
      }
    }

    const cjkIndex = line.search(CJK_RE);
    if (cjkIndex > 0) {
      const left = line.slice(0, cjkIndex).trim().replace(/[\s,;:：，；、\-–—]+$/g, '');
      const right = line.slice(cjkIndex).trim();
      if (ASCII_LETTER_RE.test(left) && left.split(/\s+/).length <= 10) {
        return { fields: [left, '', right] };
      }
    }

    return { fields: [line] };
  }

  function normalizeDefinition(raw) {
    let def = stripWrappingQuotes(String(raw == null ? '' : raw));
    def = def.replace(/<[^>]*>/g, ' ');
    def = decodeEntitiesBasic(def);
    def = normalizeSpace(def);
    def = def.replace(/\s*\[(?:\d+|citation needed)\]\s*/gi, ' ');
    def = normalizeSpace(def);
    return def.slice(0, 1000);
  }

  function normalizeChinese(raw) {
    let chinese = stripWrappingQuotes(normalizeSpace(raw));
    chinese = chinese.replace(/^[\s:：\-–—,，;；、]+/, '').trim();
    let previous;
    do {
      previous = chinese;
      chinese = chinese.replace(/([\u3400-\u9FFF])\s+(?=[\u3400-\u9FFF])/g, '$1');
    } while (chinese !== previous);
    return chinese.slice(0, 300);
  }

  function parseWordList(text) {
    const result = {
      items: [],
      stats: {
        lines: 0,
        parsed: 0,
        duplicates: 0,
        invalid: 0,
        headers: 0,
        words: 0,
        phrases: 0,
        withDefinition: 0,
        missingDefinition: 0
      }
    };

    if (!text) return result;

    const source = String(text)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
    const lines = source.split('\n');
    const seen = new Map();

    function addEntry(termRaw, definitionRaw, chineseRaw) {
      const term = normalizeTerm(termRaw);
      if (!isValidTerm(term)) {
        result.stats.invalid += 1;
        return;
      }

      let definition = normalizeDefinition(definitionRaw);
      let chinese = normalizeChinese(chineseRaw);

      if (definition) {
        if (hasCJK(definition)) {
          if (isMostlyChinese(definition)) {
            if (!chinese) chinese = normalizeChinese(definition);
            definition = '';
          } else {
            const idx = definition.search(CJK_RE);
            const left = normalizeSpace(definition.slice(0, idx).replace(/[\s,;:：，；、\-–—]+$/g, ''));
            const right = normalizeChinese(definition.slice(idx));
            if (left && left.split(/\s+/).length >= 1 && right) {
              definition = left;
              if (!chinese) chinese = right;
            }
          }
        }
      }

      if (
        definition &&
        normalizeSpace(definition).toLowerCase() === normalizeSpace(term).toLowerCase()
      ) {
        definition = '';
      }

      const key = normalizeKey(term);
      if (seen.has(key)) {
        result.stats.duplicates += 1;
        const existing = result.items[seen.get(key)];
        if (!existing.definition && definition) {
          existing.definition = definition;
          existing.source = 'import';
        }
        if (!existing.chinese && chinese) existing.chinese = chinese;
        return;
      }

      const type = detectType(term);
      const item = {
        id: uid('item'),
        term: term,
        type: type,
        definition: definition,
        chinese: chinese,
        pos: '',
        phonetic: '',
        source: definition ? 'import' : '',
        starred: false,
        stats: { attempts: 0, correct: 0, wrong: 0 },
        createdAt: new Date().toISOString()
      };

      seen.set(key, result.items.length);
      result.items.push(item);
      result.stats.parsed += 1;
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      let line = lines[lineIndex];
      result.stats.lines += 1;
      line = line.replace(/^\uFEFF/, '').trim();
      if (!line) continue;
      if (/^(\/\/|#)/.test(line)) continue;
      if (isHeaderLine(line)) {
        result.stats.headers += 1;
        continue;
      }
      if (/^(https?:\/\/|www\.)/i.test(line)) {
        result.stats.invalid += 1;
        continue;
      }

      line = line.replace(/^[-–—•·*]\s+/, '');
      line = line.replace(/^[（(]\s*\d{1,3}\s*[)）]\s*/, '');
      line = line.replace(/^\d{1,3}\s*[.)、:：]\s*/, '');
      line = line.replace(/^[①-⑳]\s*/, '');
      line = line.trim();
      if (!line) continue;

      const split = splitEntryLine(line);
      if (split.multiple) {
        split.multiple.forEach(function (word) {
          addEntry(word, '', '');
        });
      } else {
        const fields = split.fields || [];
        const term = fields[0] || '';
        let definition = fields[1] || '';
        let chinese = '';

        if (fields.length > 2) {
          const tail = fields.slice(2);
          if (tail.some(isMostlyChinese)) {
            chinese = tail.join(', ');
          } else {
            definition = [definition].concat(tail).filter(Boolean).join(', ');
          }
        }

        if (isMostlyChinese(definition)) {
          chinese = [definition, chinese].filter(Boolean).join(' ');
          definition = '';
        }

        addEntry(term, definition, chinese);
      }
    }

    result.items.forEach(function (item) {
      if (item.type === 'phrase') result.stats.phrases += 1;
      else result.stats.words += 1;
      if (item.definition) result.stats.withDefinition += 1;
      else result.stats.missingDefinition += 1;
    });

    return result;
  }

  /* ------------------------------------------------------------------ */
  /* 答案判定                                                            */
  /* ------------------------------------------------------------------ */

  function normalizeAnswer(raw) {
    return normalizeTerm(raw)
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[‐‑‒–—−]/g, '-')
      .replace(/-/g, ' ')
      .replace(/[.,!?;:"“”‘’()（）\[\]{}<>《》〈〉、，。；：！？…·]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripLeadingArticle(value) {
    return value.replace(/^(a|an|the)\s+/, '');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    let previous = new Array(b.length + 1);
    let current = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) previous[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );
      }
      const swap = previous;
      previous = current;
      current = swap;
    }
    return previous[b.length];
  }

  function tokenVariants(token) {
    const result = new Set([token]);
    const mapped = VARIANT_MAP.get(token);
    if (mapped) mapped.forEach(function (variant) { result.add(variant); });
    return result;
  }

  function buildSpellingVariants(normalizedTarget) {
    const tokens = normalizedTarget.split(' ').filter(Boolean);
    if (!tokens.length) return new Set();
    let combinations = new Set(['']);
    tokens.forEach(function (token) {
      const variants = tokenVariants(token);
      const next = new Set();
      combinations.forEach(function (prefix) {
        variants.forEach(function (variant) {
          next.add(prefix ? prefix + ' ' + variant : variant);
        });
      });
      combinations = next;
    });
    return combinations;
  }

  function compareAnswer(input, term, type) {
    const user = normalizeAnswer(input);
    const target = normalizeAnswer(term);
    const isPhrase = type === 'phrase' || target.indexOf(' ') !== -1;

    if (!user) {
      return { correct: false, exact: false, reason: 'empty', target: target };
    }
    if (user === target) {
      return { correct: true, exact: true, reason: 'exact', target: target };
    }

    const variants = buildSpellingVariants(target);
    if (variants.has(user)) {
      return {
        correct: true,
        exact: false,
        reason: 'spelling-variant',
        note: '英美拼写变体，按正确计',
        target: target
      };
    }

    if (isPhrase) {
      const userNoArticle = stripLeadingArticle(user);
      const targetNoArticle = stripLeadingArticle(target);
      if (userNoArticle === targetNoArticle) {
        return {
          correct: true,
          exact: false,
          reason: 'article',
          note: '冠词略有出入，按正确计',
          target: target
        };
      }
      const strippedVariants = buildSpellingVariants(targetNoArticle);
      if (strippedVariants.has(userNoArticle)) {
        return {
          correct: true,
          exact: false,
          reason: 'article-variant',
          note: '冠词与拼写变体略有出入，按正确计',
          target: target
        };
      }
    }

    return {
      correct: false,
      exact: false,
      reason: 'wrong',
      distance: levenshtein(user, target),
      target: target,
      user: user
    };
  }

  /* ------------------------------------------------------------------ */
  /* 释义脱敏与语音文本                                                  */
  /* ------------------------------------------------------------------ */

  function morphologicalForms(word) {
    const lower = word.toLowerCase();
    const forms = new Set([lower]);
    const add = function (form) {
      if (form && form.length >= 2) forms.add(form);
    };

    add(lower + 's');
    add(lower + 'es');
    add(lower + 'ed');
    add(lower + 'ing');
    add(lower + 'd');

    if (/[^aeiou]y$/.test(lower)) {
      add(lower.replace(/y$/, 'ies'));
      add(lower.replace(/y$/, 'ied'));
    }
    if (/e$/.test(lower)) {
      add(lower.replace(/e$/, 'ing'));
    }
    if (/f$/.test(lower)) {
      add(lower.replace(/f$/, 'ves'));
    }
    if (/fe$/.test(lower)) {
      add(lower.replace(/fe$/, 'ves'));
    }
    if (/(s|x|z|ch|sh)$/.test(lower)) {
      add(lower + 'es');
    }
    return forms;
  }

  function maskDefinition(definition, term, type) {
    let text = cleanText(definition);
    if (!text) return '';

    text = text.replace(/_{2,}/g, ' blank ');
    text = text.replace(/\[[^\]]{0,40}\]/g, ' ');

    const normalizedTerm = normalizeSpace(term).replace(/[’‘]/g, "'");
    const masks = [];
    const isPhrase = type === 'phrase' || normalizedTerm.indexOf(' ') !== -1;

    if (isPhrase) {
      masks.push(normalizedTerm);
      normalizedTerm
        .toLowerCase()
        .split(/\s+/)
        .filter(function (word) {
          return word.length >= 4 && !STOPWORDS.has(word);
        })
        .forEach(function (word) { masks.push(word); });
    } else {
      masks.push(normalizedTerm);
    }

    const seen = new Set();
    masks.forEach(function (mask) {
      if (!mask || mask.length < 2) return;
      morphologicalForms(mask).forEach(function (form) {
        const key = form.toLowerCase();
        if (form.length < 3 || seen.has(key)) return;
        seen.add(key);
        const pattern = escapeRegExp(form).replace(/\\ /g, '[\\s-]+');
        const regex = new RegExp('\\b' + pattern + '\\b', 'gi');
        text = text.replace(regex, ' blank ');
      });
    });

    text = text.replace(/\b(?:blank\s+){2,}/gi, 'blank ');
    text = text.replace(/\s+/g, ' ').trim();

    text = text
      .replace(/\be\.g\.\s*/gi, 'for example, ')
      .replace(/\bi\.e\.\s*/gi, 'that is, ')
      .replace(/\betc\./gi, 'etcetera')
      .replace(/\s*\/\s*/g, ' or ')
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  function isUsableDefinition(definition, term, type) {
    const def = normalizeSpace(definition);
    if (!def || def.length < 8) return false;
    if (def.toLowerCase() === normalizeSpace(term).toLowerCase()) return false;
    if (def.split(/\s+/).length < 3) return false;

    const masked = maskDefinition(def, term, type || detectType(term));
    if (!masked) return false;
    const meaningful = masked
      .replace(/\bblank\b/gi, '')
      .replace(/[^A-Za-zÀ-ÿ]+/g, ' ')
      .trim();
    return meaningful.split(/\s+/).filter(Boolean).length >= 3;
  }

  function cleanDefinitionForDisplay(definition) {
    return normalizeSpace(String(definition == null ? '' : definition));
  }

  /* ------------------------------------------------------------------ */
  /* 含金量与出题                                                        */
  /* ------------------------------------------------------------------ */

  function scoreWordValue(term) {
    const lower = String(term).toLowerCase();
    const letters = lower.replace(/[^a-z]/g, '');
    let score = 4 + Math.min(letters.length, 12) * 0.5;

    if (letters.length >= 7) score += 2;
    if (letters.length >= 10) score += 2;
    if (lower.indexOf('-') !== -1) score += 1;
    if (COMMON_WORDS.has(lower)) score -= 7;
    if (/^[a-z]{1,3}$/.test(lower)) score -= 4;
    if (/(tion|sion|ity|ous|ive|ism|ment|ance|ence|able|ible|al|ic|logy|graphy|esque|aceous|iferous|phobia)$/.test(lower)) {
      score += 2;
    }
    if (/[jqxz]/.test(lower)) score += 0.6;
    return Math.max(0.5, score);
  }

  function scorePhraseValue(term) {
    const lower = String(term).toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const letters = lower.replace(/[^a-z]/g, '');
    let score = 3 + words.length * 1.6 + Math.min(letters.length, 32) * 0.12;

    if (/\b(the|a|an|of|in|on|at|to|with|for|up|down|out|off|over|under|into|from|by)\b/.test(lower)) {
      score += 1.2;
    }
    if (lower.indexOf("'") !== -1) score += 0.8;
    if (words.length >= 3) score += 1;
    if (words.length === 2) score += 0.8;
    if (words.length > 6) score -= 2;
    if (letters.length > 40) score -= 1;
    return Math.max(1, score);
  }

  function weightedSample(pool, count, scoreFn, rng, options) {
    const opts = options || {};
    const recent = opts.recent || new Set();
    const used = opts.used || new Set();
    const prioritizeMistakes = opts.prioritizeMistakes !== false;
    const candidates = pool.slice();
    const picked = [];

    while (picked.length < count && candidates.length) {
      let total = 0;
      const weights = candidates.map(function (item) {
        let weight = Math.max(0.5, scoreFn(item));
        weight *= 0.8 + rng() * 0.4;

        if (item.starred) weight *= 3;
        if (recent.has(item.id)) weight *= 0.45;
        if (used.has(item.id)) weight *= 0.25;

        if (prioritizeMistakes && item.stats) {
          const wrong = Number(item.stats.wrong) || 0;
          const attempts = Number(item.stats.attempts) || 0;
          if (wrong > 0) weight *= 1 + Math.min(wrong, 4) * 0.55;
          else if (attempts === 0) weight *= 1.15;
        }

        total += weight;
        return weight;
      });

      let roll = rng() * total;
      let index = 0;
      for (let i = 0; i < candidates.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) {
          index = i;
          break;
        }
        index = i;
      }

      picked.push(candidates[index]);
      candidates.splice(index, 1);
    }

    return picked;
  }

  function selectSession(items, options) {
    const opts = options || {};
    const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    const phraseCount = Math.max(0, Math.floor(opts.phraseCount == null ? 3 : opts.phraseCount));
    const wordCount = Math.max(0, Math.floor(opts.wordCount == null ? 8 : opts.wordCount));
    const dictationCount = Math.max(0, Math.floor(opts.dictationCount == null ? 10 : opts.dictationCount));
    const recent = new Set(opts.recentIds || []);
    const prioritizeMistakes = opts.prioritizeMistakes !== false;

    const validItems = (items || []).filter(function (item) {
      return item && item.id && item.term && isValidTerm(item.term);
    });

    const phrasesWithDefs = validItems.filter(function (item) {
      return item.type === 'phrase' && isUsableDefinition(item.definition, item.term, item.type);
    });
    const wordsWithDefs = validItems.filter(function (item) {
      return item.type === 'word' && isUsableDefinition(item.definition, item.term, item.type);
    });
    const allWords = validItems.filter(function (item) { return item.type === 'word'; });

    const chosenPhrases = weightedSample(
      phrasesWithDefs,
      Math.min(phraseCount, phrasesWithDefs.length),
      scorePhraseValue,
      rng,
      { recent: recent, prioritizeMistakes: prioritizeMistakes }
    );

    const chosenWords = weightedSample(
      wordsWithDefs,
      Math.min(wordCount, wordsWithDefs.length),
      scoreWordValue,
      rng,
      { recent: recent, prioritizeMistakes: prioritizeMistakes }
    );

    const usedIds = new Set();
    chosenWords.forEach(function (item) { usedIds.add(item.id); });

    const unusedWords = allWords.filter(function (item) { return !usedIds.has(item.id); });
    const dictationScore = function (item) {
      let score = scoreWordValue(item.term) + 1;
      if (!isUsableDefinition(item.definition, item.term, item.type)) score += 1.2;
      return score;
    };

    let chosenDictation;
    if (unusedWords.length >= dictationCount) {
      chosenDictation = weightedSample(
        unusedWords,
        dictationCount,
        dictationScore,
        rng,
        { recent: recent, prioritizeMistakes: prioritizeMistakes }
      );
    } else {
      const freshSelections = weightedSample(
        unusedWords,
        unusedWords.length,
        dictationScore,
        rng,
        { recent: recent, prioritizeMistakes: prioritizeMistakes }
      );
      const usedPool = allWords.filter(function (item) { return usedIds.has(item.id); });
      const needed = dictationCount - freshSelections.length;
      const refill = weightedSample(
        usedPool,
        Math.min(needed, usedPool.length),
        dictationScore,
        rng,
        { recent: recent, prioritizeMistakes: prioritizeMistakes }
      );
      chosenDictation = freshSelections.concat(refill);
    }

    function toQuestion(item, mode) {
      return {
        id: uid('q'),
        itemId: item.id,
        term: item.term,
        type: item.type,
        definition: item.definition || '',
        spokenDefinition: mode === 'word-audio' ? item.term : maskDefinition(item.definition, item.term, item.type),
        chinese: item.chinese || '',
        pos: item.pos || '',
        phonetic: item.phonetic || '',
        source: item.source || '',
        mode: mode,
        result: null,
        userAnswer: '',
        hintUsed: false,
        answeredAt: ''
      };
    }

    const stages = [];
    if (chosenPhrases.length) {
      stages.push({
        id: uid('stage'),
        label: '词组释义',
        shortLabel: '词组',
        mode: 'phrase-def',
        questions: chosenPhrases.map(function (item) { return toQuestion(item, 'phrase-def'); })
      });
    }
    if (chosenWords.length) {
      stages.push({
        id: uid('stage'),
        label: '单词释义',
        shortLabel: '释义',
        mode: 'word-def',
        questions: chosenWords.map(function (item) { return toQuestion(item, 'word-def'); })
      });
    }
    if (chosenDictation.length) {
      stages.push({
        id: uid('stage'),
        label: '单词听写',
        shortLabel: '听写',
        mode: 'word-audio',
        questions: chosenDictation.map(function (item) { return toQuestion(item, 'word-audio'); })
      });
    }

    const warnings = [];
    if (chosenPhrases.length < phraseCount) {
      warnings.push({
        type: 'phrases',
        message: '带释义的词组不足，词组释义题已减少为 ' + chosenPhrases.length + ' 题'
      });
    }
    if (chosenWords.length < wordCount) {
      warnings.push({
        type: 'words',
        message: '带释义的单词不足，单词释义题已减少为 ' + chosenWords.length + ' 题'
      });
    }
    if (chosenDictation.length < dictationCount) {
      warnings.push({
        type: 'dictation',
        message: '单词数量不足，听写题已减少为 ' + chosenDictation.length + ' 题'
      });
    }

    const total = stages.reduce(function (sum, stage) { return sum + stage.questions.length; }, 0);

    return {
      stages: stages,
      warnings: warnings,
      counts: {
        phrases: chosenPhrases.length,
        words: chosenWords.length,
        dictation: chosenDictation.length,
        total: total
      }
    };
  }

  function letterMask(term) {
    const normalized = normalizeSpace(term);
    const words = normalized.split(' ').filter(Boolean);
    const maskedWords = words.map(function (word) {
      const chars = Array.from(word);
      let firstLetterSeen = false;
      return chars.map(function (ch) {
        if (/[A-Za-zÀ-ÿ]/.test(ch)) {
          if (!firstLetterSeen) {
            firstLetterSeen = true;
            return ch;
          }
          return '_';
        }
        return ch;
      }).join(' ');
    });
    const letters = (normalized.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    return {
      text: maskedWords.join('   '),
      letters: letters,
      words: words.length,
      meta: words.length > 1
        ? words.length + ' 个单词 · 共 ' + letters + ' 个字母'
        : '共 ' + letters + ' 个字母'
    };
  }

  function posLabel(pos) {
    if (!pos) return '';
    const key = String(pos).toLowerCase().trim();
    return POS_LABELS[key] || pos;
  }

  function percent(correct, total) {
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }

  function formatDuration(ms) {
    const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes <= 0) return rest + ' 秒';
    return minutes + ' 分 ' + String(rest).padStart(2, '0') + ' 秒';
  }

  /* ------------------------------------------------------------------ */
  /* 导出                                                                */
  /* ------------------------------------------------------------------ */

  return {
    COMMON_WORDS: COMMON_WORDS,
    POS_LABELS: POS_LABELS,
    uid: uid,
    escapeHtml: escapeHtml,
    escapeRegExp: escapeRegExp,
    normalizeSpace: normalizeSpace,
    cleanText: cleanText,
    hasCJK: hasCJK,
    normalizeTerm: normalizeTerm,
    normalizeKey: normalizeKey,
    detectType: detectType,
    isValidTerm: isValidTerm,
    parseWordList: parseWordList,
    normalizeAnswer: normalizeAnswer,
    compareAnswer: compareAnswer,
    levenshtein: levenshtein,
    maskDefinition: maskDefinition,
    isUsableDefinition: isUsableDefinition,
    cleanDefinitionForDisplay: cleanDefinitionForDisplay,
    scoreWordValue: scoreWordValue,
    scorePhraseValue: scorePhraseValue,
    selectSession: selectSession,
    letterMask: letterMask,
    posLabel: posLabel,
    percent: percent,
    formatDuration: formatDuration
  };
});
