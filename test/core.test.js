'use strict';

const assert = require('node:assert/strict');
const Core = require('../js/core.js');

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok  ' + name);
  } catch (error) {
    console.error('  FAIL ' + name);
    throw error;
  }
}

console.log('\n[词库解析]');

test('解析 pipe 格式（单词 + 英文释义 + 中文）', () => {
  const result = Core.parseWordList('resilient | Able to recover quickly from difficulties. | 有韧性的');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].term, 'resilient');
  assert.equal(result.items[0].type, 'word');
  assert.equal(result.items[0].definition, 'Able to recover quickly from difficulties.');
  assert.equal(result.items[0].chinese, '有韧性的');
});

test('解析 tab、冒号、破折号格式', () => {
  const text = [
    'ambiguous\tOpen to more than one interpretation.',
    'break the ice: To make people feel more relaxed.',
    'on the fence — Unable or unwilling to decide.',
    'serendipity - The happy accident of finding something valuable.'
  ].join('\n');
  const result = Core.parseWordList(text);
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].definition, 'Open to more than one interpretation.');
  assert.equal(result.items[1].term, 'break the ice');
  assert.equal(result.items[1].type, 'phrase');
  assert.equal(result.items[2].term, 'on the fence');
  assert.equal(result.items[3].term, 'serendipity');
});

test('解析带引号 CSV，保留释义里的逗号', () => {
  const text = 'meticulous,"Showing great attention to detail, and extreme care.",一丝不苟的';
  const result = Core.parseWordList(text);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].definition, 'Showing great attention to detail, and extreme care.');
  assert.equal(result.items[0].chinese, '一丝不苟的');
});

test('一行逗号分隔多个单词', () => {
  const result = Core.parseWordList('apple,banana,orange');
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map(i => i.term), ['apple', 'banana', 'orange']);
});

test('英文后接中文释义', () => {
  const result = Core.parseWordList('pragmatic 务实的\ninevitable 不可避免的');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].term, 'pragmatic');
  assert.equal(result.items[0].chinese, '务实的');
  assert.equal(result.items[1].definition, '');
});

test('三列均为中文时合并为中文释义', () => {
  const result = Core.parseWordList('apple,苹果,一种水果');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].term, 'apple');
  assert.equal(result.items[0].definition, '');
  assert.ok(result.items[0].chinese.includes('苹果'));
  assert.ok(result.items[0].chinese.includes('一种水果'));
});

test('清理 OCR 汉字之间的空格', () => {
  const result = Core.parseWordList('serendipity 意外 发 现\nbreak the ice 打破 僵局');
  assert.equal(result.items[0].term, 'serendipity');
  assert.equal(result.items[0].chinese, '意外发现');
  assert.equal(result.items[1].term, 'break the ice');
  assert.equal(result.items[1].chinese, '打破僵局');
});

test('去掉序号、项目符号、表头和注释', () => {
  const text = [
    '# 我的词库',
    'word | definition',
    '1. alleviate | To make pain less severe.',
    '- coherent | Logical and clearly expressed.',
    '（2）tenacious | Determined and not easily discouraged.'
  ].join('\n');
  const result = Core.parseWordList(text);
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map(i => i.term), ['alleviate', 'coherent', 'tenacious']);
  assert.equal(result.stats.headers, 1);
});

test('重复词条合并并补全缺失字段', () => {
  const result = Core.parseWordList('candid\ncandid | Truthful and straightforward. | 坦率的');
  assert.equal(result.items.length, 1);
  assert.equal(result.stats.duplicates, 1);
  assert.equal(result.items[0].definition, 'Truthful and straightforward.');
  assert.equal(result.items[0].chinese, '坦率的');
});

test('过滤无效行', () => {
  const result = Core.parseWordList('hello\nhttp://example.com\n———\n12345\n中文词条');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].term, 'hello');
  assert.equal(result.stats.invalid, 4);
});

test('统计单词、词组和缺释义数量', () => {
  const result = Core.parseWordList('alpha\nbeta | A test item.\ngamma ray | A beam of waves.');
  assert.equal(result.stats.words, 2);
  assert.equal(result.stats.phrases, 1);
  assert.equal(result.stats.withDefinition, 2);
  assert.equal(result.stats.missingDefinition, 1);
});

console.log('\n[答案判定]');

