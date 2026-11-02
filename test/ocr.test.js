'use strict';

const assert = require('node:assert/strict');
require('../js/ocr.js');

const OCR = global.WordOCR;

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

console.log('\n[拍照识别文本清理]');

test('保留英文行，去掉纯数字和纯中文行', () => {
  const text = OCR.cleanOcrText([
    'serendipity 意外 发 现',
    '12345',
    '',
    'break the ice 打破 僵局',
    '纯中文行',
    'resilient'
  ].join('\n'));
  assert.equal(text, [
    'serendipity 意外发现',
    'break the ice 打破僵局',
    'resilient'
  ].join('\n'));
});

test('合并 OCR 在行尾断开的英文单词', () => {
  const text = OCR.cleanOcrText('serendip-\nity\nbreak the ice');
  assert.equal(text, 'serendipity\nbreak the ice');
});

test('清理项目符号、多余空格和行尾竖线', () => {
  const text = OCR.cleanOcrText('  •  resilient   |  \n  • meticulous |  ');
  assert.equal(text, 'resilient\nmeticulous');
});

test('汉字之间不留空格', () => {
  assert.equal(OCR.cleanOcrText('ubiquitous 无 处 不 在 的'), 'ubiquitous 无处不在的');
});

test('空文本安全返回空字符串', () => {
  assert.equal(OCR.cleanOcrText(''), '');
  assert.equal(OCR.cleanOcrText(null), '');
  assert.equal(OCR.cleanOcrText('123\n中文'), '');
});

console.log('\n全部通过：' + passed + ' 项 OCR 文本测试\n');
