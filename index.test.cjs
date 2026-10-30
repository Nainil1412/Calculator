const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function calculator() {
  const html = fs.readFileSync(path.join(__dirname, 'index1.html'), 'utf8');
  const elements = [...html.matchAll(/<(button|div) class="([^"]+)">([^<]*)<\/\1>/g)].map(([, tag, className, text]) => ({
    className, innerText: text, listeners: {},
    addEventListener(event, fn) { this.listeners[event] = fn; },
    click() { this.listeners.click?.({ target: this }); }
  }));
  const handlers = {};
  const context = {
    document: {
      querySelector: selector => elements.find(el => el.className === selector.slice(1)),
      querySelectorAll: selector => elements.filter(el => el.className === selector.slice(1))
    },
    window: { addEventListener: (event, fn) => { handlers[event] = fn; } }
  };
  const source = fs.readFileSync(path.join(__dirname, process.env.CALCULATOR_SOURCE || 'index.js'), 'utf8');
  vm.runInNewContext(source, context);
  return {
    key(key) { handlers.keydown({ key }); },
    type(value) { for (const key of value) handlers.keydown({ key }); },
    click(label) { elements.find(el => el.innerText === label).click(); },
    output() { return String(elements.find(el => el.className === 'underoutput').innerText); }
  };
}

test('keyboard initializes without a Delete button and accepts numbers', () => {
  const app = calculator();
  app.type('123');
  assert.equal(app.output(), '123');
});
for (const [input, expected] of [['12+3=', '15'], ['9-4=', '5'], ['6*7=', '42'], ['8/2=', '4'], ['8%3=', '2']]) {
  test('keyboard arithmetic: ' + input, () => {
    const app = calculator();
    app.type(input);
    assert.equal(app.output(), expected);
  });
}
test('mouse arithmetic remains functional', () => {
  const app = calculator();
  for (const label of ['2', '+', '3', '=']) app.click(label);
  assert.equal(app.output(), '5');
});
test('Enter evaluates and Backspace removes one digit', () => {
  const app = calculator();
  app.type('12');
  app.key('Backspace');
  app.type('+3');
  app.key('Enter');
  assert.equal(app.output(), '4');
});
test('Backspace on empty input is harmless', () => {
  const app = calculator();
  app.key('Backspace');
  assert.equal(app.output(), '');
});
test('deleting a decimal allows a replacement decimal', () => {
  const app = calculator();
  app.type('1.');
  app.key('Backspace');
  app.type('.5');
  assert.equal(app.output(), '1.5');
});
test('deleting a digit retains the single decimal restriction', () => {
  const app = calculator();
  app.type('1.2');
  app.key('Backspace');
  app.type('.3');
  assert.equal(app.output(), '1.3');
});
for (const method of ['Delete', 'clear']) {
  test(method + ' resets decimal state for the next calculation', () => {
    const app = calculator();
    app.type('1.2');
    if (method === 'clear') app.click('clear'); else app.key('Delete');
    assert.equal(app.output(), '');
    app.type('3.5+1=');
    assert.equal(app.output(), '4.5');
  });
}
test('result can be edited with Backspace', () => {
  const app = calculator();
  app.type('12+3=');
  app.key('Backspace');
  app.type('2');
  assert.equal(app.output(), '12');
});
