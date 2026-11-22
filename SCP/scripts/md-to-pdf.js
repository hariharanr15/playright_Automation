// Renders one of the generated Markdown reports (NON_PASSED_TEST_CASES.md, KNOWN_DEFECT_TEST_CASES.md, …) as an A4 PDF
// with the same Chromium print used by full-regression-pdf.js. Handles only the Markdown these scripts write:
// headings, paragraphs, pipe tables, numbered lists with indented continuation lines, **bold**, _italic_ and `code`.
//
// Usage (from SCP):  node scripts/md-to-pdf.js <file.md> [output.pdf] [--title="Footer title"] [--landscape]
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
if (!input) {
  console.error('Usage: node scripts/md-to-pdf.js <file.md> [output.pdf] [--title="Footer title"]');
  process.exit(1);
}
const output = args.filter(arg => !arg.startsWith('--'))[1] || input.replace(/\.md$/i, '.pdf');
const landscape = args.includes('--landscape'); // A4 landscape for wide registers
const footerTitle = ((args.find(arg => arg.startsWith('--title=')) || '').slice('--title='.length)) || path.basename(input, '.md').replace(/_/g, ' ');

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = text => escape(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])_([^_]+?)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
  .replace(/\b(SCP|BUGS)-(DEF-)?(\d+)/g, (match) => match.replace(/-/g, '‑')) // keep IDs on one line
  .replace(/ ¶ /g, '<br>'); // line break inside a table cell (test case registers)
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());

const lines = fs.readFileSync(input, 'utf8').split(/\r?\n/);
const body = [];
let paragraph = [];
let sectionOpen = false;
const flush = () => {
  if (!paragraph.length) return;
  const text = paragraph.join(' ');
  // A whole paragraph wrapped in _…_ (e.g. the "Generated …" line) is a note; its inner underscores are not markup.
  const note = text.match(/^_(.*)_$/);
  body.push(note ? `<p class="note">${inline(note[1].replace(/_/g, '\u0000')).replace(/\u0000/g, '_')}</p>` : `<p>${inline(text)}</p>`);
  paragraph = [];
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const heading = line.match(/^(#{1,4})\s+(.*)$/);
  if (heading) {
    flush();
    const level = heading[1].length;
    // Each level-3 block (one test case) is kept on one page where it fits.
    if (sectionOpen && level <= 3) { body.push('</section>'); sectionOpen = false; }
    if (level === 3) { body.push('<section class="case">'); sectionOpen = true; }
    body.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    continue;
  }
  if (/^\s*\|/.test(line)) {
    flush();
    const rows = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
    i--;
    const header = cells(rows[0]);
    const data = rows.slice(/^\s*\|[\s:|-]+\|\s*$/.test(rows[1] || '') ? 2 : 1).map(cells);
    const headerHtml = header.every(cell => !cell) ? '' : `<thead><tr>${header.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
    body.push(`<table>${headerHtml}<tbody>${data.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    continue;
  }
  if (/^\d+\.\s/.test(line)) {
    flush();
    const items = [];
    while (i < lines.length && (/^\d+\.\s/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
      if (/^\d+\.\s/.test(lines[i])) items.push([lines[i].replace(/^\d+\.\s+/, '').replace(/\s+$/, '')]);
      else items[items.length - 1].push(lines[i].trim());
      i++;
    }
    i--;
    body.push(`<ol>${items.map(parts => `<li>${parts.map(inline).join('<br>')}</li>`).join('')}</ol>`);
    continue;
  }
  if (/^\s*-\s/.test(line)) {
    flush();
    const items = [];
    while (i < lines.length && /^\s*-\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*-\s+/, ''));
    i--;
    body.push(`<ul>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
    continue;
  }
  if (!line.trim()) { flush(); continue; }
  paragraph.push(line.trim());
}
flush();
if (sectionOpen) body.push('</section>');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(footerTitle)}</title><style>
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 9.5pt; color: #1d2430; line-height: 1.4; }
  h1 { font-size: 17pt; color: #0f5e4f; border-bottom: 2px solid #0f5e4f; padding-bottom: 4px; margin: 0 0 8px; }
  h2 { font-size: 13pt; color: #0f5e4f; margin: 18px 0 6px; page-break-after: avoid; border-bottom: 1px solid #c9dcd6; padding-bottom: 2px; }
  h3 { font-size: 10.5pt; margin: 12px 0 4px; page-break-after: avoid; background: #eef5f3; padding: 4px 6px; border-left: 3px solid #0f5e4f; }
  section.case { page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; font-size: 8.5pt; }
  th, td { border: 1px solid #cfd6dd; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #f1f4f7; }
  td:first-child { white-space: nowrap; }
  ol { margin: 4px 0 8px 18px; padding: 0; } ol li { margin-bottom: 4px; }
  code { font-family: Consolas, monospace; font-size: 8.5pt; background: #f3f3f3; padding: 0 2px; }
  p { margin: 4px 0; } p.note { font-style: italic; color: #555; }
</style></head><body>${body.join('\n')}</body></html>`;

const htmlFile = output.replace(/\.pdf$/i, '.html');
fs.writeFileSync(htmlFile, html);
(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file:///${path.resolve(htmlFile).replace(/\\/g, '/')}`);
  await page.pdf({ path: output, format: 'A4', landscape, margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' }, printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#777">${escape(footerTitle)} · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>` });
  await browser.close();
  if (!process.env.KEEP_HTML) fs.unlinkSync(htmlFile);
  console.log(`A4 PDF: ${path.relative(process.cwd(), output)} (${(fs.statSync(output).size / 1024).toFixed(0)} KB)`);
})();
