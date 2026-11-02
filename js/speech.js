/*!
 * 词声 · speech.js
 * 基于浏览器 SpeechSynthesis 的英文朗读器。
 */
(function (global) {
  'use strict';

  const synth = global.speechSynthesis;
  const Utterance = global.SpeechSynthesisUtterance;

  function splitForSpeech(text) {
    const normalized = String(text == null ? '' : text)
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return [];

    const sentences = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [normalized];
    const chunks = [];
    let current = '';

    sentences.forEach(function (sentence) {
      const textPart = sentence.trim();
      if (!textPart) return;
      const combined = current ? current + ' ' + textPart : textPart;
      if (combined.length <= 220) {
        current = combined;
        return;
      }
      if (current) chunks.push(current);
      if (textPart.length > 220) {
        let rest = textPart;
        while (rest.length > 220) {
          let cut = rest.lastIndexOf(' ', 220);
          if (cut < 100) cut = 220;
          chunks.push(rest.slice(0, cut).trim());
          rest = rest.slice(cut).trim();
        }
        current = rest;
      } else {
        current = textPart;
      }
    });

    if (current) chunks.push(current);
    return chunks.filter(Boolean).slice(0, 12);
  }

  class SpeechEngine {
    constructor() {
      this.supported = !!(synth && Utterance);
      this.voices = [];
      this.token = 0;
      this.speaking = false;
      this.onStateChange = null;
      this.onVoicesChanged = null;
      this.timers = new Set();

      if (!this.supported) return;

      this.refreshVoices();
      const handleVoices = () => {
        this.refreshVoices();
        if (typeof this.onVoicesChanged === 'function') this.onVoicesChanged(this.voices);
      };

      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', handleVoices);
      } else {
        synth.onvoiceschanged = handleVoices;
      }

      [120, 450, 1200, 2500].forEach((delay) => {
        this.later(() => {
          if (!this.voices.length) {
            this.refreshVoices();
            if (typeof this.onVoicesChanged === 'function' && this.voices.length) {
              this.onVoicesChanged(this.voices);
            }
          }
        }, delay);
      });
    }

    later(fn, delay) {
      const id = global.setTimeout(() => {
        this.timers.delete(id);
        fn();
      }, delay);
      this.timers.add(id);
      return id;
    }

    clearTimers() {
      this.timers.forEach((id) => global.clearTimeout(id));
      this.timers.clear();
    }

    refreshVoices() {
      if (!this.supported) return;
      try {
        this.voices = synth.getVoices() || [];
      } catch (error) {
        this.voices = [];
      }
    }

    getEnglishVoices() {
      return this.voices.filter(function (voice) {
        return /^en(-|_|$)/i.test(voice.lang || '');
      });
    }

    voiceScore(voice) {
      let score = 0;
      const name = String(voice.name || '').toLowerCase();
      const lang = String(voice.lang || '').toLowerCase();
      if (voice.localService) score += 3;
      if (/natural|neural|premium|enhanced/.test(name)) score += 6;
      if (/google/.test(name)) score += 3;
      if (/aria|jenny|guy|zira|david|samantha|daniel|karen|serena|allison|ava|susan|mark|brian/.test(name)) {
        score += 2;
      }
      if (lang === 'en-us') score += 2;
      else if (lang === 'en-gb') score += 1.5;
      else if (lang.indexOf('en') === 0) score += 1;
      if (/compact|espeak/.test(name)) score -= 2;
      return score;
    }

    recommendedVoice() {
      const english = this.getEnglishVoices();
      if (!english.length) return null;
      return english.slice().sort((a, b) => this.voiceScore(b) - this.voiceScore(a))[0];
    }

    resolveVoice(voiceURI) {
      if (voiceURI) {
        const exact = this.voices.find(function (voice) {
          return voice.voiceURI === voiceURI || voice.name === voiceURI;
        });
        if (exact) return exact;
      }
      return this.recommendedVoice();
    }

    setSpeaking(value) {
      if (this.speaking === value) return;
      this.speaking = value;
      if (typeof this.onStateChange === 'function') {
        this.onStateChange({ speaking: value });
      }
    }

    cancel() {
      this.token += 1;
      this.clearTimers();
      if (this.supported) {
        try {
          synth.cancel();
        } catch (error) {
          /* ignore */
        }
      }
      this.setSpeaking(false);
    }

    _buildUtterance(text, options, token) {
      const utterance = new Utterance(text);
      const voice = this.resolveVoice(options.voiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = Math.max(0.4, Math.min(1.6, Number(options.rate) || 0.9));
      utterance.pitch = 1;
      utterance.volume = 1;
      return utterance;
    }

    speak(text, options) {
      const opts = options || {};
      if (!this.supported) {
        if (typeof opts.onError === 'function') {
          opts.onError({ error: 'unsupported', message: '当前浏览器不支持语音合成' });
        }
        return false;
      }

      const chunks = Array.isArray(opts.chunks) && opts.chunks.length
        ? opts.chunks.slice()
        : splitForSpeech(text);
      if (!chunks.length) {
        if (typeof opts.onError === 'function') {
          opts.onError({ error: 'empty', message: '没有可播报的文本' });
        }
        return false;
      }

      this.cancel();
      const token = this.token;
      const gaps = opts.gaps || [];
      let started = false;

      const run = (index) => {
        if (token !== this.token) return;
        if (index >= chunks.length) {
          this.setSpeaking(false);
          if (typeof opts.onEnd === 'function') opts.onEnd();
          return;
        }

        const chunk = chunks[index];
        let utterance;
        try {
          utterance = this._buildUtterance(chunk, opts, token);
        } catch (error) {
          this.setSpeaking(false);
          if (typeof opts.onError === 'function') {
            opts.onError({ error: 'speech-build-error', message: String(error) });
          }
          return;
        }
        let finished = false;
        let watchdog = null;

        const finishChunk = (error) => {
          if (finished || token !== this.token) return;
          finished = true;
          if (watchdog) {
            global.clearTimeout(watchdog);
            this.timers.delete(watchdog);
          }
          if (error && error.error !== 'interrupted' && error.error !== 'canceled') {
            this.setSpeaking(false);
            if (typeof opts.onError === 'function') opts.onError(error);
            return;
          }
          const gap = index < gaps.length ? gaps[index] : (opts.gapMs == null ? 100 : opts.gapMs);
          this.later(() => run(index + 1), Math.max(0, gap));
        };

        utterance.onend = () => {
          if (token !== this.token) return;
          finishChunk(null);
        };
        utterance.onerror = (event) => {
          if (token !== this.token) return;
          if (event && (event.error === 'interrupted' || event.error === 'canceled')) return;
          finishChunk(event || { error: 'speech-error' });
        };

        try {
          if (!started) {
            started = true;
            this.setSpeaking(true);
            if (typeof opts.onStart === 'function') opts.onStart();
          }
          synth.speak(utterance);
          const words = chunk.split(/\s+/).length;
          const rate = Math.max(0.4, Number(opts.rate) || 0.9);
          const estimated = Math.max(4500, (words / rate) * 620 + 2800);
          watchdog = this.later(() => {
            if (finished || token !== this.token) return;
            try { synth.cancel(); } catch (error) { /* ignore */ }
            finishChunk(null);
          }, estimated);
        } catch (error) {
          finishChunk({ error: 'speech-error', message: String(error) });
        }
      };

      this.later(() => run(0), 55);
      return true;
    }

    speakDefinition(text, options) {
      const opts = options || {};
      return this.speak(text, Object.assign({}, opts, {
        gapMs: 140
      }));
    }

    speakWord(term, options) {
      const opts = options || {};
      const repeats = Math.max(1, Math.min(4, Number(opts.repeats) || 1));
      const chunks = [];
      const gaps = [];
      for (let i = 0; i < repeats; i += 1) {
        chunks.push(term);
        if (i < repeats - 1) gaps.push(opts.repeatGap == null ? 720 : opts.repeatGap);
      }
      return this.speak(term, Object.assign({}, opts, {
        chunks: chunks,
        gaps: gaps,
        gapMs: 0
      }));
    }

    speakSample(options) {
      return this.speak(
        'Welcome to WordVoice. Listen carefully, and write down the words you hear.',
        Object.assign({ rate: 0.95 }, options || {})
      );
    }
  }

  global.SpeechEngine = SpeechEngine;
  global.speechEngine = new SpeechEngine();
  global.splitForSpeech = splitForSpeech;
})(typeof window !== 'undefined' ? window : globalThis);
