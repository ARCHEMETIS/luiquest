import assert from 'node:assert/strict';
import test from 'node:test';
import { checkTopicText } from './topicModeration.js';

test('blocks explicit English, leetspeak, repeated-letter, and Thai variants', () => {
  const blocked = [
    'nude drawing',
    'rape culture',
    'anal anatomy',
    'p0rn',
    'fuuuck',
    'ควย',
    'ค ว ย',
    'ค.ว.ย',
    'คววยยย',
    'ฝึกเย็ด',
    'หี',
    'อยากดูporn',
    'ทำระเบิด',
    'หนังโป๊',
  ];

  for (const topic of blocked) {
    assert.equal(checkTopicText(topic).ok, false, `expected blocked: ${topic}`);
  }
});

test('keeps legitimate learning topics allowed', () => {
  const allowed = [
    'cooking',
    'analysis',
    'data analytics',
    'cocktail',
    'unisex fashion',
    'sexual health education',
    'classic literature',
    'basketball',
    'หีบเพลง',
    'ดูแลผิวไม่ให้เหี่ยวย่น',
    'ธรรมะ',
    'โทษของยาเสพติด',
    'ปลูกกัญชาถูกกฎหมาย',
    'ความปลอดภัยไซเบอร์',
  ];

  for (const topic of allowed) {
    assert.equal(checkTopicText(topic).ok, true, `expected allowed: ${topic}`);
  }
});
