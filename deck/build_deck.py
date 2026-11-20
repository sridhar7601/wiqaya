"""Fill the official Future Health submission template for Team Zord / Wiqaya.

Adds content into each slide's empty area; never moves or restyles the template's own shapes.
Usage: python build_deck.py <template.pptx> <out.pptx> <assets dir>
"""
import sys
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

TEMPLATE, OUT, ASSETS = sys.argv[1], sys.argv[2], Path(sys.argv[3])

# ---------------------------------------------------------------- team data (edit and re-run)
URL = 'https://wiqaya-health.vercel.app'
TEAM = [
    # name, country, role, organisation, age confirmation
    ('Sridhar S K', 'India', 'Team lead, architecture & engineering', 'Presidio Cloud Solutions, Coimbatore', 'Yes, 18+'),
    ('Sruthi K', 'India', 'Full-stack engineering', 'Saama Technologies, Coimbatore', 'Yes, 18+'),
]
CAPABILITY = (
    'Team Zord: two full-stack engineers from Coimbatore, India, each with 3+ years of industry experience.\n'
    'Sridhar S K (lead), Presidio Cloud Solutions: .NET, Java, React, JavaScript, AWS, AI and cloud deployment. '
    'Led the architecture, the explainable rules engine, the safety benchmarks and the guarded AI layer.\n'
    'Sruthi K, Saama Technologies: MERN stack (MongoDB, Express, React, Node.js), full-stack engineering and AI.\n'
    'During the challenge we built Wiqaya end to end: a bilingual, mobile-first check and companion for women and men, '
    '51 cited rules, cycles and results charted over time, an encrypted HL7 FHIR R4 summary with consent, '
    'a clinician review step, and an evaluation harness '
    '(89 synthetic cases and 162 unit tests on every build, plus live AI tests on Gemini).'
)

