/*!
 * 词声 · app.js
 * 应用逻辑：词库管理、语音出题、默写判分、成绩与错题重练。
 */
(function () {
  'use strict';

  const Core = window.WordCore;
  const Dict = window.WordDictionary;
  const speech = window.speechEngine;
  const escapeHtml = Core.escapeHtml;

  const STORAGE = {
    library: 'ytj_words_v1',
    settings: 'ytj_settings_v1',
    history: 'ytj_history_v1',
    session: 'ytj_session_v1'
  };

  const DEFAULT_SETTINGS = {
    voiceURI: '',
    rate: 0.9,
    autoPlay: true,
    dictationRepeats: 2,
    phraseCount: 3,
    wordCount: 8,
    prioritizeMistakes: true,
    theme: 'dark'
  };

  const MODE_META = {
    'phrase-def': {
      chip: '释义 → 词组',
      title: '听英文释义，写出对应的词组',
      placeholder: '在这里写下你听到的词组',
      idle: '点击扬声器播放英文释义',
      done: '播放完毕 · 可以再听一遍',
      playing: '正在播放英文释义…',
      kind: '词组'
    },
    'word-def': {
      chip: '释义 → 单词',
      title: '听英文释义，写出对应的单词',
      placeholder: '在这里写下你听到的单词',
      idle: '点击扬声器播放英文释义',
      done: '播放完毕 · 可以再听一遍',
      playing: '正在播放英文释义…',
      kind: '单词'
    },
    'word-audio': {
      chip: '发音 → 拼写',
      title: '听单词发音，写出拼写',
      placeholder: '在这里写下你听到的单词',
      idle: '点击扬声器播放单词发音',
      done: '播放完毕 · 可以再听一遍',
      playing: '正在播放单词发音…',
      kind: '听写'
    }
  };

  const ORDINALS = ['第一', '第二', '第三', '第四', '第五'];
  const SOURCE_LABELS = {
    import: '手动导入',
    manual: '手动填写',
    'dictionaryapi.dev': '自动释义 · dictionaryapi.dev',
    Wiktionary: '自动释义 · Wiktionary',
    Datamuse: '自动释义 · Datamuse'
  };

  const state = {
    items: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
    history: [],
    session: null,
    lastResult: null,
    ui: {
      filter: 'all',
      query: '',
      importParsed: null,
      fetchCancelled: false,
      editingId: null,
      editPos: '',
      editPhonetic: '',
      editSource: '',
      editFetchedTerm: '',
      autoPlayTimer: null,
      storageWarned: false,
      ttsWarned: false,
      fetchRunning: false,
      ocrFile: null,
      ocrRunning: false,
      ocrUiToken: 0,
      ocrPreviewUrl: '',
      ocrLastResult: null
    }
  };

  const OCR_PROGRESS_RANGES = {
    'loading tesseract core': [0, 12],
    'initializing tesseract': [12, 18],
    'loading language traineddata': [18, 55],
    'initializing api': [55, 62],
    'recognizing text': [62, 100]
  };

  const OCR_STATUS_LABELS = {
    'loading tesseract core': '加载识别引擎',
    'initializing tesseract': '初始化识别引擎',
    'loading language traineddata': '加载英文 / 中文模型',
    'initializing api': '准备文字识别',
    'recognizing text': '正在识别文字'
  };

  const els = {};

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */

  function $(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    const ids = [
      'brand-home', 'btn-help', 'btn-settings', 'btn-format-help',
      'screen-setup', 'screen-quiz', 'screen-result',
      'resume-banner', 'resume-meta', 'btn-resume', 'btn-discard-session',
      'dropzone', 'file-input', 'btn-choose-file', 'btn-paste', 'btn-sample',
      'library-total-pill', 'missing-banner', 'missing-text', 'btn-fetch-missing',
      'library-toolbar', 'library-search', 'filter-chips', 'library-list',
      'library-footer', 'library-visible-count', 'btn-add-item', 'btn-fetch-defs',
      'btn-export', 'btn-clear-library',
      'round-count-phrases', 'round-count-words', 'round-count-dictation',
      'readiness', 'session-time', 'btn-start', 'btn-start-label', 'start-note',
      'history-list', 'history-best', 'hero-caption-text',
      'btn-theme', 'btn-hero-start', 'btn-hero-start-label', 'btn-hero-photo',
      'mobile-cta', 'mobile-cta-title', 'mobile-cta-sub', 'btn-mobile-start',
      'btn-photo', 'photo-input',
      'ocr-dialog', 'ocr-preview', 'ocr-status', 'ocr-spinner', 'ocr-bar',
      'ocr-hint', 'btn-ocr-retry', 'btn-ocr-replace', 'ocr-text',
      'ocr-parse-preview', 'btn-ocr-import', 'btn-ocr-close',
      'btn-ocr-cancel',
      'btn-exit-quiz', 'stage-label', 'question-counter', 'overall-progress',
      'quiz-score', 'mode-chip', 'pos-chip', 'question-title', 'question-sub',
      'audio-orbit', 'btn-play', 'audio-status', 'btn-replay', 'btn-slow',
      'answer-form', 'answer-input', 'btn-submit-answer', 'btn-hint',
      'btn-giveup', 'hint-box', 'feedback', 'stage-map-title', 'stage-dots',
      'question-card',
      'score-ring', 'result-percent', 'result-fraction', 'result-title',
      'result-subtitle', 'result-meta', 'result-breakdown', 'mistake-count',
      'result-mistakes', 'btn-retry-mistakes', 'btn-new-session',
      'btn-back-library',
      'settings-dialog', 'voice-select', 'voice-help', 'btn-test-voice',
      'rate-range', 'rate-value', 'phrase-count', 'word-count',
      'dictation-repeats', 'auto-play', 'prioritize-mistakes',
      'btn-reset-progress',
      'edit-dialog', 'edit-form', 'edit-kicker', 'edit-title', 'edit-id',
      'edit-term', 'edit-definition', 'edit-chinese', 'edit-starred',
      'edit-source', 'btn-edit-close', 'btn-delete-item', 'btn-fetch-one',
      'btn-save-item',
      'import-dialog', 'import-form', 'import-text', 'import-preview',
      'btn-import-close', 'btn-import-cancel', 'btn-import-confirm',
      'help-dialog', 'btn-help-close', 'btn-help-ok',
      'confirm-dialog', 'confirm-icon', 'confirm-title', 'confirm-body',
      'confirm-cancel', 'confirm-ok',
      'fetch-dialog', 'fetch-status', 'fetch-bar', 'fetch-current',
      'btn-fetch-cancel',
      'toast-region'
    ];
    ids.forEach(function (id) {
      els[id.replace(/-([a-z])/g, function (_, letter) {
        return letter.toUpperCase();
      })] = $(id);
    });
  }

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (!state.ui.storageWarned) {
        state.ui.storageWarned = true;
        toast('浏览器存储不可用，当前修改只在本次页面内有效。', 'error', 5200);
      }
      return false;
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      /* ignore */
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sleep(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const context = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  function formatDate(iso) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    } catch (error) {
      return date.toLocaleString();
    }
  }

  function stageOrdinal(index) {
    return ORDINALS[index] || '第' + (index + 1);
  }

  function getModeMeta(mode) {
    return MODE_META[mode] || MODE_META['word-audio'];
  }

  function getModeLabel(mode) {
    return {
      'phrase-def': '词组释义',
      'word-def': '单词释义',
      'word-audio': '发音听写'
    }[mode] || '听写';
  }

  function sourceLabel(source) {
    return SOURCE_LABELS[source] || (source ? '来源：' + source : '');
  }

  /* ------------------------------------------------------------------ */
  /* 数据加载与清理                                                      */
  /* ------------------------------------------------------------------ */

  function sanitizeSettings(raw) {
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    if (!raw || typeof raw !== 'object') return settings;
    if (typeof raw.voiceURI === 'string') settings.voiceURI = raw.voiceURI;
    if (Number.isFinite(Number(raw.rate))) settings.rate = clamp(Number(raw.rate), 0.6, 1.2);
    if (typeof raw.autoPlay === 'boolean') settings.autoPlay = raw.autoPlay;
    if (Number(raw.dictationRepeats) >= 1 && Number(raw.dictationRepeats) <= 3) {
      settings.dictationRepeats = Math.round(Number(raw.dictationRepeats));
    }
    settings.phraseCount = Number(raw.phraseCount) === 2 ? 2 : 3;
    settings.wordCount = Number(raw.wordCount) === 7 ? 7 : 8;
    if (typeof raw.prioritizeMistakes === 'boolean') {
      settings.prioritizeMistakes = raw.prioritizeMistakes;
    }
    settings.theme = raw.theme === 'light' ? 'light' : 'dark';
    return settings;
  }

  function sanitizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const term = Core.normalizeTerm(raw.term || raw.word || '');
    if (!Core.isValidTerm(term)) return null;
    const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : Core.uid('item'),
      term: term,
      type: Core.detectType(term),
      definition: typeof raw.definition === 'string' ? raw.definition.slice(0, 1000) : '',
      chinese: typeof raw.chinese === 'string' ? raw.chinese.slice(0, 300) : '',
      pos: typeof raw.pos === 'string' ? raw.pos.slice(0, 80) : '',
      phonetic: typeof raw.phonetic === 'string' ? raw.phonetic.slice(0, 120) : '',
      source: typeof raw.source === 'string' ? raw.source : '',
      starred: !!raw.starred,
      stats: {
        attempts: Math.max(0, Number(stats.attempts) || 0),
        correct: Math.max(0, Number(stats.correct) || 0),
        wrong: Math.max(0, Number(stats.wrong) || 0)
      },
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
    };
  }

  function loadLibrary() {
    const raw = readJSON(STORAGE.library, []);
    if (!Array.isArray(raw)) return [];
    const byKey = new Map();
    const usedIds = new Set();
    const items = [];

    raw.forEach(function (rawItem) {
      const item = sanitizeItem(rawItem);
      if (!item) return;
      const key = Core.normalizeKey(item.term);
      if (byKey.has(key)) {
        const existing = items[byKey.get(key)];
        if (!existing.definition && item.definition) existing.definition = item.definition;
        if (!existing.chinese && item.chinese) existing.chinese = item.chinese;
        if (!existing.pos && item.pos) existing.pos = item.pos;
        if (!existing.phonetic && item.phonetic) existing.phonetic = item.phonetic;
        if (!existing.source && item.source) existing.source = item.source;
        existing.starred = existing.starred || item.starred;
        return;
      }
      if (usedIds.has(item.id)) item.id = Core.uid('item');
      usedIds.add(item.id);
      byKey.set(key, items.length);
      items.push(item);
    });

    return items;
  }

  function loadHistory() {
    const raw = readJSON(STORAGE.history, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (entry) {
      return entry && typeof entry === 'object' && Number.isFinite(Number(entry.total));
    }).slice(0, 20).map(function (entry) {
      const total = Math.max(0, Number(entry.total) || 0);
      const correct = clamp(Number(entry.correct) || 0, 0, total);
      return {
        id: typeof entry.id === 'string' ? entry.id : Core.uid('history'),
        date: typeof entry.date === 'string' ? entry.date : new Date().toISOString(),
        correct: correct,
        total: total,
        percent: total ? Core.percent(correct, total) : 0,
        durationMs: Math.max(0, Number(entry.durationMs) || 0),
        isRetry: !!entry.isRetry,
        testedIds: Array.isArray(entry.testedIds) ? entry.testedIds.slice(0, 60) : [],
        stageStats: Array.isArray(entry.stageStats) ? entry.stageStats.map(function (s) {
          return {
            label: String(s.label || ''),
            correct: Math.max(0, Number(s.correct) || 0),
            total: Math.max(0, Number(s.total) || 0)
          };
        }) : []
      };
    });
  }

  function sanitizeSession(raw) {
    if (!raw || typeof raw !== 'object' || raw.finished) return null;
    if (!Array.isArray(raw.stages) || !raw.stages.length) return null;

    const stages = [];
    raw.stages.forEach(function (stage) {
      if (!stage || !Array.isArray(stage.questions) || !stage.questions.length) return;
      const questions = [];
      stage.questions.forEach(function (q) {
        if (!q || typeof q !== 'object') return;
        const term = Core.normalizeTerm(q.term || '');
        if (!Core.isValidTerm(term)) return;
        const mode = MODE_META[q.mode] ? q.mode : (MODE_META[stage.mode] ? stage.mode : 'word-audio');
        const result = q.result === 'correct' || q.result === 'wrong' ? q.result : null;
        questions.push({
          id: typeof q.id === 'string' && q.id ? q.id : Core.uid('q'),
          itemId: typeof q.itemId === 'string' ? q.itemId : '',
          term: term,
          type: Core.detectType(term),
          definition: typeof q.definition === 'string' ? q.definition : '',
          spokenDefinition: typeof q.spokenDefinition === 'string' ? q.spokenDefinition : '',
          chinese: typeof q.chinese === 'string' ? q.chinese : '',
          pos: typeof q.pos === 'string' ? q.pos : '',
          phonetic: typeof q.phonetic === 'string' ? q.phonetic : '',
          source: typeof q.source === 'string' ? q.source : '',
          mode: mode,
          result: result,
          userAnswer: typeof q.userAnswer === 'string' ? q.userAnswer : '',
          hintUsed: !!q.hintUsed,
          givenUp: !!q.givenUp,
          compare: q.compare && typeof q.compare === 'object' ? q.compare : null,
          answeredAt: typeof q.answeredAt === 'string' ? q.answeredAt : ''
        });
      });
      if (!questions.length) return;
      stages.push({
        id: typeof stage.id === 'string' && stage.id ? stage.id : Core.uid('stage'),
        label: String(stage.label || '语音测试'),
        shortLabel: String(stage.shortLabel || stage.label || '测试'),
        mode: String(stage.mode || 'mixed'),
        questions: questions
      });
    });

    if (!stages.length) return null;
    const total = stages.reduce(function (sum, stage) { return sum + stage.questions.length; }, 0);
    let stageIndex = clamp(Math.floor(Number(raw.stageIndex) || 0), 0, stages.length - 1);
    let questionIndex = clamp(Math.floor(Number(raw.questionIndex) || 0), 0, stages[stageIndex].questions.length - 1);

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : Core.uid('session'),
      startedAt: Number(raw.startedAt) || Date.now(),
      stages: stages,
      stageIndex: stageIndex,
      questionIndex: questionIndex,
      total: total,
      isRetry: !!raw.isRetry
    };
  }

  function loadState() {
    state.items = loadLibrary();
    state.settings = sanitizeSettings(readJSON(STORAGE.settings, null));
    state.history = loadHistory();
    state.session = sanitizeSession(readJSON(STORAGE.session, null));
  }

  function saveLibrary() {
    writeJSON(STORAGE.library, state.items);
  }

  function saveSettings() {
    writeJSON(STORAGE.settings, state.settings);
  }

  function saveHistory() {
    writeJSON(STORAGE.history, state.history);
  }

  function saveSession() {
    if (state.session) writeJSON(STORAGE.session, state.session);
    else removeStorage(STORAGE.session);
  }

  function hasUsableDef(item) {
    return !!(item && Core.isUsableDefinition(item.definition, item.term, item.type));
  }

  function getMissingItems() {
    return state.items.filter(function (item) { return !hasUsableDef(item); });
  }

  function getRecentIds() {
    const last = state.history[0];
    return last && Array.isArray(last.testedIds) ? last.testedIds : [];
  }

  /* ------------------------------------------------------------------ */
  /* 初始化与语音                                                        */
  /* ------------------------------------------------------------------ */

  function init() {
    cacheElements();
    loadState();
    applyTheme(state.settings.theme, false);
    bindEvents();

    if (speech) {
      speech.onStateChange = handleSpeechState;
      speech.onVoicesChanged = function () {
        populateVoiceOptions();
        updateStartAvailability();
      };
    }

    populateVoiceOptions();
    syncSettingsUI();
    renderAll();
    showScreen('setup');

    if (!speech || !speech.supported) {
      updateStartAvailability();
      window.setTimeout(function () {
        toast('当前浏览器不支持语音合成，请使用 Chrome 或 Edge。', 'error', 6000);
      }, 500);
    } else if (speech.getEnglishVoices().length === 0) {
      window.setTimeout(function () {
        if (speech.getEnglishVoices().length === 0) {
          toast('暂未检测到英文语音。可在“设置”中检查，或安装系统英语语音包。', 'info', 5600);
        }
      }, 1800);
    }

    window.addEventListener('beforeunload', function () {
      if (speech) speech.cancel();
      if (window.WordOCR) window.WordOCR.abort().catch(function () {});
    });
  }

  function handleSpeechState(payload) {
    const speaking = !!(payload && payload.speaking);
    if (els.audioOrbit) els.audioOrbit.classList.toggle('is-speaking', speaking);
    if (!els.audioStatus) return;

    const q = getCurrentQuestion();
    if (speaking) {
      const meta = q ? getModeMeta(q.mode) : null;
      els.audioStatus.textContent = meta ? meta.playing : '正在播放…';
      els.audioStatus.classList.add('is-playing');
      return;
    }

    if (els.audioStatus.classList.contains('is-playing')) {
      els.audioStatus.classList.remove('is-playing');
      const meta = q ? getModeMeta(q.mode) : null;
      els.audioStatus.textContent = meta ? meta.done : '点击扬声器播放语音';
    }
  }

  function bindEvents() {
    els.brandHome.addEventListener('click', function () {
      if (document.body.dataset.screen === 'quiz') {
        exitQuiz();
      } else {
        showSetupScreen();
      }
    });

    els.btnTheme.addEventListener('click', function () {
      applyTheme(state.settings.theme === 'dark' ? 'light' : 'dark', true);
    });
    els.btnHeroStart.addEventListener('click', handleHeroStart);
    els.btnMobileStart.addEventListener('click', handleHeroStart);
    els.btnHeroPhoto.addEventListener('click', openPhotoPicker);
    els.btnHelp.addEventListener('click', openHelp);
    els.btnFormatHelp.addEventListener('click', openHelp);
    els.btnSettings.addEventListener('click', function () {
      if (speech && speech.supported) speech.refreshVoices();
      populateVoiceOptions();
      syncSettingsUI();
      if (!els.settingsDialog.open) els.settingsDialog.showModal();
      resetDialogScroll(els.settingsDialog);
    });

    els.resumeBanner.addEventListener('click', function (event) {
      if (event.target.closest('button')) return;
      resumeSession();
    });
    els.btnResume.addEventListener('click', resumeSession);
    els.btnDiscardSession.addEventListener('click', discardSession);

    els.dropzone.addEventListener('click', function (event) {
      if (event.target.closest('button')) return;
      els.fileInput.click();
    });
    els.dropzone.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        els.fileInput.click();
      }
    });
    els.dropzone.addEventListener('dragover', function (event) {
      event.preventDefault();
      els.dropzone.classList.add('is-dragover');
    });
    els.dropzone.addEventListener('dragleave', function (event) {
      if (event.relatedTarget && els.dropzone.contains(event.relatedTarget)) return;
      els.dropzone.classList.remove('is-dragover');
    });
    els.dropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      els.dropzone.classList.remove('is-dragover');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    els.fileInput.addEventListener('change', function () {
      const file = els.fileInput.files && els.fileInput.files[0];
      if (file) handleFile(file);
      els.fileInput.value = '';
    });

    els.btnPhoto.addEventListener('click', function (event) {
      event.stopPropagation();
      openPhotoPicker();
    });
    els.photoInput.addEventListener('change', function () {
      const file = els.photoInput.files && els.photoInput.files[0];
      if (file) handleImageFile(file);
      els.photoInput.value = '';
    });

    els.btnChooseFile.addEventListener('click', function (event) {
      event.stopPropagation();
      els.fileInput.click();
    });
    els.btnPaste.addEventListener('click', function (event) {
      event.stopPropagation();
      openImportDialog('');
    });
    els.btnSample.addEventListener('click', function (event) {
      event.stopPropagation();
      loadSample();
    });
    els.btnFetchMissing.addEventListener('click', startBulkFetch);
    els.btnFetchDefs.addEventListener('click', startBulkFetch);
    els.btnAddItem.addEventListener('click', function () { openEditDialog(null); });
    els.btnExport.addEventListener('click', exportLibrary);
    els.btnClearLibrary.addEventListener('click', clearLibrary);

    els.librarySearch.addEventListener('input', debounce(function () {
      state.ui.query = els.librarySearch.value.trim().toLowerCase();
      renderLibraryList();
    }, 120));

    els.filterChips.addEventListener('click', function (event) {
      const chip = event.target.closest('[data-filter]');
      if (!chip) return;
      state.ui.filter = chip.dataset.filter;
      Array.from(els.filterChips.querySelectorAll('[data-filter]')).forEach(function (item) {
        item.classList.toggle('is-active', item.dataset.filter === state.ui.filter);
      });
      renderLibraryList();
    });

    els.libraryList.addEventListener('click', handleLibraryClick);
    els.btnStart.addEventListener('click', startNewSession);
    els.btnExitQuiz.addEventListener('click', exitQuiz);
    els.btnPlay.addEventListener('click', function () { playCurrent(false, false); });
    els.btnReplay.addEventListener('click', function () { playCurrent(false, false); });
    els.btnSlow.addEventListener('click', function () { playCurrent(true, false); });
    els.answerForm.addEventListener('submit', submitAnswer);
    els.btnHint.addEventListener('click', showHint);
    els.btnGiveup.addEventListener('click', giveUp);
    els.feedback.addEventListener('click', handleFeedbackClick);

    els.btnRetryMistakes.addEventListener('click', startRetrySession);
    els.btnNewSession.addEventListener('click', function () {
      showSetupScreen();
      startNewSession();
    });
    els.btnBackLibrary.addEventListener('click', function () {
      state.lastResult = null;
      showSetupScreen();
    });
    els.resultMistakes.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-speak-term]');
      if (!btn) return;
      speakTerm(btn.dataset.speakTerm);
    });

    bindSettingsEvents();
    bindEditEvents();
    bindImportEvents();
    bindOcrEvents();
    bindDialogEvents();

    document.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('resize', function () {
      if (state.session) updateQuizHeader();
    });
  }

  function handleGlobalKeydown(event) {
    if (!state.session || document.body.dataset.screen !== 'quiz') return;
    if (event.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;

    if (event.altKey && (event.key === 'r' || event.key === 'R')) {
      event.preventDefault();
      playCurrent(false, false);
      return;
    }

    const tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (event.key === 'Escape') {
        els.answerInput.blur();
      }
      return;
    }
    if (event.key === 'Enter') {
      const q = getCurrentQuestion();
      if (q && q.result) {
        event.preventDefault();
        nextQuestion();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 设置                                                                */
  /* ------------------------------------------------------------------ */

  function bindSettingsEvents() {
    els.voiceSelect.addEventListener('change', function () {
      state.settings.voiceURI = els.voiceSelect.value;
      saveSettings();
    });
    els.rateRange.addEventListener('input', function () {
      els.rateValue.textContent = Number(els.rateRange.value).toFixed(2) + '×';
    });
    els.rateRange.addEventListener('change', function () {
      state.settings.rate = clamp(Number(els.rateRange.value) || 0.9, 0.6, 1.2);
      saveSettings();
    });
    els.phraseCount.addEventListener('change', function () {
      state.settings.phraseCount = Number(els.phraseCount.value) === 2 ? 2 : 3;
      saveSettings();
      renderSessionCard();
    });
    els.wordCount.addEventListener('change', function () {
      state.settings.wordCount = Number(els.wordCount.value) === 7 ? 7 : 8;
      saveSettings();
      renderSessionCard();
    });
    els.dictationRepeats.addEventListener('change', function () {
      state.settings.dictationRepeats = clamp(Math.round(Number(els.dictationRepeats.value) || 2), 1, 3);
      saveSettings();
    });
    els.autoPlay.addEventListener('change', function () {
      state.settings.autoPlay = els.autoPlay.checked;
      saveSettings();
    });
    els.prioritizeMistakes.addEventListener('change', function () {
      state.settings.prioritizeMistakes = els.prioritizeMistakes.checked;
      saveSettings();
    });
    els.btnTestVoice.addEventListener('click', function () {
      if (!speech || !speech.supported) {
        toast('当前浏览器不支持语音合成。', 'error');
        return;
      }
      if (!speech.getEnglishVoices().length) {
        toast('未检测到英文语音，请安装系统英语语音包。', 'error', 4200);
      }
      speech.speak('Listen carefully. Write down the words you hear.', {
        rate: state.settings.rate,
        voiceURI: state.settings.voiceURI,
        onError: function () {
          toast('语音播放失败，请检查系统语音设置。', 'error');
        }
      });
    });
    els.btnResetProgress.addEventListener('click', resetProgress);
  }

  function populateVoiceOptions() {
    if (!els.voiceSelect) return;
    const previous = state.settings.voiceURI || '';
    const voices = speech && speech.supported ? speech.getEnglishVoices() : [];
    const sorted = voices.slice().sort(function (a, b) {
      const scoreDiff = speech.voiceScore(b) - speech.voiceScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.name).localeCompare(String(b.name));
    });

    let html = '<option value="">自动选择（推荐）</option>';
    if (!speech || !speech.supported) {
      html = '<option value="">浏览器不支持语音合成</option>';
    } else if (!sorted.length) {
      html = '<option value="">未检测到英文语音</option>';
    } else {
      sorted.forEach(function (voice) {
        const label = voice.name + ' · ' + voice.lang + (voice.localService ? '' : ' · 在线');
        html += '<option value="' + escapeHtml(voice.voiceURI) + '">' + escapeHtml(label) + '</option>';
      });
    }
    els.voiceSelect.innerHTML = html;

    if (previous && sorted.some(function (v) { return v.voiceURI === previous; })) {
      els.voiceSelect.value = previous;
    } else {
      els.voiceSelect.value = '';
      // 语音列表在部分浏览器里会异步加载；列表为空时不要清掉用户已保存的选择。
      if (previous && sorted.length > 0 && speech && speech.supported) {
        state.settings.voiceURI = '';
        saveSettings();
      }
    }

    if (!speech || !speech.supported) {
      els.voiceHelp.textContent = '当前浏览器不支持语音合成。请使用 Chrome 或 Edge。';
      els.btnTestVoice.disabled = true;
    } else if (!sorted.length) {
      els.voiceHelp.textContent = '没有检测到英文语音。请在系统设置中安装英语语音包，或改用 Chrome / Edge。';
      els.btnTestVoice.disabled = false;
    } else {
      els.voiceHelp.textContent = '推荐 Natural / Google / Microsoft 英文语音，发音更自然。当前检测到 ' + sorted.length + ' 个英文语音。';
      els.btnTestVoice.disabled = false;
    }
    updateStartAvailability();
  }

  function syncSettingsUI() {
    els.voiceSelect.value = state.settings.voiceURI || '';
    els.rateRange.value = String(state.settings.rate);
    els.rateValue.textContent = Number(state.settings.rate).toFixed(2) + '×';
    els.phraseCount.value = String(state.settings.phraseCount);
    els.wordCount.value = String(state.settings.wordCount);
    els.dictationRepeats.value = String(state.settings.dictationRepeats);
    els.autoPlay.checked = !!state.settings.autoPlay;
    els.prioritizeMistakes.checked = !!state.settings.prioritizeMistakes;
  }

  async function resetProgress() {
    const ok = await confirmAction({
      title: '清除学习记录？',
      body: '会清空最近成绩和每个词的答对/答错统计，词库与释义不会删除。',
      confirmText: '清除记录',
      danger: true
    });
    if (!ok) return;
    state.history = [];
    state.items.forEach(function (item) {
      item.stats = { attempts: 0, correct: 0, wrong: 0 };
    });
    state.lastResult = null;
    saveHistory();
    saveLibrary();
    renderAll();
    toast('学习记录已清除。', 'success');
  }

  /* ------------------------------------------------------------------ */
  /* 渲染：首页 / 词库                                                   */
  /* ------------------------------------------------------------------ */

  function renderAll() {
    renderLibraryMeta();
    renderLibraryList();
    renderSessionCard();
    renderHistory();
    renderResume();
    updateStartAvailability();
  }

  function renderLibraryMeta() {
    const items = state.items;
    const phrases = items.filter(function (i) { return i.type === 'phrase'; }).length;
    const words = items.length - phrases;
    const starred = items.filter(function (i) { return i.starred; }).length;
    const missing = getMissingItems().length;

    els.libraryTotalPill.textContent = items.length + ' 条';
    const counts = {
      all: items.length,
      word: words,
      phrase: phrases,
      missing: missing,
      starred: starred
    };
    Array.from(els.filterChips.querySelectorAll('[data-count]')).forEach(function (node) {
      node.textContent = String(counts[node.dataset.count] || 0);
    });

    els.libraryToolbar.hidden = items.length === 0;
    els.libraryFooter.hidden = items.length === 0;
    els.btnFetchDefs.disabled = missing === 0;
    els.btnExport.disabled = items.length === 0;
    els.btnClearLibrary.disabled = items.length === 0;
    if (els.heroCaptionText) {
      els.heroCaptionText.textContent = items.length
        ? '词库已在耳边 · 随时开始'
        : '正在等待你的词库';
    }

    if (items.length && missing > 0) {
      els.missingBanner.hidden = false;
      els.missingText.textContent = '有 ' + missing + ' 条缺少可用的英文释义，无法进入前两轮。';
    } else {
      els.missingBanner.hidden = true;
    }
  }

  function matchesFilter(item, filter) {
    if (filter === 'word') return item.type === 'word';
    if (filter === 'phrase') return item.type === 'phrase';
    if (filter === 'missing') return !hasUsableDef(item);
    if (filter === 'starred') return item.starred;
    return true;
  }

  function renderLibraryList() {
    const query = state.ui.query;
    const filtered = state.items.filter(function (item) {
      if (!matchesFilter(item, state.ui.filter)) return false;
      if (!query) return true;
      return (
        item.term.toLowerCase().indexOf(query) !== -1 ||
        item.definition.toLowerCase().indexOf(query) !== -1 ||
        item.chinese.toLowerCase().indexOf(query) !== -1
      );
    });

    els.libraryVisibleCount.textContent = '显示 ' + filtered.length + ' / ' + state.items.length + ' 条';

    if (!state.items.length) {
      els.libraryList.innerHTML = [
        '<div class="empty-state">',
        '  <div class="empty-icon"><svg class="icon"><use href="#i-book"></use></svg></div>',
        '  <div class="empty-title">先放进一组词</div>',
        '  <p class="empty-text">拍下词表，或上传 .txt / .csv、直接粘贴文本。识别结果会先让你核对，再导入词库。</p>',
        '  <div class="empty-actions">',
        '    <button class="btn btn-primary btn-sm" data-action="photo"><svg class="icon"><use href="#i-camera"></use></svg>拍照导入</button>',
        '    <button class="btn btn-ghost btn-sm" data-action="choose-file">选择文件</button>',
        '    <button class="btn btn-ghost btn-sm" data-action="paste">粘贴文本</button>',
        '    <button class="btn btn-ghost btn-sm" data-action="sample">载入示例</button>',
        '  </div>',
        '</div>'
      ].join('');
      return;
    }

    if (!filtered.length) {
      els.libraryList.innerHTML = '<div class="filter-empty">没有匹配的条目。换个关键词，或切换筛选条件。</div>';
      return;
    }

    const rows = filtered.map(function (item) {
      const wrongCount = item.stats && item.stats.wrong ? item.stats.wrong : 0;
      const def = item.definition
        ? escapeHtml(item.definition)
        : '<span class="missing-def">缺少英文释义</span>';
      return [
        '<div class="lib-row' + (item.starred ? ' is-starred' : '') + '" data-id="' + escapeHtml(item.id) + '">',
        '  <button class="star-btn' + (item.starred ? ' is-on' : '') + '" data-action="star" aria-pressed="' + (item.starred ? 'true' : 'false') + '" aria-label="' + (item.starred ? '取消重点标记' : '标记为重点词') + '" title="' + (item.starred ? '取消重点标记' : '标记为重点词') + '">',
        '    <svg class="icon"><use href="#i-star"></use></svg>',
        '  </button>',
        '  <div class="lib-main">',
        '    <div class="lib-term-line">',
        '      <span class="lib-term">' + escapeHtml(item.term) + '</span>',
        '      <span class="type-badge ' + (item.type === 'phrase' ? 'phrase' : '') + '">' + (item.type === 'phrase' ? '词组' : '单词') + '</span>',
        item.starred ? '      <span class="badge-star">重点</span>' : '',
        wrongCount ? '      <span class="badge-wrong">易错 ' + wrongCount + '</span>' : '',
        '    </div>',
        '    <div class="lib-def">' + def + '</div>',
        item.chinese ? '    <div class="lib-cn">' + escapeHtml(item.chinese) + '</div>' : '',
        '  </div>',
        '  <div class="lib-actions">',
        '    <button class="icon-btn" data-action="edit" aria-label="编辑 ' + escapeHtml(item.term) + '" title="编辑">',
        '      <svg class="icon"><use href="#i-edit"></use></svg>',
        '    </button>',
        '    <button class="icon-btn" data-action="delete" aria-label="删除 ' + escapeHtml(item.term) + '" title="删除">',
        '      <svg class="icon"><use href="#i-trash"></use></svg>',
        '    </button>',
        '  </div>',
        '</div>'
      ].join('');
    });

    els.libraryList.innerHTML = rows.join('');
  }

  function renderSessionCard() {
    const phrases = state.items.filter(function (i) { return i.type === 'phrase' && hasUsableDef(i); });
    const words = state.items.filter(function (i) { return i.type === 'word' && hasUsableDef(i); });
    const allWords = state.items.filter(function (i) { return i.type === 'word'; });
    const targetPhrases = Math.min(state.settings.phraseCount, phrases.length);
    const targetWords = Math.min(state.settings.wordCount, words.length);
    const targetDictation = Math.min(10, allWords.length);
    const total = targetPhrases + targetWords + targetDictation;
    const missing = getMissingItems().length;

    els.roundCountPhrases.textContent = targetPhrases + ' 题';
    els.roundCountWords.textContent = targetWords + ' 题';
    els.roundCountDictation.textContent = targetDictation + ' 题';
    els.roundCountPhrases.classList.toggle('is-reduced', targetPhrases < state.settings.phraseCount);
    els.roundCountWords.classList.toggle('is-reduced', targetWords < state.settings.wordCount);
    els.roundCountDictation.classList.toggle('is-reduced', targetDictation < 10);

    const minutes = Math.max(2, Math.round((total * 28 + 30) / 60));
    els.sessionTime.textContent = total ? '约 ' + minutes + ' 分钟' : '等待词库';

    const lines = [];
    let modeClass = '';
    if (!state.items.length) {
      lines.push('词库为空。先上传词表，或载入示例体验。');
    } else if (total === 0) {
      lines.push('当前没有可出题的词条，请检查词库。');
    } else {
      const full = targetPhrases >= state.settings.phraseCount &&
        targetWords >= state.settings.wordCount &&
        targetDictation >= 10;
      if (full && !missing) {
        modeClass = 'is-ready';
        lines.push('<span class="ready-mark"><svg class="icon"><use href="#i-check"></use></svg>词库就绪</span>');
        lines.push('本次共 ' + total + ' 题：词组 ' + targetPhrases + ' · 释义 ' + targetWords + ' · 听写 ' + targetDictation + '。');
      } else {
        modeClass = 'is-limited';
        if (targetPhrases < state.settings.phraseCount) {
          lines.push('词组释义素材不足，当前可出 ' + targetPhrases + ' 题。');
        }
        if (targetWords < state.settings.wordCount) {
          lines.push('带释义的单词不足，单词释义可出 ' + targetWords + ' 题。');
        }
        if (targetDictation < 10) {
          lines.push('单词只有 ' + allWords.length + ' 个，听写题将减少为 ' + targetDictation + ' 题。');
        }
        if (missing > 0) {
          lines.push('有 ' + missing + ' 条缺少可用释义，前两轮不会抽到。');
        }
        if (!phrases.length && !words.length) {
          lines.push('没有可用英文释义，本次只能进行发音听写。');
        }
      }
    }

    els.readiness.className = 'readiness' + (modeClass ? ' ' + modeClass : '');
    els.readiness.innerHTML = lines.slice(0, 5).map(function (line) {
      if (line.indexOf('ready-mark') !== -1) return line;
      return '<p>' + line + '</p>';
    }).join('');

    els.btnStart.disabled = total === 0 || !speech || !speech.supported;
    if (!speech || !speech.supported) {
      els.btnStartLabel.textContent = '浏览器不支持语音';
    } else if (!total) {
      els.btnStartLabel.textContent = state.items.length ? '暂无可出题词条' : '先导入词库';
    } else if (!phrases.length && !words.length) {
      els.btnStartLabel.textContent = '开始听写测试 · ' + total + ' 题';
    } else {
      els.btnStartLabel.textContent = '开始语音测试 · ' + total + ' 题';
    }

    updateStartSurfaces(total, minutes);
    updateStartAvailability();
  }

  function updateStartSurfaces(total, minutes) {
    const hasItems = state.items.length > 0;
    const canStart = total > 0 && !!(speech && speech.supported);
    if (els.btnHeroStartLabel) {
      els.btnHeroStartLabel.textContent = canStart
        ? '开始测试 · ' + total + ' 题'
        : (hasItems ? '去词库检查' : '先导入词表');
    }
    if (els.btnMobileStart) {
      els.btnMobileStart.textContent = canStart
        ? '开始测试'
        : (hasItems ? '去词库' : '导入词表');
    }
    if (els.mobileCtaTitle) {
      els.mobileCtaTitle.textContent = hasItems
        ? (canStart ? total + ' 题 · 约 ' + minutes + ' 分钟' : '词条还不够')
        : '词库还是空的';
    }
    if (els.mobileCtaSub) {
      els.mobileCtaSub.textContent = hasItems
        ? '已备好 ' + state.items.length + ' 条词'
        : '拍照或导入你的第一组词';
    }
  }

  function applyTheme(theme, persist) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);
    state.settings.theme = normalized;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', normalized === 'light' ? '#f3f5fa' : '#080a0f');
    }
    if (els.btnTheme) {
      const nextLabel = normalized === 'light' ? '深色' : '浅色';
      els.btnTheme.setAttribute('aria-label', '切换到' + nextLabel + '主题');
      els.btnTheme.setAttribute('title', '切换到' + nextLabel + '主题');
      els.btnTheme.dataset.theme = normalized;
    }
    if (persist) saveSettings();
  }

  function scrollToLibrary() {
    const target = document.querySelector('.library-card');
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        target.scrollIntoView();
      }
    }
  }

  function handleHeroStart() {
    if (!state.items.length) {
      scrollToLibrary();
      toast('先拍照或导入一组单词。', 'info', 2800);
      return;
    }
    if (!speech || !speech.supported) {
      toast('当前浏览器不支持语音合成，请使用 Chrome 或 Edge。', 'error', 4400);
      return;
    }
    startNewSession();
  }

  function updateStartAvailability() {
    if (!els.startNote) return;
    const englishVoices = speech && speech.supported ? speech.getEnglishVoices() : [];
    if (!speech || !speech.supported) {
      els.startNote.textContent = '当前浏览器不支持语音合成，请使用 Chrome 或 Edge。';
      return;
    }
    if (!englishVoices.length) {
      els.startNote.textContent = '暂未检测到英文语音，建议先到设置中检查语音包。';
      return;
    }
    els.startNote.textContent = '建议佩戴耳机。语音由浏览器英文语音合成，可随时重听。';
  }

  function renderHistory() {
    if (!state.history.length) {
      els.historyBest.textContent = '';
      els.historyList.innerHTML = '<div class="history-empty">完成第一轮测试后，这里会记录正确率和日期。</div>';
      return;
    }

    const best = state.history.reduce(function (max, entry) {
      return Math.max(max, entry.percent || 0);
    }, 0);
    els.historyBest.textContent = '最佳 ' + best + '%';

    const rows = state.history.slice(0, 4).map(function (entry) {
      const stageText = entry.stageStats.map(function (s) {
        return s.label + ' ' + s.correct + '/' + s.total;
      }).join(' · ');
      return [
        '<div class="history-row" title="' + escapeHtml(stageText) + '">',
        '  <span class="history-date">' + escapeHtml(formatDate(entry.date)) + '</span>',
        '  <span class="history-fraction">' + entry.correct + ' / ' + entry.total + ' 题</span>',
        '  <span class="history-score' + (entry.percent < 60 ? ' bad' : '') + '">' + entry.percent + '%</span>',
        '</div>'
      ].join('');
    });

    els.historyList.innerHTML = '<div class="history-list">' + rows.join('') + '</div>';
  }

  function renderResume() {
    if (!state.session) {
      els.resumeBanner.hidden = true;
      return;
    }
    const answered = countAnswered(state.session);
    const meta = answered
      ? '已完成 ' + answered + ' / ' + state.session.total + ' 题'
      : '尚未开始答题，共 ' + state.session.total + ' 题';
    els.resumeMeta.textContent = meta;
    els.resumeBanner.hidden = false;
  }

  function showSetupScreen() {
    cancelPendingSpeech();
    showScreen('setup');
    renderAll();
  }

  /* ------------------------------------------------------------------ */
  /* 词库操作                                                            */
  /* ------------------------------------------------------------------ */

  function handleLibraryClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.action;

    if (action === 'photo') {
      openPhotoPicker();
      return;
    }
    if (action === 'choose-file') {
      els.fileInput.click();
      return;
    }
    if (action === 'paste') {
      openImportDialog('');
      return;
    }
    if (action === 'sample') {
      loadSample();
      return;
    }

    const row = actionButton.closest('[data-id]');
    if (!row) return;
    const item = state.items.find(function (entry) { return entry.id === row.dataset.id; });
    if (!item) return;

    if (action === 'star') {
      item.starred = !item.starred;
      saveLibrary();
      renderAll();
      return;
    }
    if (action === 'edit') {
      openEditDialog(item.id);
      return;
    }
    if (action === 'delete') {
      deleteItem(item);
    }
  }

  async function deleteItem(item) {
    const ok = await confirmAction({
      title: '删除「' + item.term + '」？',
      body: '这个操作只会删除本机词库中的这条记录，无法撤销。',
      confirmText: '删除',
      danger: true
    });
    if (!ok) return;
    state.items = state.items.filter(function (entry) { return entry.id !== item.id; });
    saveLibrary();
    renderAll();
    toast('已删除「' + item.term + '」。', 'success');
  }

  async function clearLibrary() {
    if (!state.items.length) return;
    const ok = await confirmAction({
      title: '清空整个词库？',
      body: '词库中的 ' + state.items.length + ' 条记录都会删除，释义缓存也会一起清空。成绩记录会保留。',
      confirmText: '清空词库',
      danger: true
    });
    if (!ok) return;
    state.items = [];
    state.session = null;
    state.lastResult = null;
    saveLibrary();
    saveSession();
    if (Dict) Dict.clearCache();
    renderAll();
    toast('词库已清空。', 'success');
  }

  function exportLibrary() {
    if (!state.items.length) {
      toast('词库为空，没有可导出的内容。', 'error');
      return;
    }
    function csvCell(value) {
      const text = String(value == null ? '' : value);
      if (/[",\r\n]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
      }
      return text;
    }
    const lines = ['word,definition,chinese'];
    state.items.forEach(function (item) {
      lines.push([item.term, item.definition, item.chinese].map(csvCell).join(','));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = '词声词库-' + stamp + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('词库已导出。', 'success');
  }

  /* ------------------------------------------------------------------ */
  /* 导入                                                                */
  /* ------------------------------------------------------------------ */

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf('image/') === 0) return true;
    return /\.(png|jpe?g|webp|bmp|gif|tiff?|heic|heif)$/i.test(file.name || '');
  }

  function handleFile(file) {
    if (!file) return;
    if (isImageFile(file)) {
      handleImageFile(file);
      return;
    }
    const fileName = file.name || '';
    const isTextFile = /\.(txt|csv|tsv)$/i.test(fileName) ||
      /^text\//i.test(file.type || '') ||
      file.type === 'application/csv' ||
      file.type === 'application/vnd.ms-excel';
    if (!isTextFile) {
      toast('暂不支持这个文件格式，请选择 .txt、.csv 或图片。', 'error', 4200);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('文件超过 2MB，建议先拆分成多个小词库。', 'error', 4200);
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      openImportDialog(String(reader.result || ''));
    };
    reader.onerror = function () {
      toast('文件读取失败，请确认文件是 UTF-8 文本。', 'error');
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ------------------------------------------------------------------ */
  /* 拍照识别                                                            */
  /* ------------------------------------------------------------------ */

  function openPhotoPicker() {
    if (!window.WordOCR || !window.Tesseract) {
      toast('图片识别组件未加载，请确认 vendor/tesseract 目录完整。', 'error', 5200);
      return;
    }
    if (window.location.protocol === 'file:') {
      toast('拍照识别需要通过“启动词声.bat”打开网页；直接双击 index.html 时浏览器会拦截识别引擎。', 'error', 6200);
      return;
    }
    els.photoInput.click();
  }

  async function handleImageFile(file) {
    if (!file) return;
    if (!window.WordOCR || !window.Tesseract) {
      toast('图片识别组件未加载，请确认 vendor/tesseract 目录完整。', 'error', 5200);
      return;
    }
    if (window.location.protocol === 'file:') {
      toast('拍照识别需要通过“启动词声.bat”打开网页；直接双击 index.html 时浏览器会拦截识别引擎。', 'error', 6200);
      return;
    }
    if (!isImageFile(file)) {
      toast('这不是一张图片。请选择 JPG、PNG 或 WebP 照片。', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast('图片超过 20MB，请换一张小一点的照片。', 'error', 4200);
      return;
    }

    if (state.ui.ocrRunning) {
      await abortOcrRecognition();
    }
    openOcrDialog(file);
  }

  function openOcrDialog(file) {
    if (state.ui.ocrPreviewUrl) {
      URL.revokeObjectURL(state.ui.ocrPreviewUrl);
      state.ui.ocrPreviewUrl = '';
    }

    state.ui.ocrFile = file;
    state.ui.ocrLastResult = null;
    state.ui.ocrPreviewUrl = URL.createObjectURL(file);

    els.ocrPreview.src = state.ui.ocrPreviewUrl;
    els.ocrText.value = '';
    els.ocrText.disabled = true;
    els.ocrStatus.textContent = '准备识别…';
    els.ocrSpinner.hidden = false;
    els.ocrBar.style.width = '0%';
    els.ocrHint.textContent = '正在准备图片和本地识别模型…';
    els.btnOcrRetry.disabled = true;
    els.btnOcrImport.disabled = true;
    els.btnOcrImport.textContent = '导入识别结果';
    updateOcrPreview();

    if (!els.ocrDialog.open) els.ocrDialog.showModal();
    resetDialogScroll(els.ocrDialog);
    runOcr(file);
  }

  async function runOcr(file) {
    if (!file || !window.WordOCR) return;
    const token = ++state.ui.ocrUiToken;
    state.ui.ocrRunning = true;
    state.ui.ocrLastResult = null;

    els.ocrText.disabled = true;
    els.ocrText.value = '';
    els.btnOcrRetry.disabled = true;
    els.btnOcrImport.disabled = true;
    els.btnOcrImport.textContent = '导入识别结果';
    els.ocrSpinner.hidden = false;
    els.ocrStatus.textContent = '正在准备图片…';
    els.ocrBar.style.width = '0%';
    els.ocrHint.textContent = '首次识别会初始化本地识别模型，通常需要几秒钟。';
    updateOcrPreview();

    try {
      const result = await window.WordOCR.recognizeImage(file, {
        onProgress: function (message) {
          if (token !== state.ui.ocrUiToken || !state.ui.ocrRunning) return;
          applyOcrProgress(message);
        }
      });
      if (token !== state.ui.ocrUiToken) return;

      state.ui.ocrRunning = false;
      state.ui.ocrLastResult = result;
      els.ocrSpinner.hidden = true;
      els.ocrBar.style.width = '100%';
      els.ocrStatus.textContent = result.text ? '识别完成' : '没有识别到文字';
      els.ocrText.value = result.text || '';
      els.ocrText.disabled = false;
      els.btnOcrRetry.disabled = false;

      if (result.previewUrl) {
        els.ocrPreview.src = result.previewUrl;
        if (state.ui.ocrPreviewUrl) {
          URL.revokeObjectURL(state.ui.ocrPreviewUrl);
          state.ui.ocrPreviewUrl = '';
        }
      }

      if (result.text) {
        const confidenceText = result.confidence ? '（置信度约 ' + result.confidence + '%）' : '';
        els.ocrHint.textContent = result.confidence && result.confidence < 60
          ? '识别把握一般' + confidenceText + '。建议先核对文本，或换一张更清晰的照片重试。'
          : '识别完成' + confidenceText + '。请检查并修改文本，再导入词库。';
      } else {
        els.ocrHint.textContent = '没有识别到英文单词。请换一张更清晰、方向正确的照片，或改用文本导入。';
      }

      updateOcrPreview();
    } catch (error) {
      if (token !== state.ui.ocrUiToken) return;
      state.ui.ocrRunning = false;
      els.ocrSpinner.hidden = true;
      els.ocrStatus.textContent = '识别失败';
      els.ocrBar.style.width = '0%';
      els.ocrText.disabled = false;
      els.btnOcrRetry.disabled = false;
      els.ocrHint.textContent = ocrErrorMessage(error);
      updateOcrPreview();
      toast('图片识别失败，可以换一张照片或改用文本导入。', 'error', 4600);
      window.WordOCR.abort().catch(function () {});
    }
  }

  function applyOcrProgress(message) {
    if (!message) return;
    const status = message.status || '';
    const range = OCR_PROGRESS_RANGES[status];
    let percent = null;
    if (range) {
      const progress = clamp(Number(message.progress) || 0, 0, 1);
      percent = range[0] + (range[1] - range[0]) * progress;
      els.ocrBar.style.width = Math.round(percent) + '%';
    }
    const label = OCR_STATUS_LABELS[status] || '正在识别图片';
    els.ocrStatus.textContent = percent == null
      ? label
      : label + ' · ' + Math.round(percent) + '%';
  }

  function ocrErrorMessage(error) {
    const code = error && error.message ? String(error.message) : String(error || '');
    if (code === 'OCR_ENGINE_LOAD_FAILED' || code.indexOf('Failed to fetch') !== -1) {
      return 'OCR 引擎加载失败。请确认 vendor/tesseract 目录完整，并通过“启动词声.bat”打开网页。';
    }
    if (code === 'IMAGE_DECODE_FAILED') {
      return '无法读取这张图片。请换一张 JPG / PNG / WebP 图片；HEIC 照片请先另存为 JPG。';
    }
    if (code === 'OCR_CANCELLED') {
      return '识别已取消。';
    }
    return '识别失败：' + code.slice(0, 120) + '。可以换一张更清晰的照片，或改用文本导入。';
  }

  function buildOcrSummary(parsed) {
    if (!parsed || !parsed.items.length) {
      return '<div class="preview-stats"><span class="preview-chip bad">还没有识别到词条</span></div>' +
        '<div class="preview-samples">可以直接修改上方文本，或换一张更清晰的照片。</div>';
    }
    const stats = parsed.stats;
    const chips = [
      '<span class="preview-chip good">' + parsed.items.length + ' 条可导入</span>',
      '<span class="preview-chip">单词 ' + stats.words + '</span>',
      '<span class="preview-chip">词组 ' + stats.phrases + '</span>',
      '<span class="preview-chip">有英文释义 ' + stats.withDefinition + '</span>'
    ];
    if (stats.missingDefinition) {
      chips.push('<span class="preview-chip warn">缺英文释义 ' + stats.missingDefinition + '</span>');
    }
    return '<div class="preview-stats">' + chips.join('') + '</div>';
  }

  function updateOcrPreview() {
    const parsed = Core.parseWordList(els.ocrText.value);
    els.ocrParsePreview.innerHTML = buildOcrSummary(parsed);
    const count = parsed.items.length;
    els.btnOcrImport.disabled = state.ui.ocrRunning || count === 0;
    els.btnOcrImport.textContent = count ? '导入 ' + count + ' 条' : '导入识别结果';
  }

  const debouncedOcrPreview = debounce(updateOcrPreview, 150);

  async function abortOcrRecognition() {
    state.ui.ocrUiToken += 1;
    state.ui.ocrRunning = false;
    if (window.WordOCR) {
      try { await window.WordOCR.abort(); } catch (error) { /* ignore */ }
    }
  }

  async function replaceOcrImage() {
    if (state.ui.ocrRunning) {
      await abortOcrRecognition();
      if (!els.ocrDialog.open) return;
      els.ocrSpinner.hidden = true;
      els.ocrStatus.textContent = '识别已取消，请选择新的图片…';
      els.ocrText.disabled = false;
      els.btnOcrRetry.disabled = !state.ui.ocrFile;
    }
    els.photoInput.click();
  }

  function retryOcr() {
    if (state.ui.ocrRunning || !state.ui.ocrFile) return;
    runOcr(state.ui.ocrFile);
  }

  function closeOcrDialog() {
    if (els.ocrDialog.open) els.ocrDialog.close();
  }

  function handleOcrDialogClosed() {
    const wasRunning = state.ui.ocrRunning;
    state.ui.ocrUiToken += 1;
    state.ui.ocrRunning = false;
    if (wasRunning && window.WordOCR) {
      window.WordOCR.abort().catch(function () {});
    }
    if (state.ui.ocrPreviewUrl) {
      URL.revokeObjectURL(state.ui.ocrPreviewUrl);
      state.ui.ocrPreviewUrl = '';
    }
    state.ui.ocrFile = null;
    state.ui.ocrLastResult = null;
    els.ocrPreview.removeAttribute('src');
    els.ocrText.value = '';
    els.ocrText.disabled = true;
    els.ocrStatus.textContent = '准备识别…';
    els.ocrSpinner.hidden = true;
    els.ocrBar.style.width = '0%';
    els.ocrHint.textContent = '识别完成后可以核对、修改，再导入词库。';
    els.btnOcrRetry.disabled = true;
    els.btnOcrImport.disabled = true;
    els.btnOcrImport.textContent = '导入识别结果';
    els.ocrParsePreview.innerHTML = '<div class="preview-stats"><span class="preview-chip">等待识别</span></div>';
  }

  function importOcrResult() {
    const parsed = Core.parseWordList(els.ocrText.value);
    if (!parsed.items.length) {
      toast('没有识别到可导入的单词，请修改文本或换一张照片。', 'error', 4200);
      return;
    }
    const result = mergeImportedItems(parsed.items);
    closeOcrDialog();
    renderAll();

    let message = '';
    if (result.added && result.updated) {
      message = '已从图片新增 ' + result.added + ' 条，补全 ' + result.updated + ' 条。';
    } else if (result.added) {
      message = '已从图片导入 ' + result.added + ' 条词条。';
    } else if (result.updated) {
      message = '已更新 ' + result.updated + ' 条已有词条。';
    } else {
      message = '识别出的词条已经在词库中了。';
    }
    toast(message, 'success', 3800);
    if (getMissingItems().length) {
      window.setTimeout(function () {
        toast('部分词条还没有英文释义，可以点“补全释义”联网获取，或手动编辑。', 'info', 4600);
      }, 500);
    }
  }

  function bindOcrEvents() {
    els.btnOcrClose.addEventListener('click', closeOcrDialog);
    els.btnOcrCancel.addEventListener('click', closeOcrDialog);
    els.btnOcrReplace.addEventListener('click', replaceOcrImage);
    els.btnOcrRetry.addEventListener('click', retryOcr);
    els.btnOcrImport.addEventListener('click', importOcrResult);
    els.ocrText.addEventListener('input', debouncedOcrPreview);
    els.ocrDialog.addEventListener('close', handleOcrDialogClosed);
    els.ocrDialog.addEventListener('click', function (event) {
      if (event.target === els.ocrDialog) closeOcrDialog();
    });
  }

  function openImportDialog(text) {
    els.importText.value = text || '';
    state.ui.importParsed = null;
    updateImportPreview();
    if (!els.importDialog.open) els.importDialog.showModal();
    resetDialogScroll(els.importDialog);
    window.setTimeout(function () {
      els.importText.focus();
      if (text) els.importText.setSelectionRange(0, 0);
    }, 60);
  }

  function buildImportPreview(parsed) {
    if (!parsed || !parsed.items.length) {
      return '<div class="preview-stats"><span class="preview-chip bad">还没有识别到词条</span></div>' +
        '<div class="preview-samples">每行写一个单词或词组。用 <code>|</code>、Tab 或逗号分隔英文释义。</div>';
    }
    const stats = parsed.stats;
    const chips = [
      '<span class="preview-chip good">' + parsed.items.length + ' 条可导入</span>',
      '<span class="preview-chip">单词 ' + stats.words + '</span>',
      '<span class="preview-chip">词组 ' + stats.phrases + '</span>',
      '<span class="preview-chip">有英文释义 ' + stats.withDefinition + '</span>'
    ];
    if (stats.missingDefinition) {
      chips.push('<span class="preview-chip warn">缺英文释义 ' + stats.missingDefinition + '</span>');
    }
    if (stats.duplicates) {
      chips.push('<span class="preview-chip warn">重复 ' + stats.duplicates + '</span>');
    }
    if (stats.invalid) {
      chips.push('<span class="preview-chip bad">忽略 ' + stats.invalid + ' 行</span>');
    }
    const samples = parsed.items.slice(0, 4).map(function (item) {
      let detail = '';
      if (item.definition) {
        detail = escapeHtml(item.definition.slice(0, 46)) + (item.definition.length > 46 ? '…' : '');
      } else if (item.chinese) {
        detail = '<span style="color:var(--muted)">中文：' + escapeHtml(item.chinese) + ' · 待补英文释义</span>';
      } else {
        detail = '<span style="color:var(--red)">无释义</span>';
      }
      return '<code>' + escapeHtml(item.term) + '</code> — ' + detail;
    }).join('<br>');
    return '<div class="preview-stats">' + chips.join('') + '</div>' +
      '<div class="preview-samples">' + samples + '</div>';
  }

  function updateImportPreview() {
    const parsed = Core.parseWordList(els.importText.value);
    state.ui.importParsed = parsed;
    els.importPreview.innerHTML = buildImportPreview(parsed);
    els.btnImportConfirm.disabled = state.ui.importParsed.items.length === 0;
  }

  const debouncedImportPreview = debounce(updateImportPreview, 160);

  function bindImportEvents() {
    els.importText.addEventListener('input', debouncedImportPreview);
    els.importForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const parsed = Core.parseWordList(els.importText.value);
      if (!parsed.items.length) {
        toast('没有识别到可导入的词条。', 'error');
        return;
      }
      const result = mergeImportedItems(parsed.items);
      els.importDialog.close();
      renderAll();
      let message = '';
      if (result.added && result.updated) {
        message = '已新增 ' + result.added + ' 条，补全 ' + result.updated + ' 条。';
      } else if (result.added) {
        message = '已导入 ' + result.added + ' 条词条。';
      } else if (result.updated) {
        message = '已补全 ' + result.updated + ' 条已有词条。';
      } else {
        message = '这些词条已经在词库中了。';
      }
      toast(message, 'success', 3600);
      if (getMissingItems().length) {
        window.setTimeout(function () {
          toast('还有 ' + getMissingItems().length + ' 条缺少可用释义，可以点“补全释义”联网获取。', 'info', 4600);
        }, 500);
      }
    });
    els.btnImportClose.addEventListener('click', function () { els.importDialog.close(); });
    els.btnImportCancel.addEventListener('click', function () { els.importDialog.close(); });
  }

  function mergeImportedItems(incomingItems) {
    const byKey = new Map();
    state.items.forEach(function (item) { byKey.set(Core.normalizeKey(item.term), item); });
    const usedIds = new Set(state.items.map(function (item) { return item.id; }));
    let added = 0;
    let updated = 0;

    incomingItems.forEach(function (incoming) {
      const key = Core.normalizeKey(incoming.term);
      const existing = byKey.get(key);
      if (existing) {
        let changed = false;
        if (!hasUsableDef(existing) && incoming.definition && Core.isUsableDefinition(incoming.definition, incoming.term, incoming.type)) {
          existing.definition = incoming.definition;
          existing.source = incoming.source || 'import';
          changed = true;
        }
        if (!existing.chinese && incoming.chinese) {
          existing.chinese = incoming.chinese;
          changed = true;
        }
        if (!existing.pos && incoming.pos) {
          existing.pos = incoming.pos;
          changed = true;
        }
        if (!existing.phonetic && incoming.phonetic) {
          existing.phonetic = incoming.phonetic;
          changed = true;
        }
        if (changed) updated += 1;
        return;
      }
      const item = Object.assign({}, incoming);
      if (!item.id || usedIds.has(item.id)) item.id = Core.uid('item');
      usedIds.add(item.id);
      item.type = Core.detectType(item.term);
      item.stats = { attempts: 0, correct: 0, wrong: 0 };
      item.createdAt = new Date().toISOString();
      state.items.push(item);
      byKey.set(key, item);
      added += 1;
    });

    saveLibrary();
    return { added: added, updated: updated };
  }

  function loadSample() {
    const sampleText = window.SAMPLE_LIST_TEXT || '';
    const parsed = Core.parseWordList(sampleText);
    if (!parsed.items.length) {
      toast('示例词库加载失败。', 'error');
      return;
    }
    const result = mergeImportedItems(parsed.items);
    renderAll();
    if (result.added) {
      toast('示例词库已载入：新增 ' + result.added + ' 条，共 ' + parsed.items.length + ' 条。', 'success', 3800);
    } else {
      toast('示例词条已经在你的词库里了。', 'info');
    }
  }

  /* ------------------------------------------------------------------ */
  /* 编辑词条                                                            */
  /* ------------------------------------------------------------------ */

  function bindEditEvents() {
    els.editForm.addEventListener('submit', saveEditItem);
    els.btnEditClose.addEventListener('click', function () { els.editDialog.close(); });
    els.btnDeleteItem.addEventListener('click', deleteEditingItem);
    els.btnFetchOne.addEventListener('click', fetchOneDefinition);
    els.editDialog.addEventListener('close', function () {
      state.ui.editingId = null;
      state.ui.editPos = '';
      state.ui.editPhonetic = '';
      state.ui.editSource = '';
      state.ui.editFetchedTerm = '';
    });
  }

  function openEditDialog(id) {
    const item = id ? state.items.find(function (entry) { return entry.id === id; }) : null;
    state.ui.editingId = item ? item.id : null;
    state.ui.editPos = item ? item.pos : '';
    state.ui.editPhonetic = item ? item.phonetic : '';
    state.ui.editSource = item ? item.source : '';
    state.ui.editFetchedTerm = '';

    els.editId.value = item ? item.id : '';
    els.editKicker.textContent = item ? 'WORD DETAIL' : 'NEW WORD';
    els.editTitle.textContent = item ? '编辑词条' : '添加词条';
    els.editTerm.value = item ? item.term : '';
    els.editDefinition.value = item ? item.definition : '';
    els.editChinese.value = item ? item.chinese : '';
    els.editStarred.checked = item ? !!item.starred : false;
    els.editSource.textContent = item ? sourceLabel(item.source) : '英文释义用于语音出题；留空时可以稍后联网补全。';
    els.btnDeleteItem.hidden = !item;
    els.btnFetchOne.disabled = false;
    els.btnFetchOne.textContent = '联网获取释义';
    els.btnSaveItem.disabled = false;

    if (!els.editDialog.open) els.editDialog.showModal();
    resetDialogScroll(els.editDialog);
    window.setTimeout(function () { els.editTerm.focus(); }, 60);
  }

  function saveEditItem(event) {
    event.preventDefault();
    const term = Core.normalizeTerm(els.editTerm.value);
    if (!Core.isValidTerm(term)) {
      toast('请填写有效的英文单词或词组（最多 10 个单词）。', 'error');
      els.editTerm.focus();
      return;
    }
    const definition = Core.cleanDefinitionForDisplay(els.editDefinition.value);
    const chinese = Core.normalizeSpace(els.editChinese.value);
    const starred = els.editStarred.checked;
    const type = Core.detectType(term);
    const existingId = state.ui.editingId;
    const duplicate = state.items.find(function (item) {
      return item.id !== existingId && Core.normalizeKey(item.term) === Core.normalizeKey(term);
    });
    if (duplicate) {
      toast('词库里已经有「' + term + '」了。', 'error');
      return;
    }

    let item;
    if (existingId) {
      item = state.items.find(function (entry) { return entry.id === existingId; });
      if (!item) {
        toast('词条不存在，请刷新后重试。', 'error');
        return;
      }
      const oldDefinition = item.definition;
      const oldTerm = item.term;
      item.term = term;
      item.type = type;
      item.definition = definition;
      item.chinese = chinese;
      item.starred = starred;
      if (oldTerm !== term) {
        item.pos = state.ui.editFetchedTerm === term ? state.ui.editPos : '';
        item.phonetic = state.ui.editFetchedTerm === term ? state.ui.editPhonetic : '';
        item.source = state.ui.editFetchedTerm === term ? state.ui.editSource : (definition ? 'manual' : '');
      } else if (oldDefinition !== definition) {
        item.source = definition ? 'manual' : '';
        if (!definition) {
          item.pos = '';
          item.phonetic = '';
        }
      }
    } else {
      item = {
        id: Core.uid('item'),
        term: term,
        type: type,
        definition: definition,
        chinese: chinese,
        pos: state.ui.editFetchedTerm === term ? state.ui.editPos : '',
        phonetic: state.ui.editFetchedTerm === term ? state.ui.editPhonetic : '',
        source: state.ui.editFetchedTerm === term ? state.ui.editSource : (definition ? 'manual' : ''),
        starred: starred,
        stats: { attempts: 0, correct: 0, wrong: 0 },
        createdAt: new Date().toISOString()
      };
      state.items.push(item);
    }

    saveLibrary();
    renderAll();
    els.editDialog.close();
    toast('已保存「' + term + '」。', 'success');
  }

  async function deleteEditingItem() {
    const id = state.ui.editingId;
    if (!id) return;
    const item = state.items.find(function (entry) { return entry.id === id; });
    if (!item) return;
    const ok = await confirmAction({
      title: '删除「' + item.term + '」？',
      body: '删除后不会恢复。',
      confirmText: '删除',
      danger: true
    });
    if (!ok) return;
    state.items = state.items.filter(function (entry) { return entry.id !== id; });
    saveLibrary();
    els.editDialog.close();
    renderAll();
    toast('已删除「' + item.term + '」。', 'success');
  }

  async function fetchOneDefinition() {
    const term = Core.normalizeTerm(els.editTerm.value);
    if (!Core.isValidTerm(term)) {
      toast('先填写单词或词组。', 'error');
      els.editTerm.focus();
      return;
    }
    if (navigator.onLine === false) {
      toast('当前网络不可用，请稍后再试。', 'error');
      return;
    }
    const originalText = els.btnFetchOne.textContent;
    els.btnFetchOne.disabled = true;
    els.btnFetchOne.textContent = '正在查询…';
    try {
      const result = await Dict.lookup(term, { type: Core.detectType(term) });
      if (result) {
        els.editDefinition.value = result.definition || '';
        state.ui.editPos = result.pos || '';
        state.ui.editPhonetic = result.phonetic || '';
        state.ui.editSource = result.source || '';
        state.ui.editFetchedTerm = term;
        els.editSource.textContent = sourceLabel(result.source) + (result.cached ? ' · 已缓存' : '');
        toast('已找到英文释义。', 'success');
      } else {
        toast('没有找到合适的英文释义，可以手动填写。', 'error', 4200);
      }
    } catch (error) {
      toast('联网查询失败，请检查网络或稍后再试。', 'error');
    } finally {
      els.btnFetchOne.disabled = false;
      els.btnFetchOne.textContent = originalText;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 批量补全释义                                                        */
  /* ------------------------------------------------------------------ */

  function startBulkFetch() {
    const missing = getMissingItems();
    if (!missing.length) {
      toast('所有词条都已有可用释义。', 'info');
      return;
    }
    if (navigator.onLine === false) {
      toast('当前网络不可用，联网补全需要网络连接。', 'error', 4600);
      return;
    }
    state.ui.fetchCancelled = false;
    state.ui.fetchRunning = true;
    els.btnFetchCancel.disabled = false;
    els.fetchStatus.textContent = '准备查询 ' + missing.length + ' 条词条的英文释义…';
    els.fetchCurrent.textContent = '';
    els.fetchBar.style.width = '0%';
    if (!els.fetchDialog.open) els.fetchDialog.showModal();
    resetDialogScroll(els.fetchDialog);
    runBulkFetch(missing);
  }

  async function runBulkFetch(missing) {
    let success = 0;
    let failed = 0;
    const total = missing.length;

    for (let i = 0; i < missing.length; i += 1) {
      if (state.ui.fetchCancelled) break;
      const item = missing[i];
      els.fetchStatus.textContent = '正在查询第 ' + (i + 1) + ' / ' + total + ' 条';
      els.fetchCurrent.textContent = item.term;
      els.fetchBar.style.width = Math.round((i / total) * 100) + '%';

      let result = null;
      try {
        result = await Dict.lookup(item.term, { type: item.type });
      } catch (error) {
        result = null;
      }

      if (state.ui.fetchCancelled) break;

      if (result && result.definition) {
        item.definition = result.definition;
        item.pos = result.pos || item.pos;
        item.phonetic = result.phonetic || item.phonetic;
        item.source = result.source || 'api';
        success += 1;
      } else {
        failed += 1;
      }

      els.fetchBar.style.width = Math.round(((i + 1) / total) * 100) + '%';
      if (i < missing.length - 1 && !state.ui.fetchCancelled) await sleep(220);
    }

    state.ui.fetchRunning = false;
    els.btnFetchCancel.disabled = false;
    saveLibrary();
    renderAll();
    if (els.fetchDialog.open) els.fetchDialog.close();

    if (state.ui.fetchCancelled) {
      toast('已停止补全：成功 ' + success + ' 条。', 'info', 3600);
    } else if (success && failed) {
      toast('补全完成：成功 ' + success + ' 条，' + failed + ' 条未找到。未找到的可以手动编辑。', 'success', 5200);
    } else if (success) {
      toast('补全完成：成功获取 ' + success + ' 条英文释义。', 'success', 3800);
    } else {
      toast('没有获取到释义。请检查网络，或手动填写英文释义。', 'error', 5200);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 会话开始 / 恢复                                                     */
  /* ------------------------------------------------------------------ */

  async function startNewSession() {
    if (!speech || !speech.supported) {
      toast('当前浏览器不支持语音合成，请使用 Chrome 或 Edge。', 'error', 4600);
      return;
    }
    if (!state.items.length) {
      toast('先导入一组单词或词组吧。', 'error');
      return;
    }
    if (state.session) {
      const ok = await confirmAction({
        title: '开始新的测试？',
        body: '上次未完成的测试进度会被放弃。',
        confirmText: '开始新测试',
        danger: false
      });
      if (!ok) return;
    }

    const selection = Core.selectSession(state.items, {
      phraseCount: state.settings.phraseCount,
      wordCount: state.settings.wordCount,
      dictationCount: 10,
      recentIds: getRecentIds(),
      prioritizeMistakes: state.settings.prioritizeMistakes
    });

    if (!selection.counts.total) {
      toast('当前词库没有可出题的词条。', 'error');
      return;
    }

    const session = {
      id: Core.uid('session'),
      startedAt: Date.now(),
      stages: selection.stages,
      stageIndex: 0,
      questionIndex: 0,
      total: selection.counts.total,
      isRetry: false
    };

    state.session = session;
    state.lastResult = null;
    saveSession();
    beginQuiz();

    if (selection.warnings.length) {
      toast('词量不足，本次已安排 ' + selection.counts.total + ' 题。', 'info', 3800);
    }
  }

  function beginQuiz() {
    cancelPendingSpeech();
    showScreen('quiz');
    renderQuestion();
  }

  function resumeSession() {
    if (!state.session) return;
    cancelPendingSpeech();
    showScreen('quiz');
    renderQuestion();
    toast('继续上次测试。', 'info', 2400);
  }

  async function discardSession() {
    if (!state.session) return;
    const ok = await confirmAction({
      title: '放弃这次测试？',
      body: '本次进度不会记入成绩，但词库和练习统计不受影响。',
      confirmText: '放弃进度',
      danger: true
    });
    if (!ok) return;
    state.session = null;
    saveSession();
    renderAll();
    toast('已放弃未完成的测试。', 'info');
  }

  async function exitQuiz() {
    if (!state.session) {
      showSetupScreen();
      return;
    }
    const ok = await confirmAction({
      title: '退出本次测试？',
      body: '进度会保留在首页，之后可以继续；本次测试不会记入成绩。',
      confirmText: '退出并保留',
      danger: false
    });
    if (!ok) return;
    cancelPendingSpeech();
    showSetupScreen();
    toast('进度已保留，可以从首页继续。', 'info');
  }

  function cancelPendingSpeech() {
    if (state.ui.autoPlayTimer) {
      window.clearTimeout(state.ui.autoPlayTimer);
      state.ui.autoPlayTimer = null;
    }
    if (speech) speech.cancel();
    if (els.audioOrbit) els.audioOrbit.classList.remove('is-speaking');
    if (els.audioStatus) {
      els.audioStatus.classList.remove('is-playing');
      if (document.body.dataset.screen === 'quiz') {
        const q = getCurrentQuestion();
        els.audioStatus.textContent = q ? getModeMeta(q.mode).done : '点击扬声器播放语音';
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 会话状态                                                            */
  /* ------------------------------------------------------------------ */

  function getCurrentStage() {
    if (!state.session) return null;
    return state.session.stages[state.session.stageIndex] || null;
  }

  function getCurrentQuestion() {
    const stage = getCurrentStage();
    if (!stage) return null;
    return stage.questions[state.session.questionIndex] || null;
  }

  function countAnswered(session) {
    if (!session) return 0;
    let count = 0;
    session.stages.forEach(function (stage) {
      stage.questions.forEach(function (q) {
        if (q.result) count += 1;
      });
    });
    return count;
  }

  function countCorrect(session) {
    if (!session) return 0;
    let count = 0;
    session.stages.forEach(function (stage) {
      stage.questions.forEach(function (q) {
        if (q.result === 'correct') count += 1;
      });
    });
    return count;
  }

  /* ------------------------------------------------------------------ */
  /* 测试渲染                                                            */
  /* ------------------------------------------------------------------ */

  function renderQuestion() {
    const session = state.session;
    if (!session) {
      showSetupScreen();
      return;
    }
    const stage = getCurrentStage();
    const q = getCurrentQuestion();
    if (!stage || !q) {
      finishSession();
      return;
    }

    const meta = getModeMeta(q.mode);
    els.modeChip.textContent = meta.chip;
    els.questionTitle.textContent = meta.title;
    els.questionSub.textContent = q.mode === 'word-audio'
      ? '单词会按设置的次数播报，你可以随时重听，再写下拼写。'
      : '英文释义会播放一次，你可以随时重听。屏幕上不会显示释义文本。';
    els.answerInput.placeholder = meta.placeholder;

    if (q.mode === 'word-audio') {
      els.posChip.hidden = true;
    } else {
      const posText = q.pos ? Core.posLabel(q.pos) : (q.type === 'phrase' ? '词组' : '单词');
      els.posChip.textContent = posText;
      els.posChip.hidden = false;
    }

    els.audioStatus.textContent = meta.idle;
    els.audioStatus.classList.remove('is-playing');
    els.audioOrbit.classList.remove('is-speaking');

    els.hintBox.hidden = true;
    els.hintBox.innerHTML = '';
    els.btnHint.disabled = false;
    els.btnHint.textContent = '首字母提示';
    els.btnGiveup.disabled = false;

    els.feedback.hidden = true;
    els.feedback.innerHTML = '';
    els.answerForm.hidden = false;
    els.answerInput.disabled = false;
    els.answerInput.value = '';
    els.btnSubmitAnswer.disabled = false;

    if (q.hintUsed && !q.result) {
      renderHint(q);
    }

    if (q.result) {
      els.answerForm.hidden = true;
      els.answerInput.disabled = true;
      renderFeedback(q);
    }

    updateQuizHeader();
    document.title = '词声 · 测试中';

    cancelPendingSpeech();
    if (!q.result && state.settings.autoPlay) {
      state.ui.autoPlayTimer = window.setTimeout(function () {
        state.ui.autoPlayTimer = null;
        if (document.body.dataset.screen !== 'quiz') return;
        const activeQ = getCurrentQuestion();
        if (activeQ && activeQ.id === q.id && !activeQ.result) {
          playCurrent(false, true);
        }
      }, 380);
    }

    if (!q.result && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
      window.setTimeout(function () {
        if (document.body.dataset.screen === 'quiz' && getCurrentQuestion() === q && !q.result) {
          els.answerInput.focus({ preventScroll: true });
        }
      }, 420);
    }
  }

  function updateQuizHeader() {
    const session = state.session;
    if (!session) return;
    const stage = getCurrentStage();
    const q = getCurrentQuestion();
    if (!stage) return;

    if (session.isRetry) {
      els.stageLabel.textContent = '错题重练';
      els.stageMapTitle.textContent = '错题重练';
    } else {
      const ordinal = stageOrdinal(session.stageIndex);
      els.stageLabel.textContent = ordinal + '轮 · ' + stage.label;
      els.stageMapTitle.textContent = ordinal + '轮 · ' + stage.label;
    }
    els.questionCounter.textContent = '第 ' + (session.questionIndex + 1) + ' / ' + stage.questions.length + ' 题';

    const answered = countAnswered(session);
    els.overallProgress.style.width = (session.total ? (answered / session.total) * 100 : 0) + '%';
    els.quizScore.textContent = String(countCorrect(session));

    els.stageDots.innerHTML = stage.questions.map(function (question, index) {
      let className = 'stage-dot';
      if (question.result === 'correct') className += ' is-correct';
      else if (question.result === 'wrong') className += ' is-wrong';
      if (index === session.questionIndex) className += ' is-current';
      return '<span class="' + className + '" title="第 ' + (index + 1) + ' 题">' + (index + 1) + '</span>';
    }).join('');
  }

  function playCurrent(slow, isAuto) {
    const q = getCurrentQuestion();
    if (!q) return;
    if (!speech || !speech.supported) {
      toast('当前浏览器不支持语音合成。', 'error');
      return;
    }

    if (state.ui.autoPlayTimer) {
      window.clearTimeout(state.ui.autoPlayTimer);
      state.ui.autoPlayTimer = null;
    }

    const meta = getModeMeta(q.mode);
    const rate = clamp(state.settings.rate * (slow ? 0.72 : 1), 0.4, 1.6);
    els.audioStatus.classList.remove('is-playing');
    els.audioOrbit.classList.remove('is-speaking');

    if (q.mode === 'word-audio') {
      speech.speakWord(q.term, {
        rate: rate,
        voiceURI: state.settings.voiceURI,
        repeats: isAuto ? state.settings.dictationRepeats : 1,
        onError: function (error) {
          els.audioStatus.textContent = error && error.error === 'not-allowed'
            ? '自动播放被浏览器拦截，请点击扬声器。'
            : '播放失败，请点击扬声器重试。';
          els.audioStatus.classList.remove('is-playing');
          els.audioOrbit.classList.remove('is-speaking');
        }
      });
    } else {
      const text = Core.maskDefinition(q.definition, q.term, q.type) || q.definition;
      if (!text) {
        toast('这条词缺少可播报的英文释义。', 'error');
        return;
      }
      speech.speakDefinition(text, {
        rate: rate,
        voiceURI: state.settings.voiceURI,
        onError: function (error) {
          els.audioStatus.textContent = error && error.error === 'not-allowed'
            ? '自动播放被浏览器拦截，请点击扬声器。'
            : '播放失败，请点击扬声器重试。';
          els.audioStatus.classList.remove('is-playing');
          els.audioOrbit.classList.remove('is-speaking');
        }
      });
    }

    els.audioStatus.textContent = meta.playing;
    els.audioStatus.classList.add('is-playing');
    els.audioOrbit.classList.add('is-speaking');
  }

  function speakTerm(term) {
    if (!speech || !speech.supported) return;
    speech.speakWord(term, {
      rate: clamp(state.settings.rate * 0.92, 0.4, 1.6),
      voiceURI: state.settings.voiceURI,
      repeats: 1
    });
  }

  function renderHint(q) {
    const hint = Core.letterMask(q.term);
    els.hintBox.innerHTML = '<span class="hint-letters">' + escapeHtml(hint.text) + '</span>' +
      '<span class="hint-meta">' + escapeHtml(hint.meta) + ' · 首字母已给出</span>';
    els.hintBox.hidden = false;
    els.btnHint.textContent = '首字母提示已显示';
    els.btnHint.disabled = true;
  }

  function showHint() {
    const q = getCurrentQuestion();
    if (!q || q.result) return;
    if (!q.hintUsed) {
      q.hintUsed = true;
      saveSession();
    }
    renderHint(q);
  }

  function submitAnswer(event) {
    if (event) event.preventDefault();
    const q = getCurrentQuestion();
    if (!q || q.result) return;
    const raw = els.answerInput.value.trim();
    if (!raw) {
      toast('先写下你的答案，或点“不会，看答案”。', 'error', 2600);
      els.answerInput.focus();
      els.answerInput.classList.remove('shake');
      void els.answerInput.offsetWidth;
      els.answerInput.classList.add('shake');
      window.setTimeout(function () { els.answerInput.classList.remove('shake'); }, 360);
      return;
    }
    const compare = Core.compareAnswer(raw, q.term, q.type);
    recordAnswer(q, raw, false, compare);
  }

  function giveUp() {
    const q = getCurrentQuestion();
    if (!q || q.result) return;
    recordAnswer(q, '', true, { correct: false, reason: 'giveup' });
  }

  function recordAnswer(q, userAnswer, givenUp, compare) {
    if (q.result) return;
    q.userAnswer = userAnswer || '';
    q.givenUp = !!givenUp;
    q.compare = compare || null;
    q.result = !givenUp && compare && compare.correct ? 'correct' : 'wrong';
    q.answeredAt = new Date().toISOString();

    const item = state.items.find(function (entry) { return entry.id === q.itemId; });
    if (item) {
      item.stats = item.stats || { attempts: 0, correct: 0, wrong: 0 };
      item.stats.attempts += 1;
      if (q.result === 'correct') item.stats.correct += 1;
      else item.stats.wrong += 1;
      saveLibrary();
    }

    saveSession();
    cancelPendingSpeech();

    els.answerInput.disabled = true;
    els.answerInput.blur();
    els.btnSubmitAnswer.disabled = true;
    els.btnHint.disabled = true;
    els.btnGiveup.disabled = true;
    els.answerForm.hidden = true;

    renderFeedback(q);
    updateQuizHeader();

    if (window.innerWidth < 720) {
      window.setTimeout(function () {
        if (els.feedback && !els.feedback.hidden) {
          els.feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }

  function renderFeedback(q) {
    if (!q || !q.result) {
      els.feedback.hidden = true;
      return;
    }
    const stage = getCurrentStage();
    const isLastStage = state.session.stageIndex === state.session.stages.length - 1;
    const isLastInStage = stage && state.session.questionIndex === stage.questions.length - 1;
    const isLast = isLastStage && isLastInStage;
    const correct = q.result === 'correct';
    const compare = q.compare || {};
    const isPhrase = q.mode === 'phrase-def';
    const targetKind = isPhrase ? '词组' : '单词';

    let title = correct ? '答对了' : (q.givenUp ? '先记下这个' + targetKind : '再看一眼');
    let note = '';
    if (correct) {
      if (compare.reason === 'article' || compare.reason === 'article-variant') {
        note = compare.note || '冠词略有出入，按正确计';
      } else if (compare.reason === 'spelling-variant') {
        note = compare.note || '英美拼写变体，按正确计';
      } else if (q.hintUsed) {
        note = '用了首字母提示，下次试试直接听出来';
      } else {
        note = '拼写准确';
      }
    } else if (q.givenUp) {
      note = '看一遍释义，再听一遍发音';
    } else if (compare.reason === 'wrong' && Number.isFinite(compare.distance)) {
      if (compare.distance === 1) note = '只差 1 个字符';
      else if (compare.distance === 2) note = '只差 2 个字符';
      else note = '与正确答案相差 ' + compare.distance + ' 个字符';
    } else {
      note = '下一次会更好';
    }

    const pos = q.pos ? Core.posLabel(q.pos) : '';
    const source = sourceLabel(q.source);
    const metaParts = [];
    if (pos) metaParts.push(escapeHtml(pos));
    if (q.phonetic) metaParts.push(escapeHtml(q.phonetic));
    if (source) metaParts.push(escapeHtml(source));

    const html = [
      '<div class="feedback-head">',
      '  <span class="feedback-icon"><svg class="icon"><use href="#' + (correct ? 'i-check' : 'i-x') + '"></use></svg></span>',
      '  <span class="feedback-title">' + escapeHtml(title) + '</span>',
      '  <span class="feedback-note">' + escapeHtml(note) + '</span>',
      '</div>',
      '<div class="feedback-answer">',
      '  <span class="feedback-label">正确答案</span>',
      '  <span class="answer-term">' + escapeHtml(q.term) + '</span>',
      '  <button class="icon-btn speak-term-btn" type="button" data-speak-term="' + escapeHtml(q.term) + '" aria-label="听正确发音" title="听正确发音">',
      '    <svg class="icon"><use href="#i-volume"></use></svg>',
      '  </button>',
      '</div>',
      (!correct ? '  <div class="feedback-user">你的答案：' + (q.userAnswer ? '<strong>' + escapeHtml(q.userAnswer) + '</strong>' : '未作答') + '</div>' : ''),
      q.definition ? '  <div class="feedback-definition"><span class="feedback-label">英文释义</span><p>' + escapeHtml(q.definition) + '</p></div>' : '',
      q.chinese ? '  <div class="feedback-cn">中文释义：' + escapeHtml(q.chinese) + '</div>' : '',
      metaParts.length ? '  <div class="feedback-meta">' + metaParts.join(' · ') + '</div>' : '',
      '<div class="feedback-actions">',
      '  <button class="btn btn-primary" type="button" id="feedback-next">' +
        (isLast ? '查看成绩' : (isLastInStage ? '进入下一轮' : '下一题')) +
        '<svg class="icon"><use href="#i-arrow"></use></svg></button>',
      '</div>'
    ].join('');

    els.feedback.className = 'feedback ' + (correct ? 'is-correct' : 'is-wrong');
    els.feedback.innerHTML = html;
    els.feedback.hidden = false;
  }

  function handleFeedbackClick(event) {
    const speakButton = event.target.closest('[data-speak-term]');
    if (speakButton) {
      speakTerm(speakButton.dataset.speakTerm);
      return;
    }
    if (event.target.closest('#feedback-next')) {
      nextQuestion();
    }
  }

  function nextQuestion() {
    if (!state.session) return;
    const q = getCurrentQuestion();
    if (!q || !q.result) return;
    cancelPendingSpeech();

    const stage = getCurrentStage();
    if (state.session.questionIndex + 1 < stage.questions.length) {
      state.session.questionIndex += 1;
      saveSession();
      renderQuestion();
      scrollQuizTop();
      return;
    }

    if (state.session.stageIndex + 1 < state.session.stages.length) {
      state.session.stageIndex += 1;
      state.session.questionIndex = 0;
      saveSession();
      const nextStage = getCurrentStage();
      if (nextStage) toast('进入下一轮：' + nextStage.label, 'info', 2400);
      renderQuestion();
      scrollQuizTop();
      return;
    }

    finishSession();
  }

  function scrollQuizTop() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  function finishSession() {
    const session = state.session;
    if (!session) return;

    const stageStats = session.stages.map(function (stage) {
      const total = stage.questions.length;
      const correct = stage.questions.filter(function (q) { return q.result === 'correct'; }).length;
      return { label: stage.label, correct: correct, total: total };
    });
    const total = session.total;
    const correct = countCorrect(session);
    const mistakes = [];
    session.stages.forEach(function (stage) {
      stage.questions.forEach(function (q) {
        if (q.result === 'wrong') mistakes.push(q);
      });
    });

    const result = {
      sessionId: session.id,
      correct: correct,
      total: total,
      percent: Core.percent(correct, total),
      stageStats: stageStats,
      mistakes: mistakes,
      durationMs: Date.now() - session.startedAt,
      isRetry: !!session.isRetry
    };

    const testedIds = [];
    const seen = new Set();
    session.stages.forEach(function (stage) {
      stage.questions.forEach(function (q) {
        if (q.itemId && !seen.has(q.itemId)) {
          seen.add(q.itemId);
          testedIds.push(q.itemId);
        }
      });
    });

    state.history.unshift({
      id: Core.uid('history'),
      date: new Date().toISOString(),
      correct: correct,
      total: total,
      percent: result.percent,
      durationMs: result.durationMs,
      isRetry: result.isRetry,
      testedIds: testedIds,
      stageStats: stageStats
    });
    state.history = state.history.slice(0, 20);
    saveHistory();

    state.lastResult = result;
    state.session = null;
    saveSession();
    cancelPendingSpeech();
    renderResult();
    showScreen('result');
    document.title = '词声 · 本轮成绩';
  }

  /* ------------------------------------------------------------------ */
  /* 成绩页                                                              */
  /* ------------------------------------------------------------------ */

  function renderResult() {
    const result = state.lastResult;
    if (!result) {
      showSetupScreen();
      return;
    }

    const percent = result.percent;
    let color = 'var(--teal)';
    if (percent < 60) color = 'var(--red)';
    else if (percent < 80) color = 'var(--gold)';

    els.scoreRing.style.setProperty('--pct', String(percent));
    els.scoreRing.style.setProperty('--score-color', color);
    els.resultPercent.textContent = percent + '%';
    els.resultFraction.textContent = result.correct + ' / ' + result.total + ' 题';

    let title = '';
    let subtitle = '';
    if (percent >= 95) {
      title = '耳朵和记忆都很稳。';
      subtitle = result.mistakes.length
        ? '几乎全部答对，只剩 ' + result.mistakes.length + ' 个细节可以再听一遍。'
        : '全部答对。可以换一组词，或把更多词标成重点再来一轮。';
    } else if (percent >= 85) {
      title = '这一轮，听得很扎实。';
      subtitle = '答对 ' + result.correct + ' / ' + result.total + ' 题。错题已经整理好，趁记忆还热着再练一遍。';
    } else if (percent >= 70) {
      title = '大部分都接住了。';
      subtitle = '有几个词还差一点。先听一遍正确发音，再做一轮错题，会记得更牢。';
    } else if (percent >= 50) {
      title = '有收获，也有几个盲点。';
      subtitle = '错题不是坏事，它刚好告诉你下一轮该听什么。可以只重练错题。';
    } else {
      title = '先把这些词收进耳朵。';
      subtitle = '这一轮错得有点多，建议先听错题发音、看释义，再重新来一组。';
    }
    if (result.isRetry) {
      title = percent === 100 ? '错题全部拿下。' : title;
      subtitle = percent === 100
        ? '上一轮的错词这次全部写对了。可以回到词库继续加词。'
        : subtitle;
    }
    els.resultTitle.textContent = title;
    els.resultSubtitle.textContent = subtitle;

    els.resultMeta.innerHTML = [
      '<span>总题数 <strong>' + result.total + '</strong></span>',
      '<span>正确 <strong>' + result.correct + '</strong></span>',
      '<span>正确率 <strong>' + percent + '%</strong></span>',
      '<span>用时 <strong>' + Core.formatDuration(result.durationMs) + '</strong></span>'
    ].join('');

    els.resultBreakdown.innerHTML = result.stageStats.map(function (stage) {
      const stagePercent = Core.percent(stage.correct, stage.total);
      return [
        '<div class="breakdown-row">',
        '  <span class="breakdown-label"><strong>' + escapeHtml(stage.label) + '</strong><span>' + stage.total + ' 题</span></span>',
        '  <span class="breakdown-track"><span class="breakdown-fill" data-width="' + stagePercent + '"></span></span>',
        '  <span class="breakdown-score' + (stagePercent < 60 ? ' low' : '') + '">' + stage.correct + ' / ' + stage.total + '</span>',
        '</div>'
      ].join('');
    }).join('');

    window.requestAnimationFrame(function () {
      Array.from(els.resultBreakdown.querySelectorAll('.breakdown-fill')).forEach(function (fill) {
        fill.style.width = fill.dataset.width + '%';
      });
    });

    els.mistakeCount.textContent = result.mistakes.length + ' 个';
    els.btnRetryMistakes.disabled = result.mistakes.length === 0;
    els.btnRetryMistakes.textContent = result.mistakes.length
      ? '重练错题（' + result.mistakes.length + '）'
      : '没有错题';

    if (!result.mistakes.length) {
      els.resultMistakes.innerHTML = [
        '<div class="mistake-empty">',
        '  <div class="empty-icon"><svg class="icon"><use href="#i-check"></use></svg></div>',
        '  <strong>这一轮没有错题</strong>',
        '  <p>试试换一组词，或把更多重点词标星后再来一轮。</p>',
        '</div>'
      ].join('');
      return;
    }

    els.resultMistakes.innerHTML = result.mistakes.map(function (q) {
      return [
        '<div class="mistake-row">',
        '  <div class="mistake-top">',
        '    <span class="mistake-term">' + escapeHtml(q.term) + '</span>',
        '    <span class="mistake-mode">' + getModeLabel(q.mode) + '</span>',
        '    <button class="icon-btn mistake-speak" type="button" data-speak-term="' + escapeHtml(q.term) + '" aria-label="听发音" title="听发音">',
        '      <svg class="icon"><use href="#i-volume"></use></svg>',
        '    </button>',
        '  </div>',
        '  <div class="mistake-answer">你的答案：' + (q.userAnswer ? '<strong>' + escapeHtml(q.userAnswer) + '</strong>' : '未作答') + '</div>',
        q.definition ? '  <div class="mistake-def">' + escapeHtml(q.definition) + '</div>' : '',
        q.chinese ? '  <div class="mistake-cn">中文：' + escapeHtml(q.chinese) + '</div>' : '',
        '</div>'
      ].join('');
    }).join('');
  }

  function startRetrySession() {
    if (!state.lastResult || !state.lastResult.mistakes.length) {
      toast('这一轮没有错题。', 'info');
      return;
    }
    if (!speech || !speech.supported) {
      toast('当前浏览器不支持语音合成。', 'error');
      return;
    }

    const questions = state.lastResult.mistakes.map(function (q) {
      return {
        id: Core.uid('q'),
        itemId: q.itemId,
        term: q.term,
        type: q.type,
        definition: q.definition,
        spokenDefinition: q.spokenDefinition,
        chinese: q.chinese,
        pos: q.pos,
        phonetic: q.phonetic,
        source: q.source,
        mode: q.mode,
        result: null,
        userAnswer: '',
        hintUsed: false,
        givenUp: false,
        compare: null,
        answeredAt: ''
      };
    });

    state.session = {
      id: Core.uid('session'),
      startedAt: Date.now(),
      stages: [{
        id: Core.uid('stage'),
        label: '错题重练',
        shortLabel: '错题',
        mode: 'mixed',
        questions: questions
      }],
      stageIndex: 0,
      questionIndex: 0,
      total: questions.length,
      isRetry: true
    };
    state.lastResult = null;
    saveSession();
    beginQuiz();
    toast('只练这 ' + questions.length + ' 个错词。', 'info', 2800);
  }

  /* ------------------------------------------------------------------ */
  /* 弹窗 / Toast / 确认                                                 */
  /* ------------------------------------------------------------------ */

  function openHelp() {
    if (!els.helpDialog.open) els.helpDialog.showModal();
    resetDialogScroll(els.helpDialog);
  }

  function resetDialogScroll(dialog) {
    if (!dialog) return;
    const card = dialog.querySelector('.modal-card');
    if (card) card.scrollTop = 0;
  }

  let confirmResolver = null;

  function confirmAction(options) {
    return new Promise(function (resolve) {
      confirmResolver = resolve;
      els.confirmTitle.textContent = options.title || '确定吗？';
      els.confirmBody.textContent = options.body || '';
      els.confirmOk.textContent = options.confirmText || '确定';
      els.confirmOk.className = 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary');
      els.confirmIcon.classList.toggle('is-danger', !!options.danger);
      els.confirmCancel.textContent = options.cancelText || '取消';
      if (!els.confirmDialog.open) els.confirmDialog.showModal();
      resetDialogScroll(els.confirmDialog);
      window.setTimeout(function () { els.confirmOk.focus(); }, 50);
    });
  }

  function closeConfirm(value) {
    const resolver = confirmResolver;
    confirmResolver = null;
    if (els.confirmDialog.open) els.confirmDialog.close();
    if (resolver) resolver(value);
  }

  function bindDialogEvents() {
    els.btnFetchCancel.addEventListener('click', function () {
      if (!state.ui.fetchRunning) {
        els.fetchDialog.close();
        return;
      }
      state.ui.fetchCancelled = true;
      els.btnFetchCancel.disabled = true;
      els.fetchStatus.textContent = '正在停止…';
    });
    els.fetchDialog.addEventListener('cancel', function (event) {
      if (state.ui.fetchRunning) {
        event.preventDefault();
        state.ui.fetchCancelled = true;
        els.btnFetchCancel.disabled = true;
        els.fetchStatus.textContent = '正在停止…';
      }
    });

    els.confirmOk.addEventListener('click', function () { closeConfirm(true); });
    els.confirmCancel.addEventListener('click', function () { closeConfirm(false); });
    els.confirmDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeConfirm(false);
    });
    els.confirmDialog.addEventListener('close', function () {
      if (confirmResolver) {
        const resolver = confirmResolver;
        confirmResolver = null;
        resolver(false);
      }
    });

    els.btnHelpClose.addEventListener('click', function () { els.helpDialog.close(); });
    els.btnHelpOk.addEventListener('click', function () { els.helpDialog.close(); });
    els.helpDialog.addEventListener('click', function (event) {
      if (event.target === els.helpDialog) els.helpDialog.close();
    });
    els.settingsDialog.addEventListener('click', function (event) {
      if (event.target === els.settingsDialog) els.settingsDialog.close();
    });
    els.editDialog.addEventListener('click', function (event) {
      if (event.target === els.editDialog) els.editDialog.close();
    });
    els.importDialog.addEventListener('click', function (event) {
      if (event.target === els.importDialog) els.importDialog.close();
    });
    els.confirmDialog.addEventListener('click', function (event) {
      if (event.target === els.confirmDialog) closeConfirm(false);
    });
  }

  function toast(message, type, duration) {
    if (!els.toastRegion) return;
    const node = document.createElement('div');
    node.className = 'toast' + (type ? ' is-' + type : '');
    const icon = type === 'success' ? 'i-check' : (type === 'error' ? 'i-x' : 'i-info');
    node.innerHTML = '<span class="toast-icon"><svg class="icon"><use href="#' + icon + '"></use></svg></span>' +
      '<span>' + escapeHtml(message) + '</span>';
    els.toastRegion.appendChild(node);
    window.setTimeout(function () {
      node.classList.add('is-leaving');
      window.setTimeout(function () { node.remove(); }, 220);
    }, duration || 3200);
  }

  /* ------------------------------------------------------------------ */
  /* 页面切换                                                            */
  /* ------------------------------------------------------------------ */

  function showScreen(name) {
    ['setup', 'quiz', 'result'].forEach(function (screenName) {
      const screen = els['screen' + screenName.charAt(0).toUpperCase() + screenName.slice(1)];
      if (screen) screen.classList.toggle('is-active', screenName === name);
    });
    document.body.dataset.screen = name;
    if (name !== 'quiz') {
      if (state.ui.autoPlayTimer) {
        window.clearTimeout(state.ui.autoPlayTimer);
        state.ui.autoPlayTimer = null;
      }
      if (speech) speech.cancel();
    }
    document.title = name === 'quiz'
      ? '词声 · 测试中'
      : (name === 'result' ? '词声 · 本轮成绩' : '词声 · YTJ 语音默写');
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  /* ------------------------------------------------------------------ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
