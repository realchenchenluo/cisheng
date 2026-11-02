# 本地 OCR 组件说明

拍照识别使用以下开源组件，均已放在本目录，运行时不需要再从 CDN 下载：

| 文件 / 目录 | 来源 | 版本 | 许可证 |
| --- | --- | --- | --- |
| `tesseract.min.js`、`worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) | 5.1.1 | Apache-2.0 |
| `tesseract-core-simd-lstm.wasm.js`、`tesseract-core-lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 5.1.1 | Apache-2.0 |
| `lang/eng.traineddata.gz`、`lang/chi_sim.traineddata.gz` | [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) | 4.0.0 fast | Apache-2.0 |

许可证全文见同目录下的：

- `LICENSE-tesseract.js`
- `LICENSE-tesseract.js-core`
- `LICENSE-tessdata`

请保留本目录，不要只复制 `index.html`，否则拍照识别无法启动。项目本身不修改这些组件；识别在本机浏览器中完成，照片不会上传到任何服务器。
