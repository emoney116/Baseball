import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const globals = readFileSync('app/globals.css', 'utf8');
const css = postcss.parse(globals);
const declarations = (selector, property) => {
  const values = [];
  css.walkRules(rule => {
    if (rule.selector.split(',').map(value => value.trim()).includes(selector)) {
      for (const node of rule.nodes) {
        if (node.type === 'decl' && node.prop === property) values.push(node.value);
      }
    }
  });
  return values;
};

test('both themes use the NINE wordmark maroon, not the previous pink palette', () => {
  for (const selector of [':root', '[data-theme="light"]']) {
    assert.equal(declarations(selector, '--brand-primary').at(-1), '#760e1e');
    assert.equal(declarations(selector, '--brand-hover').at(-1), '#8a1527');
    assert.equal(declarations(selector, '--brand-active').at(-1), '#5f0b18');
  }
  assert.doesNotMatch(globals, /#(?:c22f62|d43b70|f05286|b92b59|c93669|d94175)\b/i);
});

test('shared primary controls remain flat in default, hover, focus and active states', () => {
  for (const selector of ['.primary-button', '.auth-form .primary-button.stretch-button']) {
    assert.equal(declarations(selector, 'background').at(-1), 'var(--brand-primary)');
    assert.ok(declarations(selector, 'box-shadow').every(value => value === 'none'));
    assert.equal(declarations(`${selector}:hover`, 'background').at(-1), 'var(--brand-hover)');
    assert.equal(declarations(`${selector}:focus-visible`, 'background').at(-1), 'var(--brand-hover)');
    assert.equal(declarations(`${selector}:active`, 'background').at(-1), 'var(--brand-active)');
  }
  assert.equal(declarations('.primary-button:focus-visible', 'outline').at(-1), '2px solid var(--focus)');
});

test('navigation and floating Ask controls have no colored glow', () => {
  for (const selector of ['.auth-tabs button.active', '.team-creator-segment button.active', '.game-workspace-tabs button.active', '.ask-clubhouse-fab', '.ask-clubhouse-fab:hover']) {
    assert.ok(declarations(selector, 'box-shadow').length > 0);
    assert.ok(declarations(selector, 'box-shadow').every(value => value === 'none'), selector);
  }
});

test('functional heatmaps and quantitative rings retain their data-driven gradients', () => {
  assert.match(declarations('.heatmap > span', 'background').at(-1), /radial-gradient.*--point-color/);
  assert.match(declarations('.attendance-ring', 'background').at(-1), /conic-gradient.*--value/);
  assert.match(declarations('.weight-room-week-summary__score i', 'background').at(-1), /conic-gradient.*--score/s);
});
