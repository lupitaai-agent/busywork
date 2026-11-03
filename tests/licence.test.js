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

// Lemon Squeezy's licence keys: checked online once (here a stand-in for Lemon Squeezy), then kept.
const LS_KEY = '38B1460A-5104-4067-A91D-77B872934D51';
function lemon(answers) {
  const calls = [];
  const fetch = async (url, opts) => {
    const what = url.split('/').pop(), body = Object.fromEntries(new URLSearchParams(String(opts.body)));
    calls.push({ what, body, url });
    const a = answers[what];
    if (a instanceof Error) throw a;
    return { json: async () => (typeof a === 'function' ? a(body) : a) };
  };
  return { fetch, calls };
}
const sold = (over = {}) => Object.assign({ activated: true, valid: true, error: null,
  license_key: { id: 77, status: 'active', key: LS_KEY }, instance: { id: 'inst-1' },
  meta: { store_id: 101, product_id: 303, customer_name: 'Lena de Boer', customer_email: 'lena@example.com' } }, over);
async function home(fake, ls = { store: '101', product: '303' }) {
  const win = await busywork([], { fetch: fake.fetch });
  win.BW.licenceConfig.juno = { required: true, keys: {}, revoked: [], ls };
  return win.BW;
}

test('a Lemon Squeezy key for this expert unlocks it, once, and is kept in the folder', async () => {
  const fake = lemon({ activate: sold() });
  const BW = await home(fake);
  const r = await BW.licence.add(`Your licence key: ${LS_KEY}\nThanks!`, 'juno');
  assert.equal(r.ok, true);
  assert.equal(r.licence.licensee, 'Lena de Boer');
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].url, 'https://api.lemonsqueezy.com/v1/licenses/activate');
  assert.equal(fake.calls[0].body.license_key, LS_KEY);
  const kept = await BW.store.all('licences');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].instance, 'inst-1');
  assert.equal((await BW.licence.current('juno')).licensee, 'Lena de Boer');
  assert.equal(fake.calls.length, 1, 'no second check within a month');
});

test('a Lemon Squeezy key for another product, store or a used-up key is refused with its reason', async () => {
  assert.equal((await (await home(lemon({ activate: sold({ meta: { store_id: 101, product_id: 999 } }) }))).licence.add(LS_KEY, 'juno')).reason, 'product');
  assert.equal((await (await home(lemon({ activate: sold({ meta: { store_id: 5, product_id: 303 } }) }))).licence.add(LS_KEY, 'juno')).reason, 'product');
  assert.equal((await (await home(lemon({ activate: { activated: false, error: 'This license key has reached the activation limit.' } }))).licence.add(LS_KEY, 'juno')).reason, 'limit');
  assert.equal((await (await home(lemon({ activate: { activated: false, error: 'license_key not found.' } }))).licence.add(LS_KEY, 'juno')).reason, 'signature');
  assert.equal((await (await home(lemon({ activate: new Error('offline') }))).licence.add(LS_KEY, 'juno')).reason, 'offline');
  const BW = await home(lemon({ activate: sold() }), null);  // a build without Lemon Squeezy: the key is not a licence here
  assert.equal((await BW.licence.add(LS_KEY, 'juno')).ok, false);
  assert.equal((await BW.store.all('licences')).length, 0);
});

test('a month on, the key is checked again: dropped when Lemon Squeezy says no, kept when offline', async () => {
  const fake = lemon({ activate: sold(), validate: sold({ valid: false, license_key: { id: 77, status: 'disabled' } }) });
  const BW = await home(fake);
  await BW.licence.add(LS_KEY, 'juno');
  const [rec] = await BW.store.all('licences');
  await BW.store.put('licences', Object.assign(rec, { checkedAt: '2026-01-01T00:00:00Z' }));
  assert.ok(await BW.licence.current('juno'), 'still unlocked while it asks');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(fake.calls[1].what, 'validate');
  assert.equal(fake.calls[1].body.instance_id, 'inst-1');
  assert.equal((await BW.store.all('licences')).length, 0, 'a refunded key is gone');

  const off = lemon({ activate: sold(), validate: new Error('offline') });
  const BW2 = await home(off);
  await BW2.licence.add(LS_KEY, 'juno');
  const [r2] = await BW2.store.all('licences');
  await BW2.store.put('licences', Object.assign(r2, { checkedAt: '2026-01-01T00:00:00Z' }));
  await BW2.licence.current('juno');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await BW2.store.all('licences')).length, 1, 'offline: it keeps working');
});
