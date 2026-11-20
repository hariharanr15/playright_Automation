"""Build the SCP Project Management test-scenario PDF from the functional-discovery Markdown files."""
import io
import os
import re
import sys
from collections import Counter

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph,
                                Preformatted, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

SRC = r'C:\Users\VC\20-04-2026\SCP\docs\functional-discovery'
OUT = os.path.join(SRC, 'SCP_PM_Test_Scenarios_v16.pdf')

FONTS = r'C:\Windows\Fonts'
pdfmetrics.registerFont(TTFont('Body', os.path.join(FONTS, 'segoeui.ttf')))
pdfmetrics.registerFont(TTFont('Body-Bold', os.path.join(FONTS, 'segoeuib.ttf')))
pdfmetrics.registerFont(TTFont('Sym', os.path.join(FONTS, 'seguisym.ttf')))
pdfmetrics.registerFont(TTFont('Mono', os.path.join(FONTS, 'consola.ttf')))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Body-Bold', italic='Body', boldItalic='Body-Bold')

INK = colors.HexColor('#1F2937')
ACCENT = colors.HexColor('#0F766E')
MUTED = colors.HexColor('#6B7280')
HEAD_BG = colors.HexColor('#E6F2F0')
GRID = colors.HexColor('#C9D3D1')
ZEBRA = colors.HexColor('#F7FAF9')
DEFERRED = colors.HexColor('#9CA3AF')

base = ParagraphStyle('base', fontName='Body', fontSize=9, leading=12.5, textColor=INK, alignment=TA_LEFT)
S = {
    'body': base,
    'small': ParagraphStyle('small', parent=base, fontSize=8, leading=10.5),
    'cell': ParagraphStyle('cell', parent=base, fontSize=7.4, leading=9.4),
    'cellh': ParagraphStyle('cellh', parent=base, fontName='Body-Bold', fontSize=7.4, leading=9.4),
    'celldef': ParagraphStyle('celldef', parent=base, fontSize=7.4, leading=9.4, textColor=DEFERRED),
    'h1': ParagraphStyle('h1', parent=base, fontName='Body-Bold', fontSize=17, leading=22, textColor=ACCENT, spaceBefore=4, spaceAfter=8),
    'h2': ParagraphStyle('h2', parent=base, fontName='Body-Bold', fontSize=12.5, leading=16, textColor=ACCENT, spaceBefore=10, spaceAfter=5),
    'h3': ParagraphStyle('h3', parent=base, fontName='Body-Bold', fontSize=10.5, leading=14, textColor=INK, spaceBefore=8, spaceAfter=4),
    'bullet': ParagraphStyle('bullet', parent=base, leftIndent=12, bulletIndent=3, spaceAfter=1.5),
    'bullet2': ParagraphStyle('bullet2', parent=base, leftIndent=24, bulletIndent=15, spaceAfter=1.5),
    'title': ParagraphStyle('title', parent=base, fontName='Body-Bold', fontSize=26, leading=32, textColor=ACCENT),
    'subtitle': ParagraphStyle('subtitle', parent=base, fontSize=13, leading=18, textColor=MUTED),
    'code': ParagraphStyle('code', parent=base, fontName='Mono', fontSize=7.6, leading=9.6, textColor=INK),
    'toc1': ParagraphStyle('toc1', parent=base, fontName='Body-Bold', fontSize=10, leading=15, leftIndent=0),
    'toc2': ParagraphStyle('toc2', parent=base, fontSize=8.8, leading=12.5, leftIndent=14),
}

SYMBOLS = '\u2208\u2713\u2610\u2705\u274C\u26A0\u2B1C\u22EE\u2717'


def read(name):
    return io.open(os.path.join(SRC, name), encoding='utf-8').read()


def inline(text):
    """Convert the Markdown inline subset used in the docs to ReportLab paragraph markup."""
    t = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    codes = []

    def keep_code(m):
        codes.append(m.group(1))
        return '\x00%d\x00' % (len(codes) - 1)

    t = re.sub(r'`([^`]+)`', keep_code, t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'~~([^~]+)~~', r'<strike>\1</strike>', t)
    t = re.sub(r'(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])', r'<i>\1</i>', t)
    t = re.sub('\x00(\\d+)\x00', lambda m: '<font name="Mono" color="#0B5C55">%s</font>' % codes[int(m.group(1))], t)
    t = re.sub('([%s])' % SYMBOLS, r'<font name="Sym">\1</font>', t)
    return t


def split_row(line):
    cells = line.strip().strip('|').split('|')
    return [c.strip() for c in cells]


