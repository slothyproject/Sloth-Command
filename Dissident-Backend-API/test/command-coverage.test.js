const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const botPath = path.join(__dirname, '..', 'bot.js');
const source = fs.readFileSync(botPath, 'utf8');

function extractAll(pattern) {
  return [...source.matchAll(pattern)].map((m) => m[1]);
}

test('every slash command is dispatched in handleSlashCommand', () => {
  const registered = new Set(
    extractAll(/new SlashCommandBuilder\(\)\s*\n\s*\.setName\('([^']+)'\)/g)
  );
  const dispatched = new Set(extractAll(/case '([^']+)':/g));

  const missingInSwitch = [...registered].filter((name) => !dispatched.has(name));
  assert.deepEqual(
    missingInSwitch,
    [],
    `Commands registered but not dispatched: ${missingInSwitch.join(', ')}`
  );
});

test('help menu includes beginner-oriented quick guidance and ticket guidance', () => {
  assert.match(source, /Quick Start \(Simple Guide\)/, 'Expected a beginner quick-start section');
  assert.match(source, /How To Use Tickets|Ticket Help/, 'Expected ticket guidance in help content');
  assert.match(source, /\/aiadvisor/, 'Expected AI advisor command to be documented in help');
  assert.match(source, /\/warn/, 'Expected moderation examples to be documented in help');
});
