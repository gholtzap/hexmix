import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDomainName, projectNameError } from './validation.ts';

test('project creation and rename use the same name rules', () => {
  assert.equal(projectNameError('new-project', ['existing']), null);
  assert.match(projectNameError('existing', ['existing'])!, /already exists/);
  for (const name of ['', '-project', 'project-', 'Uppercase', 'a'.repeat(65)]) {
    assert.ok(projectNameError(name, []), name);
  }
  assert.equal(projectNameError('a'.repeat(64), []), null);
});

test('domain validation rejects invalid labels and lengths', () => {
  for (const domain of ['app.example.com', 'EXAMPLE.COM', 'a-b.example.com']) assert.equal(isDomainName(domain), true, domain);
  for (const domain of ['-bad..com', 'bad..com', '-bad.com', 'bad-.com', 'localhost', 'https://example.com', 'a'.repeat(64) + '.com', ('a'.repeat(63) + '.').repeat(4) + 'com']) {
    assert.equal(isDomainName(domain), false, domain);
  }
});