test('大小写、空格、连字符、标点归一', () => {
  assert.equal(Core.compareAnswer('  Break   The-ICE! ', 'break the ice', 'phrase').correct, true);
  assert.equal(Core.compareAnswer('Serendipity.', 'serendipity', 'word').correct, true);
});

test('冠词缺失按正确计', () => {
  const cmp = Core.compareAnswer('blessing in disguise', 'a blessing in disguise', 'phrase');
  assert.equal(cmp.correct, true);
  assert.equal(cmp.reason, 'article');
});

test('英美拼写变体按正确计', () => {
  assert.equal(Core.compareAnswer('color', 'colour', 'word').correct, true);
  assert.equal(Core.compareAnswer('organize', 'organise', 'word').correct, true);
  assert.equal(Core.compareAnswer('center', 'centre', 'word').correct, true);
  assert.equal(Core.compareAnswer('traveling', 'travelling', 'word').correct, true);
  assert.equal(Core.compareAnswer('gray', 'grey', 'word').correct, true);
  assert.equal(Core.compareAnswer('program', 'programme', 'word').correct, true);
  assert.equal(Core.compareAnswer('acknowledgment', 'acknowledgement', 'word').correct, true);
});

test('错误答案给出编辑距离', () => {
  const cmp = Core.compareAnswer('resiliant', 'resilient', 'word');
  assert.equal(cmp.correct, false);
  assert.equal(cmp.distance, 1);
});

test('空格答案判为未作答', () => {
  assert.equal(Core.compareAnswer('   ', 'hello', 'word').correct, false);
  assert.equal(Core.compareAnswer('', 'hello', 'word').reason, 'empty');
});

console.log('\n[释义脱敏]');

test('播报释义时隐藏目标单词及其词形', () => {
  const masked = Core.maskDefinition('Serendipity is the occurrence of serendipitous events.', 'serendipity', 'word');
  assert.ok(!/serendipity/i.test(masked));
  assert.ok(/blank/i.test(masked));
});

test('播报释义时隐藏词组及内容词', () => {
  const masked = Core.maskDefinition('To break the ice means to make people feel relaxed.', 'break the ice', 'phrase');
  assert.ok(!/break the ice/i.test(masked));
  assert.ok(!/\bbreak\b/i.test(masked));
  assert.ok(!/\bice\b/i.test(masked));
});

test('常见缩写展开为适合朗读的文本', () => {
  const masked = Core.maskDefinition('A fruit, e.g. an apple, etc.', 'banana', 'word');
  assert.ok(/for example/i.test(masked));
  assert.ok(/etcetera/i.test(masked));
});

test('自我循环释义判为不可用', () => {
  assert.equal(Core.isUsableDefinition('serendipity', 'serendipity', 'word'), false);
  assert.equal(Core.isUsableDefinition('A happy accident of finding something valuable.', 'serendipity', 'word'), true);
});

console.log('\n[出题选择]');

function makeItems() {
  const words = [
    ['serendipity', 'The happy accident of finding something valuable when not looking for it.'],
    ['resilient', 'Able to recover quickly from difficulties or setbacks.'],
    ['ambiguous', 'Open to more than one interpretation and not clearly defined.'],
    ['meticulous', 'Showing great attention to detail and extreme care.'],
    ['pragmatic', 'Dealing with things practically rather than according to theory.'],
    ['alleviate', 'To make pain or a problem less severe.'],
    ['inevitable', 'Certain to happen and impossible to avoid.'],
    ['coherent', 'Logical, consistent, and clearly expressed.'],
    ['deteriorate', 'To become progressively worse in quality or condition.'],
    ['innovative', 'Introducing new ideas or methods.'],
    ['reluctant', 'Unwilling and hesitant to do something.'],
    ['scrutinize', 'To examine something very carefully.'],
    ['tenacious', 'Determined and not easily discouraged.'],
    ['versatile', 'Able to adapt to many different functions or activities.'],
    ['ubiquitous', 'Present or found everywhere at the same time.'],
    ['compensate', 'To make up for a loss or imbalance.'],
    ['diminish', 'To make or become smaller or less.'],
    ['profound', 'Very great, intense, or deeply meaningful.']
  ].map((pair, index) => ({
    id: 'w' + index,
    term: pair[0],
    type: 'word',
    definition: pair[1],
    chinese: '',
    pos: 'adjective',
    phonetic: '',
    source: 'test',
    starred: index < 2,
    stats: { attempts: 0, correct: 0, wrong: 0 }
  }));
  const phrases = [
    ['break the ice', 'To make people feel more relaxed and start talking.'],
    ['a blessing in disguise', 'Something that seems bad at first but later turns out to be beneficial.'],
    ['on the fence', 'Unable or unwilling to decide between two choices.'],
    ['bite the bullet', 'To accept a difficult situation and deal with it bravely.']
  ].map((pair, index) => ({
    id: 'p' + index,
    term: pair[0],
    type: 'phrase',
    definition: pair[1],
    chinese: '',
    pos: 'phrase',
    phonetic: '',
    source: 'test',
    starred: false,
    stats: { attempts: 0, correct: 0, wrong: 0 }
  }));
  return phrases.concat(words);
}

