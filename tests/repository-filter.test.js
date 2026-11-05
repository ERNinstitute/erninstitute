'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function control(value = '') {
  const listeners = {};
  return {
    value,
    hidden: false,
    addEventListener(type, fn) { listeners[type] = fn; },
    emit(type) { assert.ok(listeners[type], `Missing ${type} listener`); listeners[type](); },
    focus() { this.focused = true; }
  };
}

const search = control('');
const topic = control('all');
const metric = control('all');
const reset = control('');
const status = { textContent: '' };
const empty = { hidden: false };
const cards = [
  { textContent: 'Writing-to-learn interventions', dataset: { topic: 'education', metrics: 'hedges-g' }, hidden: false },
  { textContent: 'Brain images and scientific persuasiveness', dataset: { topic: 'neuroscience psychology', metrics: 'mean-difference' }, hidden: false },
  { textContent: 'BCG vaccination and tuberculosis', dataset: { topic: 'medicine', metrics: 'log-odds-ratio' }, hidden: false }
];
const controls = {
  'repository-search': search,
  'repository-topic': topic,
  'repository-metric': metric,
  'repository-reset': reset,
  'repository-filter-status': status,
  'repository-empty': empty
};
const document = {
  getElementById(id) { return controls[id]; },
  querySelectorAll() { return cards; }
};
const source = fs.readFileSync(path.join(__dirname, '..', 'repository-filter.js'), 'utf8');
vm.runInNewContext(source, { document });
assert.strictEqual(status.textContent, 'Showing 3 of 3 datasets');
assert.strictEqual(reset.hidden, true);

search.value = 'image';
search.emit('input');
assert.strictEqual(status.textContent, 'Showing 1 of 3 datasets');
assert.strictEqual(cards[1].hidden, false);
assert.strictEqual(cards[0].hidden, true);

topic.value = 'education';
topic.emit('change');
assert.strictEqual(status.textContent, 'Showing 0 of 3 datasets');
assert.strictEqual(empty.hidden, false);
assert.strictEqual(reset.hidden, false);

reset.emit('click');
assert.strictEqual(status.textContent, 'Showing 3 of 3 datasets');
assert.strictEqual(empty.hidden, true);
assert.strictEqual(search.focused, true);

metric.value = 'log-odds-ratio';
metric.emit('change');
assert.strictEqual(status.textContent, 'Showing 1 of 3 datasets');
assert.strictEqual(cards[2].hidden, false);
console.log('Repository filter interactions passed.');
