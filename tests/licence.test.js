// Offline licences: what is accepted, what is refused and why, where a licence is kept, and how it
// decides whether Olaf is unlocked. The signer here follows the format in core.js (BW.licence).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { busywork } = require('./harness.js');

function keypair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  return { priv: privateKey, kid: 'k' + jwk.x.slice(0, 6), pub: { x: jwk.x, y: jwk.y } };
}
function sign(details, k) {
  const signed = 'BWL1.' + Buffer.from(JSON.stringify(Object.assign({ v: 1, kid: k.kid, product: 'olaf', id: 'olaf-1042', licensee: 'Bakkerij De Korst', issued: '2026-10-25' }, details))).toString('base64url');
  return signed + '.' + crypto.sign('sha256', Buffer.from(signed), { key: k.priv, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
const K = keypair();

async function shop({ required = true, keys = { [K.kid]: K.pub }, revoked = [], installed = 'full' } = {}) {
  const win = await busywork();
  win.BW.olafInstalled = async () => installed;
  win.BW.licenceConfig.olaf = { required, keys, revoked };
  return win.BW;
}

test('a licence signed with the shipped key is valid', async () => {
  const BW = await shop();
  const r = await BW.licence.verify(sign({}, K), 'olaf');
  assert.equal(r.ok, true);
  assert.equal(r.licence.licensee, 'Bakkerij De Korst');
  assert.equal(r.licence.id, 'olaf-1042');
});

test('the key is found in a licence file, and when an email wrapped it over lines', async () => {
  const BW = await shop();
  const key = sign({}, K);
  const file = `Your Olaf licence\n\nLicensed to: Bakkerij De Korst\n\nPaste this key:\n\n${key}\n\nKeep this file.`;
  assert.equal((await BW.licence.verify(file, 'olaf')).ok, true);
  const wrapped = key.match(/.{1,60}/g).join('\n');
  assert.equal((await BW.licence.verify(wrapped, 'olaf')).ok, true);
  assert.equal((await BW.licence.verify('  ' + key + '\n', 'olaf')).ok, true);
});

test('changed, foreign, withdrawn and broken licences are refused, each with its reason', async () => {
  const BW = await shop({ revoked: ['olaf-666'] });
  const good = sign({}, K);
  const [, body, sig] = good.split('.');
  const forged = 'BWL1.' + Buffer.from(JSON.stringify({ v: 1, kid: K.kid, product: 'olaf', id: 'olaf-1042', licensee: 'Someone Else' })).toString('base64url') + '.' + sig;
  const cases = {
    signature: [forged, sign({}, Object.assign({}, keypair(), { kid: K.kid })), good.slice(0, -4) + (good.endsWith('AAAA') ? 'BBBB' : 'AAAA')],
    key: [sign({}, keypair())],
    product: [sign({ product: 'other' }, K)],
    revoked: [sign({ id: 'olaf-666' }, K)],
    expired: [sign({ expires: '2020-01-01' }, K)],
    format: ['', 'XXXX-XXXX-XXXX', 'BWL1.' + body, 'BWL1.!!!.' + sig, 'BWL1.' + Buffer.from('{"v":2}').toString('base64url') + '.' + sig],
  };
  for (const [reason, keys] of Object.entries(cases)) {
    for (const k of keys) {
      const r = await BW.licence.verify(k, 'olaf');
      assert.equal(r.ok, false, `${reason}: ${k.slice(0, 30)}`);
      assert.equal(r.reason, reason, `${k.slice(0, 30)} refused as ${r.reason}, not ${reason}`);
      assert.ok(BW.licence.explain(r.reason).length > 10);
    }
  }
});

test('a licence for later is still valid until its date', async () => {
  const BW = await shop();
  assert.equal((await BW.licence.verify(sign({ expires: '2999-12-31' }, K), 'olaf')).ok, true);
});

test('Olaf is locked without a licence when licences are on, and unlocked by adding one', async () => {
  const BW = await shop();
  assert.equal(await BW.entitlements.edition('olaf'), 'locked');
  assert.equal(await BW.entitlements.has('olaf'), false);
  const bad = await BW.licence.add('BWL1.nope.nope', 'olaf');
  assert.equal(bad.ok, false);
  assert.equal((await BW.store.all('licences')).length, 0, 'an invalid key is not kept');
  const r = await BW.licence.add(sign({}, K), 'olaf');
  assert.equal(r.ok, true);
  assert.equal(await BW.entitlements.edition('olaf'), 'full');
  await BW.licence.add(sign({}, K), 'olaf');
  const kept = await BW.store.all('licences');
  assert.equal(kept.length, 1, 'adding the same licence twice keeps one');
  assert.equal(kept[0].licensee, 'Bakkerij De Korst');
});

test('the licence lives in the business, so a backup or another computer carries it', async () => {
  const BW = await shop();
  await BW.licence.add(sign({}, K), 'olaf');
  const snap = await BW.snapshot();
  const other = await shop();
  other.useDriver(other.drivers.memory({ licences: snap.licences }));
  assert.equal(await other.entitlements.edition('olaf'), 'full');
});

test('licences off (today), a demo, or no Olaf: nothing is asked', async () => {
  assert.equal(await (await shop({ required: false })).entitlements.edition('olaf'), 'full');
  assert.equal(await (await shop({ installed: 'demo' })).entitlements.edition('olaf'), 'demo');
  assert.equal(await (await shop({ installed: null })).entitlements.edition('olaf'), null);
});

test('a withdrawn licence stops working after an update, without deleting anything', async () => {
  const BW = await shop();
  await BW.licence.add(sign({}, K), 'olaf');
  BW.licenceConfig.olaf.revoked = ['olaf-1042'];
  assert.equal(await BW.entitlements.edition('olaf'), 'locked');
  assert.equal((await BW.store.all('licences')).length, 1);
});

test('a licence signed by a newer key works once the update ships that key', async () => {
  const K2 = keypair();
  const BW = await shop();
  const key = sign({}, K2);
  assert.equal((await BW.licence.verify(key, 'olaf')).reason, 'key');
  BW.licenceConfig.olaf.keys[K2.kid] = K2.pub;
  assert.equal((await BW.licence.verify(key, 'olaf')).ok, true);
});