test('生成 3 词组 + 8 单词释义 + 10 听写', () => {
  const result = Core.selectSession(makeItems(), { phraseCount: 3, wordCount: 8, dictationCount: 10, rng: () => 0.42 });
  assert.equal(result.stages.length, 3);
  assert.equal(result.counts.phrases, 3);
  assert.equal(result.counts.words, 8);
  assert.equal(result.counts.dictation, 10);
  assert.equal(result.counts.total, 21);
  result.stages.forEach(stage => {
    assert.equal(stage.questions.length, stage.mode === 'phrase-def' ? 3 : stage.mode === 'word-def' ? 8 : 10);
  });
});

test('听写优先避开释义轮已用过的单词', () => {
  const result = Core.selectSession(makeItems(), { phraseCount: 3, wordCount: 8, dictationCount: 10, rng: () => 0.42 });
  const wordDefIds = new Set(result.stages[1].questions.map(q => q.itemId));
  const audioIds = result.stages[2].questions.map(q => q.itemId);
  const overlap = audioIds.filter(id => wordDefIds.has(id)).length;
  assert.equal(overlap, 0);
});

test('词库不足时自动缩短并给出提示', () => {
  const all = makeItems();
  const small = [all[0]].concat(all.filter(i => i.type === 'word').slice(0, 4));
  const result = Core.selectSession(small, { phraseCount: 3, wordCount: 8, dictationCount: 10, rng: () => 0.1 });
  assert.equal(result.counts.phrases, 1);
  assert.equal(result.counts.words, 4);
  assert.equal(result.counts.dictation, 4);
  assert.ok(result.warnings.length >= 3);
});

test('缺释义的词不能进入释义轮，但可以进入听写轮', () => {
  const items = makeItems();
  items.forEach(item => { if (item.term !== 'candid') item.definition = item.definition || ''; });
  items.push({
    id: 'no-def', term: 'candid', type: 'word', definition: '', chinese: '坦率的',
    pos: '', phonetic: '', source: '', starred: false, stats: { attempts: 0, correct: 0, wrong: 0 }
  });
  const result = Core.selectSession(items, { phraseCount: 0, wordCount: 20, dictationCount: 10, rng: () => 0.3 });
  const wordDefIds = result.stages[0].questions.map(q => q.itemId);
  const audioIds = result.stages[1].questions.map(q => q.itemId);
  assert.ok(!wordDefIds.includes('no-def'));
  assert.ok(audioIds.includes('no-def'));
});

test('星标词显著提高被选中概率', () => {
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const items = makeItems().filter(i => i.type === 'word');
  items.forEach(i => { i.starred = false; });
  items[0].starred = true;
  let starredHits = 0;
  for (let i = 0; i < 200; i += 1) {
    const session = Core.selectSession(items, {
      phraseCount: 0, wordCount: 1, dictationCount: 0,
      rng: mulberry32(12345 + i * 7919)
    });
    if (session.stages[0].questions[0].itemId === items[0].id) starredHits += 1;
  }
  assert.ok(starredHits > 15, 'starred hits: ' + starredHits);
});

console.log('\n[辅助函数]');

test('首字母提示', () => {
  const hint = Core.letterMask('break the ice');
  assert.equal(hint.words, 3);
  assert.equal(hint.letters, 11);
  assert.ok(hint.text.startsWith('b _'));
  assert.ok(hint.meta.includes('3 个单词'));
});

test('百分比与时长格式化', () => {
  assert.equal(Core.percent(17, 21), 81);
  assert.equal(Core.percent(0, 0), 0);
  assert.equal(Core.formatDuration(65000), '1 分 05 秒');
});

test('HTML 转义', () => {
  assert.equal(Core.escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

console.log('\n全部通过：' + passed + ' 项测试\n');
