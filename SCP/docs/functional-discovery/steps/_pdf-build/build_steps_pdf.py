"""Build the SCP test-scenario step-by-step PDF (A4 portrait) from docs/functional-discovery/steps/*.md."""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pdf_helpers import *  # noqa: F401,F403  (styles, inline/make_table/render/section, Doc)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle

SRC = r'C:\Users\VC\20-04-2026\SCP\docs\functional-discovery'
STEPS = os.path.join(SRC, 'steps')
OUT = os.path.join(SRC, 'SCP_Test_Scenarios_Steps_v1.pdf')
DATE = '6 November 2026'

# (chapter title, steps doc, spec, npm command)
SUITES = [
    ('Project Management – Smoke', 'PM_SMOKE_STEPS.md', 'pm-smoke.spec.js', 'npm run pm:smoke'),
    ('Project Management – Regression, part 1', 'PM_REGRESSION_PART1_STEPS.md', 'pm-regression.spec.js', 'npm run pm:regression'),
    ('Project Management – Regression, part 2', 'PM_REGRESSION_PART2_STEPS.md', 'pm-regression-part2.spec.js', 'npm run pm:regression2'),
    ('Procurement Log – Smoke', 'PL_SMOKE_STEPS.md', 'pl-smoke.spec.js', 'npm run procurement:smoke'),
    ('Procurement Log – Regression, part 1', 'PL_REGRESSION_PART1_STEPS.md', 'pl-regression.spec.js', 'npm run procurement:regression'),
    ('Procurement Log – Regression, part 2', 'PL_REGRESSION_PART2_STEPS.md', 'pl-regression-2.spec.js', 'npm run procurement:regression2'),
    ('Procurement Log – Regression, part 3', 'PL_REGRESSION_PART3_STEPS.md', 'pl-regression-3.spec.js', 'npm run procurement:regression3'),
    ('All Other Modules – Smoke', 'MODULES_SMOKE_STEPS.md', 'app-smoke.spec.js', 'npm run modules:smoke'),
    ('All Other Modules – Regression', 'MODULES_REGRESSION_STEPS.md', 'app-regression.spec.js', 'npm run modules:regression'),
    ('Inventory Management – Regression', 'INV_REGRESSION_STEPS.md', 'inv-regression.spec.js', 'npm run inventory:regression'),
]


class StepsDoc(Doc):
    def decorate(self, canv, doc):
        canv.saveState()
        w, h = doc.pagesize
        canv.setStrokeColor(GRID)
        canv.setLineWidth(0.5)
        canv.line(doc.leftMargin, h - 11 * mm, w - doc.rightMargin, h - 11 * mm)
        canv.setFont('Body', 7.5)
        canv.setFillColor(MUTED)
        canv.drawString(doc.leftMargin, h - 9.5 * mm, 'SCP – Test Scenarios & Step-by-Step Flows')
        canv.drawRightString(w - doc.rightMargin, h - 9.5 * mm, DATE)
        canv.drawString(doc.leftMargin, 8 * mm, 'SCP Staging · project NRVC_Hall · Project Admin')
        canv.drawRightString(w - doc.rightMargin, 8 * mm, 'Page %d' % doc.page)
        canv.restoreState()

    def afterFlowable(self, flowable):
        super().afterFlowable(flowable)
        # Each scenario (h3) gets a PDF bookmark for navigation; only chapters and sections go in the printed contents.
        if not isinstance(flowable, Paragraph):
            return
        name = flowable.style.name
        if name in ('h1', 'h2'):
            self._last = 0 if name == 'h1' else 1
        elif name == 'h3':
            key = 'h%d' % id(flowable)
            self.canv.bookmarkPage(key)
            # Chapters without section headings put scenarios directly under the chapter.
            self.canv.addOutlineEntry(flowable.getPlainText(), key, level=getattr(self, '_last', 0) + 1, closed=True)


def read(path):
    return io.open(path, encoding='utf-8').read()


