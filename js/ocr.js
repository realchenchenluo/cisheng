/*!
 * 词声 · ocr.js
 * 浏览器端拍照识别：图片预处理 + 本地 Tesseract.js（英文 + 简体中文）。
 * 图片只在本机处理，不会上传。
 */
(function (global) {
  'use strict';

  const MAX_SIDE = 2400;
  const LANG = 'eng+chi_sim';
  const BASE = (typeof document !== 'undefined' && document.baseURI)
    ? document.baseURI
    : 'http://127.0.0.1/';
  const WORKER_PATH = new URL('vendor/tesseract/worker.min.js', BASE).href;
  const CORE_PATH = new URL('vendor/tesseract/', BASE).href;
  const LANG_PATH = new URL('vendor/tesseract/lang/', BASE).href;

  let worker = null;
  let workerPromise = null;
  let workerGeneration = 0;
  let runToken = 0;
  let activeProgress = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        resolve({ image: image, url: url });
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('IMAGE_DECODE_FAILED'));
      };
      image.src = url;
    });
  }

  async function prepareImage(file) {
    let source = null;
    let temporaryUrl = '';

    if (global.createImageBitmap) {
      try {
        source = await global.createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (error) {
        source = null;
      }
    }

    if (!source) {
      try {
        const loaded = await loadImageElement(file);
        source = loaded.image;
        temporaryUrl = loaded.url;
      } catch (error) {
        throw new Error('IMAGE_DECODE_FAILED');
      }
    }

    const width0 = source.width || source.naturalWidth || 0;
    const height0 = source.height || source.naturalHeight || 0;
    if (!width0 || !height0) {
      if (source.close) source.close();
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      throw new Error('IMAGE_DECODE_FAILED');
    }

    const scale = Math.min(1, MAX_SIDE / Math.max(width0, height0));
    const width = Math.max(1, Math.round(width0 * scale));
    const height = Math.max(1, Math.round(height0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      if (source.close) source.close();
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      throw new Error('IMAGE_DECODE_FAILED');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    if (source.close) source.close();
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);

    // 轻微灰度和对比度增强，保留彩色高亮以外的文字轮廓。
    try {
      const pixels = context.getImageData(0, 0, width, height);
      const data = pixels.data;
      const contrast = 1.12;
      const intercept = 128 * (1 - contrast);
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const value = clamp(gray * contrast + intercept, 0, 255);
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }
      context.putImageData(pixels, 0, 0);
    } catch (error) {
      /* 某些浏览器限制读取像素时，直接使用原图继续识别 */
    }

    return {
      canvas: canvas,
      previewUrl: canvas.toDataURL('image/jpeg', 0.9),
      width: width,
      height: height
    };
  }

  function cleanOcrText(raw) {
    const text = String(raw == null ? '' : raw)
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ');
    const lines = text.split('\n');
    const output = [];

    for (let i = 0; i < lines.length; i += 1) {
      let line = lines[i].replace(/\s+/g, ' ').trim();
      if (!line) continue;

      // 合并 OCR 在行尾断开的英文单词：serendip-\nity
      if (/[A-Za-z]-$/.test(line)) {
        const next = (lines[i + 1] || '').replace(/\s+/g, ' ').trim();
        if (/^[a-z]/.test(next)) {
          line = line.slice(0, -1) + next;
          i += 1;
        }
      }

      line = line
        .replace(/^[\s•·*\-–—|]+/, '')
        .replace(/[\s|]+$/, '')
        .trim();

      if (!/[A-Za-z]/.test(line)) continue;

      // Tesseract 有时会在汉字之间插入空格；中文释义不需要这些空格。
      let previous;
      do {
        previous = line;
        line = line.replace(/([\u3400-\u9FFF])\s+(?=[\u3400-\u9FFF])/g, '$1');
      } while (line !== previous);

      output.push(line);
    }

    return output.join('\n').trim();
  }

  function getWorker(Tesseract) {
    if (worker) return Promise.resolve(worker);
    if (workerPromise) return workerPromise;

    const generation = workerGeneration;
    workerPromise = Tesseract.createWorker(LANG, 1, {
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      langPath: LANG_PATH,
      logger: function (message) {
        if (typeof activeProgress === 'function') activeProgress(message);
      }
    }).then(function (created) {
      if (generation !== workerGeneration) {
        try { created.terminate(); } catch (error) { /* ignore */ }
        throw new Error('OCR_CANCELLED');
      }
      worker = created;
      return created;
    }).catch(function (error) {
      if (generation === workerGeneration) {
        workerPromise = null;
        worker = null;
      }
      throw error;
    });

    return workerPromise;
  }

  async function recognizeImage(file, options) {
    const opts = options || {};
    const token = ++runToken;
    activeProgress = function (message) {
      if (token === runToken && typeof opts.onProgress === 'function') {
        opts.onProgress(message);
      }
    };

    try {
      const prepared = await prepareImage(file);
      if (token !== runToken) throw new Error('OCR_CANCELLED');

      const Tesseract = global.Tesseract;
      if (!Tesseract) throw new Error('OCR_ENGINE_LOAD_FAILED');

      const engine = await getWorker(Tesseract);
      if (token !== runToken) throw new Error('OCR_CANCELLED');

      const result = await engine.recognize(prepared.canvas);
      if (token !== runToken) throw new Error('OCR_CANCELLED');

      const data = result && result.data ? result.data : {};
      return {
        text: cleanOcrText(data.text),
        confidence: Math.round(Number(data.confidence) || 0),
        previewUrl: prepared.previewUrl,
        width: prepared.width,
        height: prepared.height
      };
    } finally {
      if (token === runToken) activeProgress = null;
    }
  }

  async function abort() {
    runToken += 1;
    activeProgress = null;
    workerGeneration += 1;
    const pending = workerPromise;
    workerPromise = null;
    worker = null;

    if (pending) {
      try {
        const created = await pending;
        await created.terminate();
      } catch (error) {
        /* 已被取消或初始化失败 */
      }
    }
  }

  global.WordOCR = {
    prepareImage: prepareImage,
    recognizeImage: recognizeImage,
    cleanOcrText: cleanOcrText,
    abort: abort
  };
})(typeof window !== 'undefined' ? window : globalThis);