def make_table(rows, avail):
    header, body = rows[0], rows[1:]
    ncol = len(header)
    pad = 8
    minw, weights = [], []
    for i in range(ncol):
        cells = [re.sub(r'[`*~]|\[([^\]]+)\]\([^)]+\)', r'\1', r[i]) if i < len(r) else '' for r in rows]
        words = [w for c in cells for w in c.split()] or ['']
        longest_word = max(pdfmetrics.stringWidth(w, 'Body-Bold', 7.4) for w in words)
        minw.append(min(longest_word + pad, avail * 0.3))
        weights.append(max(6, min(max(len(c) for c in cells), 90)) ** 0.85)
    total = sum(weights)
    widths = [avail * w / total for w in weights]
    # Raise columns below their minimum (longest word), taking the space from columns that have slack.
    for _ in range(5):
        short = [i for i in range(ncol) if widths[i] < minw[i]]
        if not short:
            break
        need = sum(minw[i] - widths[i] for i in short)
        for i in short:
            widths[i] = minw[i]
        slack = [i for i in range(ncol) if widths[i] > minw[i]]
        spare = sum(widths[i] - minw[i] for i in slack)
        if spare <= 0:
            break
        for i in slack:
            widths[i] -= need * (widths[i] - minw[i]) / spare
    scale = avail / sum(widths)
    widths = [w * scale for w in widths]
    data = [[Paragraph(inline(c), S['cellh']) for c in header]]
    deferred_rows = []
    for r_i, r in enumerate(body, start=1):
        r = (r + [''] * ncol)[:ncol]
        is_def = r[0].startswith('~~')
        if is_def:
            deferred_rows.append(r_i)
        data.append([Paragraph(inline(c), S['celldef'] if is_def else S['cell']) for c in r])
    tbl = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), HEAD_BG),
        ('GRID', (0, 0), (-1, -1), 0.4, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3.5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3.5),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]
    for i in range(2, len(data), 2):
        style.append(('BACKGROUND', (0, i), (-1, i), ZEBRA))
    tbl.setStyle(TableStyle(style))
    return tbl


def render(md, story, avail, skip_title=True, demote=0):
    """Render a Markdown string. demote shifts heading levels down (e.g. # -> ##)."""
    lines = md.split('\n')
    i = 0
    para = []

    def flush():
        if para:
            story.append(Paragraph(inline(' '.join(para)), S['body']))
            story.append(Spacer(1, 3))
            para.clear()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith('```'):
            flush()
            j = i + 1
            block = []
            while j < len(lines) and not lines[j].strip().startswith('```'):
                block.append(lines[j])
                j += 1
            story.append(Preformatted('\n'.join(block), S['code']))
            story.append(Spacer(1, 4))
            i = j + 1
            continue
        m = re.match(r'^(#{1,4})\s+(.*)$', stripped)
        if m:
            flush()
            level = len(m.group(1)) + demote
            if skip_title and len(m.group(1)) == 1:
                i += 1
                continue
            style = S['h1'] if level <= 1 else S['h2'] if level == 2 else S['h3']
            story.append(Paragraph(inline(m.group(2)), style))
            i += 1
            continue
        if stripped.startswith('|'):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                if not re.match(r'^\|\s*:?-{2,}', lines[i].strip()):
                    rows.append(split_row(lines[i]))
                i += 1
            story.append(make_table(rows, avail))
            story.append(Spacer(1, 6))
            continue
        bm = re.match(r'^(\s*)(?:[-*]|\d+\.)\s+(.*)$', line)
        if bm:
            flush()
            indent = len(bm.group(1))
            num = re.match(r'^\s*(\d+)\.', line)
            bullet = (num.group(1) + '.') if num else ('\u2022' if indent < 2 else '\u2013')
            story.append(Paragraph(inline(bm.group(2)), S['bullet2'] if indent >= 2 else S['bullet'], bulletText=bullet))
            i += 1
            continue
        if stripped == '---' or stripped == '':
            flush()
            i += 1
            continue
        para.append(stripped)
        i += 1
    flush()


def section(md, start_heading, stop_pattern=r'^## '):
    """Return the text from a heading line up to the next heading at the same level."""
    lines = md.split('\n')
    out, on = [], False
    for ln in lines:
        if ln.startswith(start_heading):
            on = True
            out.append(ln)
            continue
        if on and re.match(stop_pattern, ln):
            break
        if on:
            out.append(ln)
    return '\n'.join(out)


def scenario_rows(md, prefix_re):
    rows = []
    for ln in md.split('\n'):
        if re.match(r'^\| ' + prefix_re, ln):
            rows.append(split_row(ln))
    return rows


class Doc(BaseDocTemplate):
    def __init__(self, fn, **kw):
        super().__init__(fn, **kw)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate('p', frames=[frame], onPage=self.decorate)])

    def decorate(self, canv, doc):
        canv.saveState()
        w, h = doc.pagesize
        canv.setStrokeColor(GRID)
        canv.setLineWidth(0.5)
        canv.line(doc.leftMargin, h - 11 * mm, w - doc.rightMargin, h - 11 * mm)
        canv.setFont('Body', 7.5)
        canv.setFillColor(MUTED)
        canv.drawString(doc.leftMargin, h - 9.5 * mm, 'SCP – Project Management – Smoke & Regression Test Scenarios')
        canv.drawRightString(w - doc.rightMargin, h - 9.5 * mm, 'Draft for review – 30 Oct 2026')
        canv.drawString(doc.leftMargin, 8 * mm, 'Staging only. Evidence tags: O observed · D documented · A existing automation · I inferred · R rule confirmed by product owner')
        canv.drawRightString(w - doc.rightMargin, 8 * mm, 'Page %d' % doc.page)
        canv.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            st = flowable.style.name
            if st in ('h1', 'h2'):
                level = 0 if st == 'h1' else 1
                text = flowable.getPlainText()
                key = 'h%d' % id(flowable)
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
                self.notify('TOCEntry', (level, text, self.page, key))


