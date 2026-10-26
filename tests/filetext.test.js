// Reading text from files for the Library search (shared/filetext.js), on real files: a PDF printed by
// Chrome (compressed, fonts mapped to Unicode), a PDF made by macOS printing (Mac character set), and
// Word, OpenDocument, RTF, PowerPoint and Excel files (made by macOS textutil and by Python's zipfile).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { busywork } = require('./harness.js');

const fixture = (f) => new Blob([fs.readFileSync(path.join(__dirname, 'fixtures', f))]);
async function reader() { const { BW } = await busywork(['shared/filetext.js']); return BW.fileText; }
const STORY = ['Interview stories', 'STAR method: situation, task, action, result.', 'Led the Q3 campaign that grew sign-ups by 40%.', 'Café visits and naïve guesses are not data.'];

test('a PDF printed by Chrome: every line, accents and dashes, in order, both fonts', async () => {
  const text = await (await reader()).read('sample.pdf', fixture('sample.pdf'));
  for (const s of ['Pricing playbook', 'anchor the range', 'Café owners and naïve buyers', 'ROW_NUMBER give running totals – fast', 'Second font: negotiation starts with the range']) {
    assert.ok(text.includes(s), `found: ${s}`);
  }
  assert.ok(text.indexOf('Pricing playbook') < text.indexOf('Second font'), 'in reading order');
});

test('a PDF from macOS printing uses the Mac character set, and still reads right', async () => {
  const text = await (await reader()).read('sample-quartz.pdf', fixture('sample-quartz.pdf'));
  assert.equal(text, STORY.join('\n').replace('Interview stories\n', 'Interview stories\n\n'));
});

test('Word, OpenDocument and RTF give the same words, with their lines', async () => {
  const FT = await reader();
  for (const f of ['sample.docx', 'sample.odt', 'sample.rtf']) {
    const text = await FT.read(f, fixture(f));
    for (const line of STORY) assert.ok(text.includes(line), `${f}: ${line}`);
    assert.doesNotMatch(text, /Helvetica|\\|fonttbl/, `${f}: no formatting leftovers`);
  }
});

test('PowerPoint slides and Excel cells are searchable too', async () => {
  const FT = await reader();
  const slides = await FT.read('sample.pptx', fixture('sample.pptx'));
  assert.match(slides, /Quarterly review[\s\S]*Sign-ups grew 40% & churn fell[\s\S]*Hire a data analyst/);
  assert.match(await FT.read('sample.xlsx', fixture('sample.xlsx')), /SQL for data analysis/);
});

test('files it can’t read give no text instead of an error', async () => {
  const FT = await reader();
  assert.equal(await FT.read('not-really.pdf', new Blob(['hello'])), '');
  assert.equal(await FT.read('broken.docx', new Blob(['not a zip'])), '');
  assert.equal(await FT.read('photo.jpg', new Blob([new Uint8Array([255, 216, 255])])), '');
  assert.ok(FT.CAN.test('cv.PDF') && FT.CAN.test('notes.docx') && !FT.CAN.test('old.doc'));
});
