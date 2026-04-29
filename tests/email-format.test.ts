import { describe, expect, it } from 'vitest';
import { editableTextToHtml, htmlToEditableText } from '@/lib/email-format';

describe('email edit formatting', () => {
  it('converts paragraph html into editable plain text with blank lines between paragraphs', () => {
    expect(htmlToEditableText('<p>Hi Jamie,</p><p>When a customer issue becomes urgent.</p><p>Open to a quick look?</p>')).toBe('Hi Jamie,\n\nWhen a customer issue becomes urgent.\n\nOpen to a quick look?');
  });

  it('converts edited plain text back into safe paragraph html', () => {
    expect(editableTextToHtml('Hi Jamie,\n\nWhen a customer issue becomes urgent.\n\nOpen to a quick look?')).toBe('<p>Hi Jamie,</p><p>When a customer issue becomes urgent.</p><p>Open to a quick look?</p>');
  });

  it('preserves a single newline while editing so reviewers can keep typing on the next line', () => {
    const html = editableTextToHtml('Hi Jamie,\n');

    expect(html).toBe('<p>Hi Jamie,<br /></p>');
    expect(htmlToEditableText(html)).toBe('Hi Jamie,\n');
  });

  it('preserves single line breaks inside a paragraph', () => {
    const html = editableTextToHtml('Hi Jamie,\nQuick follow-up here.');

    expect(html).toBe('<p>Hi Jamie,<br />Quick follow-up here.</p>');
    expect(htmlToEditableText(html)).toBe('Hi Jamie,\nQuick follow-up here.');
  });

  it('escapes html typed into the plain text editor', () => {
    expect(editableTextToHtml('Hi <Jamie> & team')).toBe('<p>Hi &lt;Jamie&gt; &amp; team</p>');
  });
});
