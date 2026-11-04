const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}

for (const [selector, size] of [
  ['.nav-dropdown > summary::before', '1.15rem'],
  ['.review-summary::before', '1.25rem'],
  ['.meta-advanced-settings > summary::before', '1rem'],
]) {
  const declarations = selector === '.meta-advanced-settings > summary::before'
    ? css.match(/\.method-details > summary::before,[\s\S]*?\.meta-advanced-settings > summary::before\s*\{([^}]+)\}/)?.[1]
    : rule(selector);
  assert.ok(declarations, `Missing icon declarations for ${selector}`);
  assert.ok(declarations.includes(`width: ${size};`), `${selector} width must be ${size}`);
  assert.ok(declarations.includes(`height: ${size};`), `${selector} height must be ${size}`);
  assert.ok(declarations.includes('clip-path: polygon('), `${selector} needs a legible filled triangle`);
}

for (const selector of [
  '.nav-dropdown[open] > summary::before',
  '.review-panel[open] > .review-summary::before',
  '.meta-advanced-settings[open] > summary::before',
]) {
  const declarations = selector === '.meta-advanced-settings[open] > summary::before'
    ? css.match(/\.method-details\[open\] > summary::before,[\s\S]*?\.meta-advanced-settings\[open\] > summary::before\s*\{([^}]+)\}/)?.[1]
    : rule(selector);
  assert.ok(declarations?.includes('transform: rotate(90deg);'), `${selector} must point down when open`);
}

const pages = [
  'index.html', 'about.html', 'research.html', 'consulting.html', 'contact.html',
  'metrics.html', 'repository.html', 'tools/index.html',
  'tools/meta-analysis-studio/index.html', 'tools/meta-analysis-studio/methods.html',
];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.ok(html.includes('styles.css?v=20261104b'), `${page} must load the new disclosure styles`);
}

console.log('Disclosure indicator and stylesheet-cache tests passed.');
