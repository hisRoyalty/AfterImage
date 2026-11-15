// node tools/dev/contact.ts out.png scale bg file1 file2 ...  -> contact sheet of images (pixelated upscale)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const [out, scale, bg, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" onload="this.width=this.naturalWidth*${scale}"><figcaption>${f.split(/[\/]/).pop()}</figcaption></figure>`).join('');
await p.setContent(`<body style="margin:8px;background:${bg};font:10px monospace;color:#888;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">${imgs}<style>img{image-rendering:pixelated;display:block}figure{margin:0}</style></body>`);
await p.waitForTimeout(300);
await (await p.$('body'))!.screenshot({ path: out });
await b.close();
