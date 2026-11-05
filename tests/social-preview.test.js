'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = [
  { page: 'tools/meta-analysis-studio/index.html', url: 'https://erninstitute.com/tools/meta-analysis-studio/', image: 'meta-analysis-studio-preview.png' },
  { page: 'repository.html', url: 'https://erninstitute.com/repository.html', image: 'ern-open-data-preview.png' }
];

for (const { page, url, image } of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const imageUrl = `https://erninstitute.com/images/${image}`;
  for (const item of [
    `content="${url}"`,
    `<meta property="og:image" content="${imageUrl}"/>`,
    `<meta name="twitter:image" content="${imageUrl}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`
  ]) assert.ok(html.includes(item), `${page} missing ${item}`);

  const png = fs.readFileSync(path.join(root, 'images', image));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200, `${image} width`);
  assert.equal(png.readUInt32BE(20), 630, `${image} height`);
}

console.log('Social preview tests passed for Studio and repository (1200 x 630 images).');
