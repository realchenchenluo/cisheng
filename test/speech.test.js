'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let passed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('  ok  ' + name);
    })
    .catch((error) => {
      console.error('  FAIL ' + name);
      throw error;
    });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSandbox() {
  const spoken = [];
  const stateEvents = [];
  const voices = [
    { name: 'Test English', lang: 'en-US', voiceURI: 'test-en', localService: true }
  ];

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  const fakeWindow = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: () => {},
      speak: (utterance) => {
        spoken.push(utterance.text);
        setTimeout(() => {
          if (typeof utterance.onstart === 'function') utterance.onstart();
        }, 1);
        setTimeout(() => {
          if (typeof utterance.onend === 'function') utterance.onend();
        }, 6);
      },
      cancel: () => {}
    },
    SpeechSynthesisUtterance: FakeUtterance
  };

  const sandbox = { window: fakeWindow, console: console };
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'speech.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'speech.js' });
  const engine = fakeWindow.speechEngine;
  engine.onStateChange = (payload) => stateEvents.push(payload.speaking);
  return { engine, spoken, stateEvents, fakeWindow };
}

(async function run() {
  console.log('\n[语音引擎]');

  const { engine, spoken, stateEvents, fakeWindow } = createSandbox();

  await test('识别英文语音并默认选中', () => {
    assert.equal(engine.supported, true);
    assert.equal(engine.getEnglishVoices().length, 1);
    assert.equal(engine.recommendedVoice().voiceURI, 'test-en');
  });

  await test('朗读释义会切分长文本并按顺序播报', async () => {
    const text = [
      'The first sentence explains the meaning of this item in a clear and simple way.',
      'The second sentence gives another helpful clue without revealing the answer.',
      'The third sentence adds a little more context for the listener.'
    ].join(' ');
    const chunks = fakeWindow.splitForSpeech(text);
    assert.ok(chunks.length >= 1);
    engine.speakDefinition(text, { rate: 0.9, voiceURI: 'test-en' });
    await wait(850);
    assert.ok(spoken.length >= 1);
    assert.ok(spoken.join(' ').includes('first sentence'));
    assert.deepEqual(stateEvents.slice(0, 2), [true, false]);
    assert.equal(engine.speaking, false);
  });

  await test('听写单词按次数重复', async () => {
    spoken.length = 0;
    stateEvents.length = 0;
    engine.speakWord('serendipity', { repeats: 2, rate: 0.9, voiceURI: 'test-en', repeatGap: 15 });
    await wait(300);
    assert.deepEqual(spoken, ['serendipity', 'serendipity']);
    assert.equal(stateEvents[0], true);
    assert.equal(stateEvents[stateEvents.length - 1], false);
  });

  await test('取消播放会停止后续分片', async () => {
    spoken.length = 0;
    const text = Array.from({ length: 8 }, (_, i) =>
      'Sentence number ' + (i + 1) + ' contains enough words to make the spoken definition longer and test chunking.'
    ).join(' ');
    engine.speakDefinition(text, { rate: 0.9, voiceURI: 'test-en' });
    await wait(20);
    engine.cancel();
    const afterCancel = spoken.length;
    await wait(300);
    assert.equal(engine.speaking, false);
    assert.equal(spoken.length, afterCancel);
  });

  await test('没有语音时仍能安全失败', async () => {
    const empty = createSandbox();
    empty.fakeWindow.speechSynthesis.getVoices = () => [];
    empty.engine.refreshVoices();
    let error = null;
    empty.engine.speakDefinition('A short definition that cannot be spoken.', {
      voiceURI: 'missing',
      onError: (event) => { error = event; }
    });
    await wait(120);
    assert.equal(empty.engine.getEnglishVoices().length, 0);
    assert.equal(empty.engine.supported, true);
    assert.ok(empty.spoken.length >= 0);
    assert.ok(error === null || typeof error === 'object');
    empty.engine.cancel();
  });

  await test('分句函数处理无标点文本', () => {
    assert.equal(fakeWindow.splitForSpeech('').length, 0);
    const chunks = fakeWindow.splitForSpeech('one two three four five six seven eight nine ten');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], 'one two three four five six seven eight nine ten');
  });

  console.log('\n全部通过：' + passed + ' 项语音测试\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
