export function htmlToEditableText(html: string) {
  const blocks = extractHtmlBlocks(html);

  if (blocks.length > 0) {
    return blocks.map(htmlBlockToEditableText).join('\n\n');
  }

  return htmlBlockToEditableText(html).replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

export function editableTextToHtml(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').replace(/^[ \t]+|[ \t]+$/g, ''))
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${paragraph.split('\n').map(escapeHtml).join('<br />')}</p>`)
    .join('');
}

export function emailParagraphs(html: string) {
  const text = htmlToEditableText(html);
  return text ? text.split(/\n{2,}/) : [];
}

export function stripEmailHtml(html: string) {
  return emailParagraphs(html).map((paragraph) => paragraph.replace(/\n+/g, ' ').trim()).join(' ');
}

function extractHtmlBlocks(html: string) {
  return html.match(/<\s*(?:p|div)(?:\s[^>]*)?>[\s\S]*?<\s*\/\s*(?:p|div)\s*>/gi) ?? [];
}

function htmlBlockToEditableText(html: string) {
  const withBreaks = html
    .replace(/<\s*(?:p|div)(?:\s[^>]*)?>/gi, '')
    .replace(/<\s*\/\s*(?:p|div)\s*>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n');

  return decodeBasicEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '\"')
    .replace(/&#39;/gi, "'");
}
