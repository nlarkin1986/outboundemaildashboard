import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

function allSkillText() {
  return [
    read('skills/account-sequencer/SKILL.md'),
    read('skills/account-sequencer/README.md'),
    read('skills/account-sequencer/references/mcp-bdr-handoff.md'),
    read('skills/account-sequencer/references/polling.md'),
  ].join('\n');
}

describe('account sequencer skill source', () => {
  it('keeps the skill source in a repo-local packageable structure', () => {
    expect(existsSync(resolve(root, 'skills/account-sequencer/SKILL.md'))).toBe(true);
    expect(existsSync(resolve(root, 'skills/account-sequencer/references/mcp-bdr-handoff.md'))).toBe(true);
    expect(existsSync(resolve(root, 'skills/account-sequencer/references/polling.md'))).toBe(true);
    expect(existsSync(resolve(root, 'scripts/package-account-sequencer-skill.mjs'))).toBe(true);
  });

  it('documents the two-question BDR intake branch and generic fallback', () => {
    const text = allSkillText();

    expect(text).toContain('bdr-vercel-pipeline-2026-05-01');
    expect(text).toContain('Do you want to run a fully custom sequence or the BDR outreach sequence play?');
    expect(text).toContain('Do you have a CSV, or are you pasting in account names?');
    expect(text).toContain('play_id": "bdr_cold_outbound"');
    expect(text).toMatch(/fully custom[\s\S]{0,240}omit `play_id`/i);
    expect(text).toMatch(/There is no custom `play_id` today/i);
  });

  it('keeps Cowork out of backend-owned sequence writing and research decisions', () => {
    const text = allSkillText();

    expect(text).toMatch(/Do not choose the BDR brand type, persona, sequence code/i);
    expect(text).toMatch(/Do not invent company domains, contact titles, contact emails/i);
    expect(text).toMatch(/dashboard is the source of truth/i);
    expect(text).not.toContain('ready to paste into Outreach');
    expect(text).not.toContain('{{first_name}} ---');
    expect(text).not.toContain('Keep the triple-hyphen');
    expect(text).not.toContain('Fill in the templates');
    expect(text).not.toContain('Step 5: Run the account research');
  });

  it('documents BDR and custom example payloads with the right play_id boundary', () => {
    const handoff = read('skills/account-sequencer/references/mcp-bdr-handoff.md');

    const bdrSection = handoff.slice(handoff.indexOf('## BDR create call'), handoff.indexOf('## Fully custom create call'));
    const customSection = handoff.slice(handoff.indexOf('## Fully custom create call'), handoff.indexOf('## Do not send'));

    expect(bdrSection).toContain('"play_id": "bdr_cold_outbound"');
    expect(bdrSection).toContain('"input_format": "csv"');
    expect(bdrSection).toContain('"input_format": "pasted_accounts"');
    expect(customSection).not.toContain('"play_id"');
    expect(customSection).toContain('"target_persona"');
  });

  it('keeps Cowork docs aligned with the skill intake wording', () => {
    const bdrDocs = read('docs/bdr-play-intake.md');
    const pollingDocs = read('docs/cowork-async-polling-instructions.md');

    for (const text of [bdrDocs, pollingDocs]) {
      expect(text).toContain('Do you want to run a fully custom sequence or the BDR outreach sequence play?');
      expect(text).toContain('Do you have a CSV, or are you pasting in account names?');
      expect(text).toContain('bdr_cold_outbound');
      expect(text).toMatch(/fully custom[\s\S]{0,220}do not set `play_id`/i);
    }
  });

  it('keeps the packaged skill artifact aligned with repo source', () => {
    const artifact = resolve(root, 'dist/account-sequencer.skill');
    expect(existsSync(artifact)).toBe(true);

    const packagedSkill = spawnSync('unzip', ['-p', artifact, 'account-sequencer/SKILL.md'], { encoding: 'utf8' });
    const packagedPolling = spawnSync('unzip', ['-p', artifact, 'account-sequencer/references/polling.md'], { encoding: 'utf8' });

    expect(packagedSkill.status).toBe(0);
    expect(packagedPolling.status).toBe(0);
    expect(packagedSkill.stdout).toBe(read('skills/account-sequencer/SKILL.md'));
    expect(packagedPolling.stdout).toBe(read('skills/account-sequencer/references/polling.md'));
    expect(packagedSkill.stdout).toContain('bdr-vercel-pipeline-2026-05-01');
    expect(packagedSkill.stdout).toContain('"play_id": "bdr_cold_outbound"');
    expect(packagedPolling.stdout).toContain('max_poll_attempts');
    expect(packagedPolling.stdout).toContain('diagnostics.deployment.contract_revision');
  });
});
