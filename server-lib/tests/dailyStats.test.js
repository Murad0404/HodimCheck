const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize, bounds, validDay, statsMessages } = require('../services/dailyStats');
const users = ['one','two','three','zero'].map(_id => ({ _id, fullName: _id, role: 'employee' }));
const event = (userId, time) => ({ userId, timestamp: `2026-09-09T${time}:00+05:00` });
test('one scan is present, two departed, three present; absent users remain counted', () => {
  const rows = [event('one','09:00'),event('two','09:00'),event('two','18:00'),event('three','09:00'),event('three','12:00'),event('three','13:00')];
  const s = summarize(users, rows, '2026-09-09');
  assert.equal(s.present,2); assert.equal(s.departed,1); assert.equal(s.absent,1); assert.equal(s.attended,3); assert.equal(s.rate,75);
  assert.equal(s.employees[1].status,'departed'); assert.equal(s.employees[2].count,3);
  const text = statsMessages({ name: 'Test' },s).join('');
  assert.match(text,/Hozir ishda: 2/); assert.match(text,/Ketganlar: 1/); assert.match(text,/two — Ketgan \(2 qayd\)/);
});
test('day changes at Tashkent midnight and excludes the following midnight', () => {
  const { start,end } = bounds('2026-09-09');
  assert.equal(start.toISOString(),'2026-09-08T19:00:00.000Z');
  const s = summarize(users,[{userId:'one',timestamp:start},{userId:'one',timestamp:end}], '2026-09-09');
  assert.equal(s.employees[0].count,1);
});
test('ignores admin and people created after the selected day; validates dates', () => {
  assert.equal(summarize([...users,{_id:'admin',role:'admin'},{_id:'later',createdAt:'2026-09-10T00:00:00+05:00'}],[], '2026-09-09').total,4);
  assert.equal(validDay('2026-02-30'),false); assert.equal(validDay('2026-09-09'),true);
});
test('same full name does not merge different employees; ignores stored event types', () => {
  const s = summarize([{_id:'a',fullName:'Ali'},{_id:'b',fullName:'Ali'}],[{...event('a','09:00'),type:'ketdi'},{...event('b','09:00'),type:'keldi'},{...event('b','18:00'),type:'keldi'}],'2026-09-09');
  assert.equal(s.present,1); assert.equal(s.departed,1);
});
