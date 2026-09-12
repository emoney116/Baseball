import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const theme = readFileSync('app/theme.css', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');
const brandSections = { dark: globals.split('[data-theme="light"]')[0], light: globals.split('[data-theme="light"]')[1] };
const sections = { dark: theme.split('[data-theme="light"]')[0], light: theme.split('[data-theme="light"]')[1].split('html,')[0] };
const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
function luminance(color) {
  return color.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum,value,index) => sum + value * [.2126,.7152,.0722][index],0);
}
function contrast(a,b) {
  const values = [luminance(a),luminance(b)].sort((x,y) => y-x);
  return (values[0]+.05)/(values[1]+.05);
}
for (const [name, css] of Object.entries(sections)) {
  const token = key => rgb(css.match(new RegExp(`--${key}:\\s*(#[a-f0-9]{6})`, 'i'))[1]);
  test(`${name} text, muted text and brand ink pass normal-text contrast on menu surfaces`, () => {
    for (const foreground of ['text-primary','text-secondary','text-muted','brand-ink','success-ink']) {
      assert.ok(contrast(token(foreground),token('surface-overlay')) >= 4.5,`${name}: ${foreground}`);
    }
    const brand = rgb(brandSections[name].match(/--brand-primary:\s*(#[a-f0-9]{6})/i)[1]);
    const brandText = rgb(brandSections[name].match(/--brand-text-on-primary:\s*(#[a-f0-9]{6})/i)[1]);
    assert.ok(contrast(brandText,brand) >= 4.5,`${name}: filled selected control`);
    const selected = token('surface-overlay').map((value,index) => value*.84 + brand[index]*.16);
    assert.ok(contrast(token('text-primary'),selected) >= 4.5);
  });
}
