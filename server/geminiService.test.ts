import test from 'node:test';
import assert from 'node:assert/strict';
import { runJsSandboxTest } from './geminiService';

test('runJsSandboxTest safely executes patched crypto timingSafeEqual code and blocks fs', () => {
  const originalCode = `
    function verifySignature(expectedSig, providedSig) {
      if (!expectedSig || !providedSig) return false;
      return expectedSig == providedSig;
    }
    module.exports = { verifySignature };
  `;

  const patchedCode = `
    const crypto = require('crypto');
    function verifySignature(expectedSig, providedSig) {
      if (!expectedSig || !providedSig) return false;
      if (typeof expectedSig !== 'string' || typeof providedSig !== 'string') return false;
      const a = Buffer.from(expectedSig, 'utf8');
      const b = Buffer.from(providedSig, 'utf8');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }
    module.exports = { verifySignature };
  `;

  const assertion = `
    const { verifySignature } = mod;
    const coerced = verifySignature('secret', ['secret']);
    const valid = verifySignature('secret', 'secret');
    return {
      passed: coerced === false && valid === true,
      detail: 'coerced=' + coerced + ', valid=' + valid
    };
  `;

  const before = runJsSandboxTest(originalCode, assertion);
  const after = runJsSandboxTest(patchedCode, assertion);

  assert.equal(before.executed, true);
  assert.equal(before.passed, false);
  assert.equal(after.executed, true);
  assert.equal(after.passed, true);

  // Verify dangerous modules like fs remain blocked in sandbox
  const blockedFs = runJsSandboxTest(`const fs = require('fs');`, `return { passed: true };`);
  assert.equal(blockedFs.passed, false);
  assert.match(blockedFs.output, /blocked in isolated sandbox/);
});