def main():
    doc = StepsDoc(OUT, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=15 * mm, bottomMargin=14 * mm,
                   title='SCP – Test Scenarios & Step-by-Step Flows', author='NeuralRays QA',
                   subject='Smoke and regression scenarios with the automated steps')
    avail = doc.width
    story = []

    story.append(Spacer(1, 40 * mm))
    story.append(Paragraph('SCP – Supply Chain Planner', S['title']))
    story.append(Spacer(1, 4))
    story.append(Paragraph('Test Scenarios &amp; Step-by-Step Flows', S['title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('Every smoke and regression scenario with its numbered steps (Action → Expected). '
                           'The steps match the automated Playwright steps one-to-one, so the HTML run report and this document read the same.', S['subtitle']))
    story.append(Spacer(1, 14))
    cover = [
        ['Item', 'Detail'],
        ['Environment', 'Staging only – stg-login.voyagecontrol.com → stg-supplychain-app.voyagecontrol.com'],
        ['Project / role', 'NRVC_Hall, signed in as Project Admin'],
        ['Date', DATE],
        ['Automated scenarios', '575 in total – 78 smoke and 497 regression (status as of 3 Nov 2026)'],
        ['Modules', 'Project Management, Procurement Log, Inventory, User Management, Supplier List, First Delivery Inspections, '
                    'Document Management, Shipments, Management Dashboard, Enterprise, Analytics'],
        ['Automation', 'Playwright specs in SCP/tests/pm-flow; HTML report per run in SCP/reports/pm-flow'],
    ]
    story.append(make_table(cover, avail))
    story.append(PageBreak())

    story.append(Paragraph('Contents', ParagraphStyle('contents', parent=S['h1'])))  # not listed in its own contents
    toc = TableOfContents()
    toc.levelStyles = [S['toc1'], S['toc2']]
    story.append(toc)
    story.append(PageBreak())

    story.append(Paragraph('1. How to use this document', S['h1']))
    for t in [
        'Each chapter covers one automated suite. It starts with the suite header (spec file, command, run tag and the common sign-in), '
        'followed by every scenario in the order the suite runs it.',
        'Each scenario has a table of numbered steps. <b>Action</b> is what is done in the app (menu path › button, fields and values); '
        '<b>Expected</b> is what must be seen. The same text appears as the step name in the HTML run report and the on-screen banner.',
        '<b>Precondition</b> lines name an earlier scenario or data the scenario depends on. <b>Note</b> lines carry known-defect or observation ids '
        '(SCP-DEF-…, OBS-…). Scenarios marked <b>Not automated</b> give the reason (outside system, needs approval, covered elsewhere).',
        'Run tags (e.g. APR…, INR…, PMR2-…) make every record a run creates unique, so runs never collide and run data is easy to find.',
    ]:
        story.append(Paragraph(t, S['bullet'], bulletText='\u2022'))
    story.append(Spacer(1, 8))
    story.append(Paragraph('Suites in this document', S['h2']))
    rows = [['#', 'Suite', 'Spec file', 'Command']]
    for n, (title, _, spec, cmd) in enumerate(SUITES, start=2):
        rows.append([str(n), title, '`%s`' % spec, '`%s`' % cmd])
    story.append(make_table(rows, avail))
    story.append(Spacer(1, 6))
    story.append(Paragraph('Common sign-in (setup step of every suite): open the Voyage Control SSO login page → sign in as the Project Admin → '
                           'platform chooser › "Supply Chain Planner" → choose project "NRVC_Hall" and the site in the header.', S['body']))
    story.append(PageBreak())

    for n, (title, fname, _, _) in enumerate(SUITES, start=2):
        story.append(Paragraph('%d. %s' % (n, title), S['h1']))
        render(read(os.path.join(STEPS, fname)), story, avail, skip_title=True)
        story.append(PageBreak())

    progress = read(os.path.join(SRC, 'AUTOMATION_PROGRESS_2026-11-03.md'))
    story.append(Paragraph('Appendix A. Latest results and coverage (3 Nov 2026)', S['h1']))
    render(section(progress, '## 2. Coverage'), story, avail, skip_title=True)
    story.append(PageBreak())
    story.append(Paragraph('Appendix B. Open deviations found by the automation', S['h1']))
    render(section(progress, '## 3. Open deviations'), story, avail, skip_title=True)

    doc.multiBuild(story)
    print('written', OUT)


if __name__ == '__main__':
    main()