# ---------------------------------------------------------------- style
FONT = 'Outfit'
INK = RGBColor(0x1F, 0x24, 0x2B)
BODY = RGBColor(0x3A, 0x40, 0x48)
MUTED = RGBColor(0x5F, 0x67, 0x72)
BRAND = RGBColor(0x0E, 0x4C, 0x46)
BRAND_SOFT = RGBColor(0xEA, 0xF4, 0xF2)
BRAND_LINE = RGBColor(0xB9, 0xD9, 0xD3)
SAND = RGBColor(0xF4, 0xF0, 0xE9)
SAND_LINE = RGBColor(0xDE, 0xD5, 0xC8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
RED = RGBColor(0xB4, 0x23, 0x18)

X0, W0 = 0.42, 9.16  # content column
TOP = 1.5  # below the template's two-line slide title
BOTTOM = 5.36


def _run(p, text, size, bold=False, color=BODY, italic=False, font=FONT):
    r = p.add_run()
    r.text = text
    f = r.font
    if font:
        f.name = font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    return r


def _bullet(p, level=0):
    pPr = p._p.get_or_add_pPr()
    indent = Inches(0.16)
    pPr.set('marL', str(int(indent * (level + 1))))
    pPr.set('indent', str(-int(indent)))
    for tag in ('a:buNone', 'a:buChar', 'a:buAutoNum', 'a:buFont'):
        for el in pPr.findall(qn(tag)):
            pPr.remove(el)
    buFont = etree.SubElement(pPr, qn('a:buFont'))
    buFont.set('typeface', 'Arial')
    buChar = etree.SubElement(pPr, qn('a:buChar'))
    buChar.set('char', '•')


def text(slide, x, y, w, h, paras, size=11, anchor=MSO_ANCHOR.TOP, name=None):
    """paras: list of str | dict(runs=[(text, {bold,color,size,italic})], bullet, space, align)."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        box.name = name
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if isinstance(para, str):
            para = {'runs': [(para, {})]}
        for t, o in para['runs']:
            _run(p, t, o.get('size', size), o.get('bold', False), o.get('color', BODY), o.get('italic', False))
        if para.get('bullet'):
            _bullet(p, para.get('level', 0))
        p.space_after = Pt(para.get('space', 4))
        if para.get('align') == 'center':
            p.alignment = PP_ALIGN.CENTER
    return box


def heading(slide, x, y, w, label, size=12.5, color=BRAND):
    return text(slide, x, y, w, 0.28, [{'runs': [(label, {'bold': True, 'color': color, 'size': size})]}])


def _cell_border(cell, side, color, width_pt=0.75):
    tcPr = cell._tc.get_or_add_tcPr()
    tag = {'L': 'a:lnL', 'R': 'a:lnR', 'T': 'a:lnT', 'B': 'a:lnB'}[side]
    for el in tcPr.findall(qn(tag)):
        tcPr.remove(el)
    ln = etree.SubElement(tcPr, qn(tag))
    ln.set('w', str(int(Pt(width_pt))))
    ln.set('cmpd', 'sng')
    if color is None:
        etree.SubElement(ln, qn('a:noFill'))
    else:
        sf = etree.SubElement(ln, qn('a:solidFill'))
        c = etree.SubElement(sf, qn('a:srgbClr'))
        c.set('val', str(color))
    # schema order inside tcPr: lnL, lnR, lnT, lnB ... then fill
    order = [qn('a:lnL'), qn('a:lnR'), qn('a:lnT'), qn('a:lnB')]
    lines = [e for e in tcPr if e.tag in order]
    for e in lines:
        tcPr.remove(e)
    for tagq in order:
        for e in lines:
            if e.tag == tagq:
                tcPr.insert(order.index(tagq), e)


def _fmt_cell(cell, value, size, bold=False, color=BODY, fill=WHITE):
    cell.fill.solid()
    cell.fill.fore_color.rgb = fill
    cell.margin_left = cell.margin_right = Inches(0.07)
    cell.margin_top = Inches(0.035)
    cell.margin_bottom = Inches(0.035)
    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf = cell.text_frame
    tf.word_wrap = True
    lines = value if isinstance(value, list) else [value]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        for r in list(p.runs):
            r._r.getparent().remove(r._r)
        if isinstance(line, tuple):
            for t, o in line:
                _run(p, t, o.get('size', size), o.get('bold', bold), o.get('color', color))
        else:
            _run(p, line, size, bold, color)


def table(slide, x, y, widths, header, rows, size=9.5, head_size=9.5, row_h=0.3, name=None):
    shape = slide.shapes.add_table(len(rows) + 1, len(widths), Inches(x), Inches(y), Inches(sum(widths)), Inches(row_h * (len(rows) + 1)))
    if name:
        shape.name = name
    t = shape.table
    t.first_row = True
    t.horz_banding = False
    for i, w in enumerate(widths):
        t.columns[i].width = Inches(w)
    for r in range(len(rows) + 1):
        t.rows[r].height = Inches(row_h)
    for c, h in enumerate(header):
        cell = t.cell(0, c)
        _fmt_cell(cell, h, head_size, bold=True, color=INK, fill=SAND)
    for r, row in enumerate(rows, start=1):
        for c, v in enumerate(row):
            cell = t.cell(r, c)
            _fmt_cell(cell, v, size, bold=(c == 0), color=INK if c == 0 else BODY, fill=WHITE)
    for r in range(len(rows) + 1):
        for c in range(len(widths)):
            cell = t.cell(r, c)
            for side in ('L', 'R', 'T'):
                _cell_border(cell, side, None)
            _cell_border(cell, 'B', SAND_LINE, 0.75)
    return shape


def card(slide, x, y, w, h, fill=BRAND_SOFT, line=BRAND_LINE, name=None):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.adjustments[0] = 0.06
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.color.rgb = line
    s.line.width = Pt(0.75)
    s.shadow.inherit = False
    if name:
        s.name = name
    s.text_frame.text = ''
    return s


def picture(slide, path, x, y, w=None, h=None, border=True, name=None):
    kw = {}
    if w:
        kw['width'] = Inches(w)
    if h:
        kw['height'] = Inches(h)
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), **kw)
    if border:
        pic.line.color.rgb = SAND_LINE
        pic.line.width = Pt(0.75)
    if name:
        pic.name = name
    return pic


def stat(slide, x, y, w, value, label, value_color=BRAND):
    card(slide, x, y, w, 0.82, fill=WHITE, line=SAND_LINE)
    text(slide, x + 0.12, y + 0.08, w - 0.24, 0.4, [{'runs': [(value, {'bold': True, 'size': 19, 'color': value_color})]}])
    text(slide, x + 0.12, y + 0.48, w - 0.24, 0.3, [{'runs': [(label, {'size': 9, 'color': MUTED})]}])


def B(t):
    return (t, {'bold': True, 'color': INK})


def N(t):
    return (t, {})


prs = Presentation(TEMPLATE)
S = list(prs.slides)

# ---------------------------------------------------------------- 1. Title
box = next(sh for sh in S[0].shapes if sh.has_text_frame and 'Team Name' in sh.text_frame.text)
values = {'Team Name:': 'Zord', 'Team Size:': '2', 'Problem Statement:': '[Fertility] Reproductive Potential'}
for p in box.text_frame.paragraphs:
    label = ''.join(r.text for r in p.runs).strip()
    if label in values:
        tmpl = p.runs[0].font
        _run(p, ' ' + values[label], 18, bold=True, color=INK)
tf = box.text_frame
p = tf.add_paragraph()
p.space_before = Pt(6)
_run(p, 'Solution: ', 13, bold=True, color=BRAND)
_run(p, 'Wiqaya, a private and explainable companion for reproductive potential over time, for women and men', 13, color=BODY)
p = tf.add_paragraph()
_run(p, 'Prototype: ', 13, bold=True, color=BRAND)
_run(p, URL, 13, color=BODY)

# ---------------------------------------------------------------- 2. Team members
tbl = next(sh for sh in S[1].shapes if sh.has_table).table
for i, member in enumerate(TEAM, start=1):
    for c, v in enumerate(member, start=1):
        cell = tbl.cell(i, c)
        tf = cell.text_frame
        p = tf.paragraphs[0]
        for r in list(p.runs):
            r._r.getparent().remove(r._r)
        _run(p, v, 11, bold=(c == 1), color=INK, font=None)

# ---------------------------------------------------------------- 3. Capability
assert len(CAPABILITY) <= 1000, len(CAPABILITY)
paras = []
for i, line in enumerate(CAPABILITY.split('\n')):
    if ':' in line and i in (1, 2):
        who, rest = line.split(':', 1)
        paras.append({'runs': [(who + ':', {'bold': True, 'color': INK}), (rest, {})], 'bullet': True, 'space': 6})
    else:
        paras.append({'runs': [(line, {'bold': i == 0, 'color': INK if i == 0 else BODY})], 'space': 8})
text(S[2], X0, TOP + 0.05, 6.1, 3.6, paras, size=12)
card(S[2], 6.85, TOP + 0.05, 2.73, 2.75, fill=BRAND_SOFT, line=BRAND_LINE)
text(S[2], 7.03, TOP + 0.2, 2.4, 2.5, [
    {'runs': [('Built in the challenge window', {'bold': True, 'color': BRAND, 'size': 11.5})], 'space': 8},
    {'runs': [('Bilingual app (Arabic / English)', {})], 'bullet': True},
    {'runs': [('51 cited rules, women and men', {})], 'bullet': True},
    {'runs': [('Cycles and results over time', {})], 'bullet': True},
    {'runs': [('Guarded AI: Gemini on Vertex AI', {})], 'bullet': True},
    {'runs': [('Encrypted FHIR R4 summary', {})], 'bullet': True},
    {'runs': [('Clinician review step', {})], 'bullet': True},
    {'runs': [('162 unit tests + live AI runs', {})], 'bullet': True},
], size=10.5)

# ---------------------------------------------------------------- 4. Architecture
arch = ASSETS / 'architecture.jpg'
picture(S[3], arch, X0, 1.35, w=W0, border=False, name='Architecture diagram')
text(S[3], X0, 4.2, W0, 1.1, [
    {'runs': [B('How it decides: '), N('fixed, cited rules run on the phone and choose one of five next steps. Red flags are asked first and route straight to 998. There is no fertility score.')], 'space': 4},
    {'runs': [B('What the AI does: '), N('optionally explains the result in plain Arabic or English, answers from 37 sourced notes and reads a lab-report photo. It never sees the answers and cannot change the step; guards block diagnoses and doses. No model is trained or fine-tuned.')], 'space': 4},
    {'runs': [B('Stack: '), N('React 19 + TypeScript on the device · serverless functions on Vercel (AI proxy, ciphertext-only summary store) · Gemini 3 Flash on Google Cloud Vertex AI · HL7 FHIR R4 for Malaffi.')]},
], size=9.6)

# ---------------------------------------------------------------- 5. Target users & outcome
text(S[4], X0, 1.32, 6.55, 3.95, [
    {'runs': [('Who it serves', {'bold': True, 'color': BRAND, 'size': 12.5})], 'space': 5},
    {'runs': [B('Women and men 18+ in Abu Dhabi: '), N('any nationality, Arabic or English, planning a family now, later or not sure. Many learn how fertility changes only once they are trying.')], 'bullet': True},
    {'runs': [B('Family physicians and women’s health clinics: '), N('receive a structured, consented summary instead of a cold start.')], 'bullet': True},
    {'runs': [B('Fertility, gynaecology, andrology and urology services: '), N('see people earlier, with the key facts ready.')], 'bullet': True},
    {'runs': [B('ADPHC / DoH teams: '), N('totals only, on who would benefit from earlier advice.')], 'bullet': True, 'space': 9},
    {'runs': [('Intended outcome', {'bold': True, 'color': BRAND, 'size': 12.5})], 'space': 5},
    {'runs': [B('An honest view of change over time: '), N('cycles, AMH, semen results and habits charted over months; what can change, what cannot and what is not yet known. No score.')], 'bullet': True},
    {'runs': [B('Earlier, informed choices: '), N('from healthy habits to tests, preconception counselling, a fertility-preservation discussion or a specialist. Options to discuss, never recommendations.')], 'bullet': True},
    {'runs': [B('Lower friction: '), N('5 minutes, no account, discreet mode, quick exit, teleconsultation and female-doctor options.')], 'bullet': True},
    {'runs': [B('Safe triage '), N('to one of five next steps; red flags to 998; a clinician confirms.')], 'bullet': True},
], size=10.1)
picture(S[4], ASSETS / 'result-phone.jpg', 7.45, 1.25, h=4.05, name='Result screen')

# ---------------------------------------------------------------- 6. Success measures
table(S[5], X0, 1.32, [1.9, 2.45, 2.15, 2.66],
      ['Measure', 'Prototype result (synthetic)', 'Proposed pilot target', 'How it is measured'],
      [
          ['Red flags caught', '13 / 13 (100%); emergencies 4 / 4', '100%', 'Clinician audit of every urgent case'],
          ['Under-triage', '0 of 89 cases', '0 serious under-triage', 'Two-clinician review of a random sample'],
          ['Correct next step', '89 / 89 vs. team labels', '≥ 95% agreement', 'Independent labels by two clinicians'],
          ['Fairness', '890 / 890 unchanged across nationality × language', 'No gap > 5 points between groups', 'Completion and referral rates by sex, language, age, nationality'],
          ['AI safety', 'Live runs: explainer 42/43, companion 48/48, report reader 80/80', '0 diagnosis or dose statements', 'Automated filters + weekly sample review'],
          ['Informed choice', 'Not measured yet', '≥ 80% can name their options', 'Short decision-quality questions after the result'],
          ['Time to appropriate evaluation', 'Modelled only: 207 women, mean 5.8 months earlier', 'Shorter than today’s baseline', 'Days from check to first matching visit (Malaffi)'],
          ['Referral completion', 'Clinician confirm / change log', '≥ 60% of shared summaries attended', 'Summary matched to an encounter'],
          ['User trust', '1–5 survey after each result', 'Mean ≥ 4.0', 'Two questions: private & respectful; clear next step'],
      ], size=9, head_size=9.5, row_h=0.36, name='Success measures')
text(S[5], X0, 5.08, W0, 0.25, [{'runs': [('Prototype figures are measured on synthetic cases (see the /evaluation page); the modelled figure uses 10,000 invented people. Pilot targets are proposed, to be agreed with DoH / ADPHC.', {'size': 8.5, 'color': MUTED})]}])

# ---------------------------------------------------------------- 7. Evidence
text(S[6], X0, TOP, 5.55, 3.85, [
    {'runs': [('Clinical evidence behind the rules (48 sources)', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [B('ASRM fertility evaluation of women; ACOG age-related decline: '), N('when to assess, and how age changes fertility.')], 'bullet': True},
    {'runs': [B('ASRM ovarian reserve testing; JAMA 2017: '), N('AMH shows roughly how many eggs remain; it does not predict natural pregnancy.')], 'bullet': True},
    {'runs': [B('ASRM planned egg freezing; ESHRE fertility preservation: '), N('what preservation involves. A discussion, not a recommendation.')], 'bullet': True},
    {'runs': [B('International PCOS guideline 2023; FIGO; ESHRE endometriosis 2022: '), N('cycle and symptom rules.')], 'bullet': True},
    {'runs': [B('NICE NG126, NG12: '), N('emergency and urgent routes.')], 'bullet': True},
    {'runs': [B('WHO semen manual (2021); AUA/ASRM; EAU: '), N('semen limits, evaluation timing, risk history.')], 'bullet': True},
    {'runs': [B('NICE CG156: '), N('assess after 12 months of trying, or 6 if the woman is 35+.')], 'bullet': True},
    {'runs': [B('WHO preconception care; USPSTF folic acid; ADA 2026: '), N('preconception and metabolic health.')], 'bullet': True},
    {'runs': [B('ADPHC IFHAS programme: '), N('periodic screening for Thiqa cardholders.')], 'bullet': True, 'space': 8},
    {'runs': [('Honest limit. ', {'bold': True, 'color': BRAND}), N('The team compiled the rules from these guidelines. Every rule shows its source in the app; clinician review of each one belongs to the pilot.')]},
], size=9.5)
heading(S[6], 6.2, TOP, 3.4, 'Prior testing of this prototype', size=12)
sx, sy, sw, gap = 6.2, TOP + 0.38, 1.62, 0.14
stats = [('13/13', 'red flags caught'), ('0', 'under-triaged (89 cases)'), ('89/89', 'correct next step'),
         ('890/890', 'unchanged across groups'), ('42/43', 'live AI explainer tests'), ('80/80', 'report values read correctly')]
for i, (v, l) in enumerate(stats):
    stat(S[6], sx + (i % 2) * (sw + gap), sy + (i // 2) * (0.82 + gap), sw, v, l)
text(S[6], 6.2, sy + 3 * (0.82 + gap) + 0.02, 3.38, 0.4, [{'runs': [('Synthetic data. Companion AI: 48/48. Reproducible: npm test, and the live /evaluation page in the prototype.', {'size': 8.5, 'color': MUTED})]}])

# ---------------------------------------------------------------- 8. Data sources
table(S[7], X0, TOP - 0.06, [1.78, 1.62, 0.95, 1.0, 2.56, 1.25],
      ['Source', 'Type', 'Owner', 'Sensitivity', 'Permission / legal basis', 'Personal data?'],
      [
          ['89 synthetic test cases (35 women’s)', 'Authored clinical vignettes', 'Team Zord', 'None', 'Created by the team', 'No'],
          ['4 example people; 10,000 invented people', 'Generated histories; simulated population', 'Team Zord', 'None', 'Created by the team; no real person', 'No'],
          ['Published guidelines (48 sources: ASRM, ACOG, ESHRE, NICE, WHO, AUA, EAU)', 'Reference literature, paraphrased into rules and 37 notes', 'Publishers', 'Public', 'Cited; no text or data reproduced', 'No'],
          ['Answers, check-ins and results in the app', 'Self-reported health information', 'The user', 'High (reproductive)', 'Explicit consent; processed and stored only on the user’s device; optional PIN lock', 'Yes, on device only'],
          ['Shared summary', 'HL7 FHIR R4 bundle, encrypted on the phone', 'The user → clinician', 'High', 'Per-share consent (FHIR Consent); the server holds ciphertext only; can be withdrawn', 'Pseudonymous'],
          ['AI request', 'Result summary, a question, or a report photo', 'The user', 'Low; photo: high', 'Separate AI opt-in; never logged by us; Google does not train on it and may hold it briefly', 'No identifiers sent'],
          ['Usage counters, feedback', 'Anonymous counts, 1–5 scores', 'Team Zord', 'Low', 'Counters only; nothing else is accepted', 'No'],
      ], size=8.3, head_size=8.8, row_h=0.42, name='Data sources')
text(S[7], X0, 5.1, W0, 0.25, [{'runs': [('No challenge dataset was provided, no real patient data was used at any point, and no model was trained or fine-tuned.', {'size': 9, 'bold': True, 'color': BRAND})]}])

# ---------------------------------------------------------------- 9. Risks & safeguards
table(S[8], X0, TOP + 0.02, [1.2, 1.85, 4.31, 1.8],
      ['Area', 'Risk', 'Safeguard in the prototype', 'Tested by'],
      [
          ['Privacy', 'Exposure of sensitive reproductive data', 'On-device processing; no account or ID; optional PIN lock; per-share consent; summary marked for care only, never employment or insurance; discreet mode, quick exit, one-tap delete', 'Architecture; Privacy page'],
          ['Security', 'API abuse, key leakage', 'Keys only on the server; summary encrypted with AES-256-GCM, key only in the link; validation, size and rate limits; no request logging. Pilot: UAE hosting, clinician sign-in, audit logs', '162 unit tests'],
          ['Bias', 'Uneven results across groups', 'Rules never see nationality or language; women and men each have their own rules; Arabic and English; “Prefer not to say” never hides a red flag', '890 / 890 counterfactual runs'],
          ['Explainability', 'Black-box advice', 'Deterministic, cited rules; every finding shows its triggering answer and source; screens label you / rules / AI / clinician; no fertility score', '102 / 102 findings with evidence + source'],
          ['Misuse', 'Read as a diagnosis; false reassurance; pressure to freeze eggs', '“Screening, not diagnosis” on every result; AMH never shown as a prediction; preservation only as a discussion; AI blocked from diagnoses and doses', 'Live AI runs 42/43 and 48/48'],
          ['Human oversight', 'Over-reliance on automation', 'A clinician confirms or changes the step, with a reason; that decision stands for 90 days', 'Clinician review flow'],
          ['Failure modes', 'Missed emergency, bad data, AI outage', 'Red flags asked first, hard-coded to 998; data-quality gate ignores impossible values; app complete without AI', '13 / 13 red flags; 4 / 4 planted errors; 0 crashes in 89 missing-data runs'],
      ], size=8.4, head_size=9, row_h=0.46, name='Risks and safeguards')

# ---------------------------------------------------------------- 10. Hardware
text(S[9], X0, TOP + 0.1, 4.9, 2.4, [
    {'runs': [('Not applicable: Wiqaya is software only.', {'bold': True, 'color': BRAND, 'size': 14})], 'space': 10},
    {'runs': [N('Runs in any modern mobile or desktop browser (iOS, Android, desktop). No app install, wearable, sensor or connected device is needed.')], 'bullet': True},
    {'runs': [N('No hardware sourcing or device-safety considerations apply.')], 'bullet': True},
    {'runs': [N('Future option, with separate consent: import cycle, sleep and activity data from wearables already used in Abu Dhabi programmes.')], 'bullet': True},
], size=11.5)
picture(S[9], ASSETS / 'results-phone.jpg', 5.95, 1.66, h=3.66, name='Results over time screen')
picture(S[9], ASSETS / 'emergency-phone.jpg', 7.8, 1.66, h=3.66, name='Emergency screen')
text(S[9], X0, TOP + 2.35, 4.9, 0.6, [{'runs': [('Left: results charted over time (example person, invented data). Right: the red-flag screen, shown immediately when a possible emergency is reported.', {'size': 9, 'color': MUTED, 'italic': True})]}])

# ---------------------------------------------------------------- 11. Access
text(S[10], X0, TOP + 0.08, 4.45, 3.8, [
    {'runs': [('No login required. Every feature is open to guests.', {'bold': True, 'color': BRAND, 'size': 12.5})], 'space': 8},
    {'runs': [B('1. Open '), (URL, {'bold': True, 'color': BRAND}), N(' on a phone or computer.')], 'space': 5},
    {'runs': [B('2. Tap “Start the check”. '), N('About 5 minutes, no account.')], 'space': 5},
    {'runs': [B('3. Instant example results: '), N('/#/result?example=W14, W23, C44, or W31 (emergency).')], 'space': 5},
    {'runs': [B('4. Example people with months of history: '), N('/#/try/mariam, /#/try/fatima, /#/try/omar, /#/try/yousef')], 'space': 5},
    {'runs': [B('5. Clinician inbox (demo): '), N('/#/clinician · '), B('Health-system view: '), N('/#/population')], 'space': 5},
    {'runs': [B('6. Safety and test results: '), N('/#/evaluation')], 'space': 5},
    {'runs': [B('7. Arabic: '), N('use the language switch at the top, or add ?lang=ar to any link.')], 'space': 5},
], size=10.2)
picture(S[10], ASSETS / 'hero-desk.jpg', 5.05, TOP + 0.08, w=4.53, name='Home page')

# ---------------------------------------------------------------- 12. Path to pilot
phases = [
    ('Phase 1 · Months 0–3', 'Validate', ['Two clinicians label the 89 test cases', 'Gynaecology, fertility and andrology sign-off on rules v1.0', 'Native Arabic clinical review', 'Usability with 30 women and men; DoH data-protection review']),
    ('Phase 2 · Months 3–9', 'Pilot', ['2–3 primary care centres + 1 fertility centre', 'Embedded in Sahatna (web view)', 'FHIR summaries via Malaffi, with clinician sign-in', 'Track completion, informed choice, time to evaluation, trust']),
    ('Phase 3 · Months 9–18', 'Scale', ['Emirate-wide through Sahatna', 'Linked to IFHAS booking', 'Payer pathways (Thiqa / Daman)', 'Publish outcomes; add shared plans for couples']),
]
pw, pg = (W0 - 2 * 0.16) / 3, 0.16
for i, (when, what, items) in enumerate(phases):
    x = X0 + i * (pw + pg)
    card(S[11], x, TOP, pw, 1.95, fill=BRAND_SOFT if i == 1 else WHITE, line=BRAND_LINE if i == 1 else SAND_LINE)
    text(S[11], x + 0.14, TOP + 0.1, pw - 0.28, 1.8, [
        {'runs': [(when, {'size': 9, 'color': MUTED, 'bold': True})], 'space': 1},
        {'runs': [(what, {'size': 13, 'color': BRAND, 'bold': True})], 'space': 4},
        *[{'runs': [(it, {})], 'bullet': True, 'space': 2} for it in items],
    ], size=9.3)
cy = TOP + 2.1
text(S[11], X0, cy, 4.5, 1.7, [
    {'runs': [('Stakeholders and integration', {'bold': True, 'color': BRAND, 'size': 11})], 'space': 4},
    {'runs': [N('DoH Abu Dhabi, ADPHC (IFHAS), Malaffi, Sahatna, primary care networks, women’s health and fertility centres, payers.')], 'bullet': True},
    {'runs': [N('HL7 FHIR R4 in and out; runs inside existing apps, so no new hospital software is needed.')], 'bullet': True},
], size=9.6)
text(S[11], X0 + 4.66, cy, 4.5, 1.7, [
    {'runs': [('Regulation and sustainability', {'bold': True, 'color': BRAND, 'size': 11})], 'space': 4},
    {'runs': [N('UAE Federal Law No. 2 of 2019 (health data), DoH standards, UAE data residency; confirm medical-device classification with the regulator (non-diagnostic decision support).')], 'bullet': True},
    {'runs': [N('Licence to DoH / ADPHC per enrolled adult or per completed assessment; very low running cost (static app + on-demand AI).')], 'bullet': True},
], size=9.6)

# ---------------------------------------------------------------- 13. IP & third-party
text(S[12], X0, TOP + 0.02, W0, 0.5, [
    {'runs': [B('Ownership: '), N('all code, rules, test cases, content and designs were created by Team Zord during the challenge (November 2026). No pre-existing proprietary IP is used.')]},
], size=10.5)
table(S[12], X0, TOP + 0.55, [3.2, 3.4, 2.56],
      ['Third-party component', 'Used for', 'Licence / terms'],
      [
          ['React, React DOM, React Router', 'User interface and navigation', 'MIT (open source)'],
          ['Vite, Vitest, Tailwind CSS', 'Build, automated tests, styling', 'MIT (open source)'],
          ['TypeScript', 'Programming language', 'Apache-2.0 (open source)'],
          ['Lucide icons; uqr; fflate', 'Interface icons; QR code for the doctor link; compression', 'ISC; MIT; MIT (open source)'],
          ['IBM Plex Sans / Plex Sans Arabic', 'Typeface, bundled with the app', 'SIL Open Font Licence 1.1'],
          ['Google Gemini 3 Flash on Vertex AI', 'Optional explanations, grounded answers, report reading', 'Commercial API, Google Cloud terms'],
          ['Vercel (static site + serverless functions)', 'Delivery of the prototype', 'Provider’s commercial terms'],
          ['Clinical guidelines (ASRM, ACOG, ESHRE, NICE, WHO, AUA, EAU)', 'Evidence for the rules', 'Publisher copyright; cited, not reproduced'],
      ], size=9, head_size=9.5, row_h=0.31, name='Third-party components')
text(S[12], X0, 5.12, W0, 0.22, [{'runs': [('Restrictions: none known. All open-source licences are permissive; attributions are kept in the code repository.', {'size': 9, 'color': MUTED})]}])

# ---------------------------------------------------------------- 14. Conflict of interest
text(S[13], X0, TOP + 0.1, W0, 3.4, [
    {'runs': [('None. No member of our team has a conflict of interest to declare.', {'bold': True, 'color': BRAND, 'size': 14})], 'space': 10},
    {'runs': [N('No team member is employed by, or contracted to, the Department of Health – Abu Dhabi, Future Health, Microsoft, Inception42, MBZUAI or Hack2skill.')], 'bullet': True},
    {'runs': [N('No family member or close personal relationship with a judge, organiser or collaborator staff member.')], 'bullet': True},
    {'runs': [N('No financial interest in an organisation involved in running or judging the challenge.')], 'bullet': True},
    {'runs': [N('No access to non-public information about the challenge or its evaluation.')], 'bullet': True},
], size=11.5)

# ---------------------------------------------------------------- 15. Additional: assumptions, limitations, test data
title15 = next(sh for sh in S[14].shapes if sh.has_text_frame and 'Additional' in sh.text_frame.text)
title15.top = Inches(0.94)
title15.left = Inches(0.28)
p0 = title15.text_frame.paragraphs[0]
p0.runs[0].text = 'Assumptions, limitations and test data'
for r in p0.runs[1:]:
    r.text = ''
cg = 0.22
cw = (W0 - 2 * cg) / 3
text(S[14], X0, TOP - 0.05, cw, 3.9, [
    {'runs': [('Assumptions', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [N('Users have a smartphone and internet access.')], 'bullet': True},
    {'runs': [N('A family physician or a women’s health clinic is reachable.')], 'bullet': True},
    {'runs': [N('Summaries can travel through existing Malaffi FHIR interfaces.')], 'bullet': True},
    {'runs': [N('Thiqa cardholders can book IFHAS; other residents reach routine checks through their insurer or family doctor.')], 'bullet': True},
    {'runs': [N('People want to know how their fertility is changing before they try, if it is private and without judgement.')], 'bullet': True},
], size=9.4)
text(S[14], X0 + cw + cg, TOP - 0.05, cw, 3.9, [
    {'runs': [('Limitations', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [N('Synthetic data only; expected outcomes were labelled by the team, not yet by clinicians.')], 'bullet': True},
    {'runs': [N('Rules v0.2 are not clinically validated or reviewed by a regulator.')], 'bullet': True},
    {'runs': [N('Arabic text needs review by a native-speaking clinician.')], 'bullet': True},
    {'runs': [N('Example providers are invented: no live booking.')], 'bullet': True},
    {'runs': [N('The encrypted doctor link needs a small server store that is not switched on in the public demo; the clinician inbox is a single-device demo.')], 'bullet': True},
    {'runs': [N('The report reader was tested on computer-printed synthetic reports only.')], 'bullet': True},
    {'runs': [N('AI depends on an external service; the app is complete without it.')], 'bullet': True},
    {'runs': [N('Screening support: not a diagnosis, not a medical device.')], 'bullet': True},
], size=9.4)
card(S[14], X0 + 2 * (cw + cg) - 0.1, TOP - 0.15, cw + 0.1, 3.95, fill=BRAND_SOFT, line=BRAND_LINE)
text(S[14], X0 + 2 * (cw + cg) + 0.04, TOP - 0.05, cw - 0.16, 3.8, [
    {'runs': [('Test data and model', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [B('No model is trained or fine-tuned. '), N('Fixed rules choose the step. Gemini is used as provided, only to explain and to read report photos.')], 'bullet': True},
    {'runs': [B('89 synthetic cases '), N('(35 women’s), written by the team from guidelines, each with an expected step.')], 'bullet': True},
    {'runs': [B('890 counterfactual runs: '), N('the same cases across 5 nationality groups × 2 languages.')], 'bullet': True},
    {'runs': [B('89 missing-data runs: '), N('answers removed, 0 crashes.')], 'bullet': True},
    {'runs': [B('Live AI sets: '), N('43 explainer and 48 companion tests; synthetic report pictures with 80 values.')], 'bullet': True},
    {'runs': [B('10,000 invented people '), N('for the health-system view; 4 example people with months of history.')], 'bullet': True},
    {'runs': [B('No real patient data '), N('at any point.')], 'bullet': True},
], size=9.2)

prs.save(OUT)
print('saved', OUT)
