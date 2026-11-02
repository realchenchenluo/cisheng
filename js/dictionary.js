/*!
 * 词声 · dictionary.js
 * 英文释义自动补全：dictionaryapi.dev → Wiktionary → Datamuse 依次回退。
 * 结果缓存在本机 localStorage，词条释义不会被上传。
 */
(function (global) {
  'use strict';

  const Core = global.WordCore;
  const CACHE_KEY = 'ytj_definition_cache_v1';
  const CACHE_LIMIT = 1200;
  const REQUEST_TIMEOUT = 7000;

  let memoryCache = null;

  function loadCache() {
    if (memoryCache) return memoryCache;
    memoryCache = {};
    try {
      const raw = global.localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') memoryCache = parsed;
      }
    } catch (error) {
      memoryCache = {};
    }
    return memoryCache;
  }

  function saveCache(cache) {
    try {
      const entries = Object.keys(cache)
        .map(function (key) { return [key, cache[key]]; })
        .sort(function (a, b) { return (b[1].at || 0) - (a[1].at || 0); })
        .slice(0, CACHE_LIMIT);
      const trimmed = {};
      entries.forEach(function (entry) { trimmed[entry[0]] = entry[1]; });
      memoryCache = trimmed;
      global.localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      /* 缓存失败不影响正常查询 */
    }
  }

  function getCached(term) {
    const cache = loadCache();
    const key = Core.normalizeKey(term);
    const entry = cache[key];
    if (entry && entry.definition) {
      return Object.assign({}, entry, { cached: true });
    }
    return null;
  }

  function putCached(term, result) {
    const cache = loadCache();
    cache[Core.normalizeKey(term)] = Object.assign({}, result, {
      at: Date.now()
    });
    saveCache(cache);
  }

  function fetchJSON(url) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    const options = { headers: { Accept: 'application/json' } };
    if (controller) {
      options.signal = controller.signal;
      timer = global.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    }
    return global.fetch(url, options).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).finally(function () {
      if (timer) global.clearTimeout(timer);
    });
  }

  function cleanHtml(html) {
    if (!html) return '';
    let stripped = String(html)
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    stripped = stripped.replace(/<[^>]*>/g, ' ');
    if (typeof global.DOMParser !== 'undefined') {
      const doc = new global.DOMParser().parseFromString(stripped, 'text/html');
      return Core.normalizeSpace(doc.body ? doc.body.textContent : stripped);
    }
    return Core.cleanText(stripped);
  }

  function trimDefinition(raw) {
    let text = Core.normalizeSpace(raw)
      .replace(/^[;:,\-–—\s]+/, '')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim();

    if (text.length > 300) {
      const sentence = text.match(/^(.{40,270}?[.!?])(?:\s|$)/);
      if (sentence) {
        text = sentence[1];
      } else {
        text = text.slice(0, 260);
        const lastSpace = text.lastIndexOf(' ');
        if (lastSpace > 120) text = text.slice(0, lastSpace);
        if (!/[.!?]$/.test(text)) text += '.';
      }
    }
    return text;
  }

  const BAD_START = /^(used other than figuratively|alternative (form|spelling) of|misspelling of|obsolete (form|spelling)|archaic (form|spelling)|plural of|past tense of|past participle of|present participle of|simple past of|third-person singular|comparative of|superlative of|initialism of|abbreviation of|acronym of|synonym of|see also|this sense|a surname|a male given name|a female given name|a placename|a city in|a town in|a village in|an unincorporated community|a river in)/i;

  const MEDIA_DEFINITION = /\b(studio album|album|song|single by|film|television series|video game|soundtrack|band|novel|written by|directed by|released in|record label)\b/i;

  function isGoodDefinition(rawDefinition, term, type) {
    if (!rawDefinition) return false;
    const definition = trimDefinition(rawDefinition);
    if (!definition || definition.length < 8) return false;
    if (definition.split(/\s+/).length < 2) return false;
    if (definition.toLowerCase() === Core.normalizeSpace(term).toLowerCase()) return false;

    const bare = definition.replace(/^\([^)]{0,90}\)\s*/, '').trim();
    if (BAD_START.test(bare)) return false;
    if (/(^|\s)(alternative|obsolete|archaic|misspelling|initialism|abbreviation|acronym) (form|spelling|of)\b/i.test(bare)) {
      return false;
    }
    if ((type === 'phrase' || /\s/.test(term)) && MEDIA_DEFINITION.test(definition)) {
      return false;
    }
    if (type === 'phrase' && !/[A-Za-z]{3,}/.test(bare)) return false;
    return true;
  }

  function normalizePos(pos) {
    if (!pos) return '';
    const key = String(pos).toLowerCase().trim();
    const map = {
      n: 'noun',
      v: 'verb',
      adj: 'adjective',
      adv: 'adverb',
      u: ''
    };
    return map[key] !== undefined ? map[key] : key;
  }

  async function fromDictionaryApi(term) {
    const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(term);
    const data = await fetchJSON(url);
    if (!Array.isArray(data)) return null;

    for (let e = 0; e < data.length; e += 1) {
      const entry = data[e];
      if (!entry || !Array.isArray(entry.meanings)) continue;
      for (let m = 0; m < entry.meanings.length; m += 1) {
        const meaning = entry.meanings[m];
        const definitions = meaning && meaning.definitions;
        if (!Array.isArray(definitions)) continue;
        for (let d = 0; d < definitions.length; d += 1) {
          const definition = cleanHtml(definitions[d].definition);
          const type = /\s/.test(term) ? 'phrase' : 'word';
          if (!isGoodDefinition(definition, term, type)) continue;
          let phonetic = entry.phonetic || '';
          if (!phonetic && Array.isArray(entry.phonetics)) {
            const found = entry.phonetics.find(function (item) { return item && item.text; });
            if (found) phonetic = found.text;
          }
          return {
            definition: trimDefinition(definition),
            pos: normalizePos(meaning.partOfSpeech),
            phonetic: phonetic,
            source: 'dictionaryapi.dev'
          };
        }
      }
    }
    return null;
  }

  async function fromWiktionary(term) {
    const url = 'https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(term);
    const data = await fetchJSON(url);
    if (!data || !Array.isArray(data.en)) return null;

    for (let s = 0; s < data.en.length; s += 1) {
      const section = data.en[s];
      if (!section || !Array.isArray(section.definitions)) continue;
      for (let d = 0; d < section.definitions.length; d += 1) {
        const definition = cleanHtml(section.definitions[d].definition);
        const type = /\s/.test(term) ? 'phrase' : 'word';
        if (!isGoodDefinition(definition, term, type)) continue;
        return {
          definition: trimDefinition(definition),
          pos: normalizePos(section.partOfSpeech),
          phonetic: '',
          source: 'Wiktionary'
        };
      }
    }
    return null;
  }

  async function fromDatamuse(term) {
    const url = 'https://api.datamuse.com/words?sp=' + encodeURIComponent(term) + '&md=d&max=1';
    const data = await fetchJSON(url);
    if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0].defs)) return null;

    for (let i = 0; i < data[0].defs.length; i += 1) {
      const raw = String(data[0].defs[i] || '');
      const parts = raw.split('\t');
      const pos = parts.length > 1 ? parts[0] : '';
      const definition = cleanHtml(parts.length > 1 ? parts.slice(1).join(' ') : raw);
      const type = /\s/.test(term) ? 'phrase' : 'word';
      if (!isGoodDefinition(definition, term, type)) continue;
      return {
        definition: trimDefinition(definition),
        pos: normalizePos(pos),
        phonetic: '',
        source: 'Datamuse'
      };
    }
    return null;
  }

  async function lookup(term, options) {
    const normalized = Core.normalizeTerm(term);
    if (!normalized) return null;

    const cached = getCached(normalized);
    if (cached) return cached;

    const type = options && options.type ? options.type : Core.detectType(normalized);
    const providers = type === 'phrase'
      ? [fromWiktionary, fromDatamuse, fromDictionaryApi]
      : [fromDictionaryApi, fromWiktionary, fromDatamuse];

    let lastError = null;
    for (let i = 0; i < providers.length; i += 1) {
      try {
        const result = await providers[i](normalized);
        if (result && result.definition) {
          putCached(normalized, result);
          return Object.assign({ cached: false }, result);
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      console.warn('释义查询失败：' + normalized, lastError);
    }
    return null;
  }

  function clearCache() {
    memoryCache = {};
    try {
      global.localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function cacheSize() {
    return Object.keys(loadCache()).length;
  }

  global.WordDictionary = {
    lookup: lookup,
    getCached: getCached,
    clearCache: clearCache,
    cacheSize: cacheSize
  };
})(typeof window !== 'undefined' ? window : globalThis);
