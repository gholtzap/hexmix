import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDemo } from '../../src/previews/orvian/lib/demo-validation.ts';

test('demo validation matches required fields and company restrictions', () => {
  const valid = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org', companySize: '10–50' };
  assert.deepEqual(validateDemo(valid), {});
  assert.deepEqual(validateDemo({firstName:' ',lastName:'',email:'',companySize:''}), {
    firstName: 'Please enter your first name.', lastName: 'Please enter your last name.',
    email: 'Please enter your company email.', companySize: 'Please select your company size.'
  });
  assert.equal(validateDemo({...valid,email:'not-an-email'}).email, 'Please enter a valid email address.');
  assert.equal(validateDemo({...valid,email:' Ada@GMAIL.COM '}).email, 'Please use your company email.');
  assert.ok(validateDemo({...valid,companySize:'<10'}).companySize);
  assert.ok(validateDemo({...valid,companySize:'unknown'}).companySize);
});
