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
    'During the challenge we built Wiqaya end to end: a bilingual, mobile-first app, 31 guideline-based rules, '
    'an HL7 FHIR R4 referral with consent, a clinician review step, and an evaluation harness '
    '(54 synthetic cases checked on every build, plus 21 live AI tests).'
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
values = {'Team Name:': 'Zord', 'Team Size:': '2', 'Problem Statement:': '[Fertility] Male Reproductive Health'}
for p in box.text_frame.paragraphs:
    label = ''.join(r.text for r in p.runs).strip()
    if label in values:
        tmpl = p.runs[0].font
        _run(p, ' ' + values[label], 18, bold=True, color=INK)
tf = box.text_frame
p = tf.add_paragraph()
p.space_before = Pt(6)
_run(p, 'Solution: ', 13, bold=True, color=BRAND)
_run(p, "Wiqaya, a private and explainable front door to men's reproductive and preventive health", 13, color=BODY)
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
card(S[2], 6.85, TOP + 0.05, 2.73, 2.55, fill=BRAND_SOFT, line=BRAND_LINE)
text(S[2], 7.03, TOP + 0.2, 2.4, 2.3, [
    {'runs': [('Built in the challenge window', {'bold': True, 'color': BRAND, 'size': 11.5})], 'space': 8},
    {'runs': [('Bilingual app (Arabic / English)', {})], 'bullet': True},
    {'runs': [('31 cited clinical rules', {})], 'bullet': True},
    {'runs': [('Guarded Azure OpenAI layer', {})], 'bullet': True},
    {'runs': [('FHIR R4 referral + consent', {})], 'bullet': True},
    {'runs': [('Clinician review & audit', {})], 'bullet': True},
    {'runs': [('23 automated tests + 21 live AI tests', {})], 'bullet': True},
], size=10.5)

# ---------------------------------------------------------------- 4. Architecture
arch = ASSETS / 'architecture.jpg'
picture(S[3], arch, X0, 1.35, w=W0, border=False, name='Architecture diagram')
text(S[3], X0, 4.22, W0, 1.0, [
    {'runs': [B('How it decides: '), N('deterministic, cited rules run on the phone and choose one of five next steps. Red flags are asked second and route straight to 998.')], 'space': 5},
    {'runs': [B('What the AI does: '), N('optionally rewrites the result summary in plain Arabic or English. It never sees the answers and cannot change the step; input and output guards block emergencies, diagnoses and doses.')], 'space': 5},
    {'runs': [B('Stack: '), N('React + TypeScript on the device · one serverless function (AI proxy, no database) · Azure OpenAI GPT-4.1 · HL7 FHIR R4 for Malaffi.')]},
], size=10)

# ---------------------------------------------------------------- 5. Target users & outcome
text(S[4], X0, 1.32, 6.55, 3.95, [
    {'runs': [('Who it serves', {'bold': True, 'color': BRAND, 'size': 12.5})], 'space': 5},
    {'runs': [B('Men 18+ in Abu Dhabi: '), N('any nationality, Arabic or English, planning a family or not. Many reach care only after months of trying, or after their partner is tested.')], 'bullet': True},
    {'runs': [B('Family physicians: '), N('receive a structured, consented summary instead of a cold start.')], 'bullet': True},
    {'runs': [B('Andrology, urology and fertility services: '), N('see men earlier, with the key facts ready.')], 'bullet': True},
    {'runs': [B('ADPHC / DoH teams: '), N('anonymous, aggregate insight into male risk and screening uptake.')], 'bullet': True, 'space': 10},
    {'runs': [('Intended outcome', {'bold': True, 'color': BRAND, 'size': 12.5})], 'space': 5},
    {'runs': [B('Earlier, explainable risk identification '), N('before infertility is diagnosed, across history, lifestyle, metabolic, infectious, anatomical and test inputs.')], 'bullet': True},
    {'runs': [B('Lower friction: '), N('5 minutes, no account, discreet mode, teleconsultation and male-doctor options, home tests as a first step.')], 'bullet': True},
    {'runs': [B('Safe triage '), N('to one of five next steps; red flags to 998; a clinician confirms every referral.')], 'bullet': True},
    {'runs': [B('A hook for prevention: '), N('reproductive health brings men in; the same visit covers the heart and diabetes checks they usually skip (routine check / IFHAS).')], 'bullet': True},
], size=10.5)
picture(S[4], ASSETS / 'result-phone.jpg', 7.45, 1.25, h=4.05, name='Result screen')

# ---------------------------------------------------------------- 6. Success measures
table(S[5], X0, 1.32, [1.9, 2.45, 2.15, 2.66],
      ['Measure', 'Prototype result (synthetic)', 'Proposed pilot target', 'How it is measured'],
      [
          ['Red flags caught', '8 / 8 (100%)', '100%', 'Clinician audit of every urgent case'],
          ['Under-triage', '0 of 54 cases', '0 serious under-triage', 'Two-clinician review of a random sample'],
          ['Correct next step', '54 / 54 vs. team labels', '≥ 95% agreement', 'Independent labels by two clinicians'],
          ['Fairness', '540 / 540 unchanged across nationality × language', 'No gap > 5 points between groups', 'Completion and referral rates by language, age, nationality'],
          ['AI safety', '21 / 21 live tests · 10 offline guardrail tests', '0 diagnosis or dose statements', 'Automated filters + weekly sample review'],
          ['Completed assessments', 'Counted anonymously on device', '≥ 70% of started checks', 'Anonymous start / finish counts'],
          ['Time to appropriate evaluation', 'Measured in pilot', 'Shorter than today’s baseline', 'Days from check to first matching visit (Malaffi)'],
          ['Referral completion', 'Clinician confirm / change log', '≥ 60% of shared referrals attended', 'Referral matched to an encounter'],
          ['User trust', '1–5 survey after each result', 'Mean ≥ 4.0', 'Two questions: private & respectful; clear next step'],
      ], size=9, head_size=9.5, row_h=0.36, name='Success measures')
text(S[5], X0, 5.08, W0, 0.25, [{'runs': [('Prototype figures are measured live on synthetic cases (see the /evaluation page). Pilot targets are proposed, to be agreed with DoH / ADPHC.', {'size': 8.5, 'color': MUTED})]}])

# ---------------------------------------------------------------- 7. Evidence
text(S[6], X0, TOP, 5.55, 3.85, [
    {'runs': [('Clinical evidence behind the rules', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [B('WHO semen manual, 6th ed. (2021): '), N('lower reference limits for semen results.')], 'bullet': True},
    {'runs': [B('AUA/ASRM male infertility guideline (2020, amended 2024): '), N('evaluation timing, risk history, exogenous testosterone.')], 'bullet': True},
    {'runs': [B('EAU Sexual & Reproductive Health (2024): '), N('varicocele, mumps orchitis, infection, hypogonadism, lifestyle.')], 'bullet': True},
    {'runs': [B('NICE CG156: '), N('assess after 12 months of trying, or 6 if the female partner is 35+.')], 'bullet': True},
    {'runs': [B('NICE NG12: '), N('urgent route for a new testicular lump.')], 'bullet': True},
    {'runs': [B('Princeton III consensus (2012): '), N('erectile dysfunction as an early cardiovascular marker.')], 'bullet': True},
    {'runs': [B('ASRM, Optimizing natural fertility (2022): '), N('smoking, weight, activity.')], 'bullet': True},
    {'runs': [B('ADPHC IFHAS programme: '), N('periodic screening for Thiqa cardholders aged 18–75.')], 'bullet': True, 'space': 9},
    {'runs': [('Local insight. ', {'bold': True, 'color': BRAND}), N('ADPHC experts (Population Health briefing, Oct 2026): men take up reproductive screening well but rarely attend cardiometabolic screening. Wiqaya uses the first to drive the second.')]},
], size=9.8)
heading(S[6], 6.2, TOP, 3.4, 'Prior testing of this prototype', size=12)
sx, sy, sw, gap = 6.2, TOP + 0.38, 1.62, 0.14
stats = [('100%', 'red flags caught (8/8)'), ('0', 'under-triaged (54 cases)'), ('54/54', 'correct next step'),
         ('540/540', 'unchanged across groups'), ('21/21', 'live AI safety tests'), ('1.8 s', 'median AI reply')]
for i, (v, l) in enumerate(stats):
    stat(S[6], sx + (i % 2) * (sw + gap), sy + (i // 2) * (0.82 + gap), sw, v, l)
text(S[6], 6.2, sy + 3 * (0.82 + gap) + 0.02, 3.38, 0.4, [{'runs': [('Reproducible: npm test, and the live /evaluation page in the prototype.', {'size': 8.5, 'color': MUTED})]}])

# ---------------------------------------------------------------- 8. Data sources
table(S[7], X0, TOP + 0.02, [1.72, 1.6, 1.05, 1.1, 2.39, 1.3],
      ['Source', 'Type', 'Owner', 'Sensitivity', 'Permission / legal basis', 'Personal data?'],
      [
          ['54 synthetic test cases', 'Authored clinical vignettes', 'Team Zord', 'None', 'Created by the team', 'No'],
          ['Published guidelines (WHO, AUA/ASRM, EAU, NICE, ASRM)', 'Reference literature, paraphrased into rules', 'Publishers', 'Public', 'Cited; no text or data reproduced', 'No'],
          ['Answers in the app', 'Self-reported health information', 'The user', 'High (reproductive)', 'Explicit consent; processed and stored only on the user’s device', 'Yes, on device only'],
          ['Shared referral summary', 'HL7 FHIR R4 bundle', 'The user → clinician', 'High', 'Per-share consent, recorded as a FHIR Consent resource', 'Pseudonymous'],
          ['AI explainer request', 'Result summary + optional question', 'The user', 'Low', 'Separate AI opt-in; not stored; Azure OpenAI does not train on API data', 'No identifiers'],
          ['Usage counters, feedback', 'Anonymous counts, 1–5 scores', 'Team Zord', 'Low', 'On device (prototype); aggregate-only in pilot', 'No'],
      ], size=8.8, head_size=9, row_h=0.47, name='Data sources')
text(S[7], X0, 5.05, W0, 0.25, [{'runs': [('No challenge dataset was provided, and no real patient data was used at any point.', {'size': 9, 'bold': True, 'color': BRAND})]}])

# ---------------------------------------------------------------- 9. Risks & safeguards
table(S[8], X0, TOP + 0.02, [1.2, 1.85, 4.31, 1.8],
      ['Area', 'Risk', 'Safeguard in the prototype', 'Tested by'],
      [
          ['Privacy', 'Exposure of sensitive reproductive data', 'On-device processing; no account or ID; data minimisation; per-share consent; discreet mode; one-tap delete; no analytics or third-party requests', 'Architecture; Privacy page'],
          ['Security', 'API abuse, key leakage', 'Key only on the server; origin secret; input validation, size and rate limits; no request logging. Pilot: UAE hosting, role-based access, audit logs', '10 offline guardrail tests'],
          ['Bias', 'Uneven results across groups', 'Rules never see nationality or language; Arabic and English; “Prefer not to say” never hides a red flag', '540 / 540 counterfactual runs'],
          ['Explainability', 'Black-box advice', 'Deterministic, cited rules; every signal shows its triggering answer and source; screens label you / rules / AI / clinician', '58 / 58 signals with evidence + source'],
          ['Misuse', 'Read as a diagnosis; self-medication', '“Screening, not diagnosis” on every result; AI blocked from diagnoses and doses; never advises stopping medicines', '21 / 21 live AI tests'],
          ['Human oversight', 'Over-reliance on automation', 'A clinician confirms or changes every referral, with a reason; the decision is logged', 'Clinician review flow'],
          ['Failure modes', 'Missed emergency, bad data, AI outage', 'Red flags asked second, hard-coded to 998; data-quality gate ignores impossible values; app complete without AI', '8 / 8 red flags; 3 / 3 planted errors'],
      ], size=8.6, head_size=9, row_h=0.46, name='Risks and safeguards')

# ---------------------------------------------------------------- 10. Hardware
text(S[9], X0, TOP + 0.1, 5.4, 2.4, [
    {'runs': [('Not applicable: Wiqaya is software only.', {'bold': True, 'color': BRAND, 'size': 14})], 'space': 10},
    {'runs': [N('Runs in any modern mobile or desktop browser (iOS, Android, desktop). No app install, wearable, sensor or connected device is needed.')], 'bullet': True},
    {'runs': [N('No hardware sourcing or device-safety considerations apply.')], 'bullet': True},
    {'runs': [N('Future option, with separate consent: import sleep and activity data from wearables already used in Abu Dhabi programmes.')], 'bullet': True},
], size=11.5)
picture(S[9], ASSETS / 'emergency-phone.jpg', 7.45, 1.25, h=4.05, name='Emergency screen')
text(S[9], X0, TOP + 2.05, 5.4, 0.5, [{'runs': [('Right: the red-flag screen, shown immediately when a possible emergency is reported.', {'size': 9, 'color': MUTED, 'italic': True})]}])

# ---------------------------------------------------------------- 11. Access
text(S[10], X0, TOP + 0.08, 4.45, 3.7, [
    {'runs': [('No login required. Every feature is open to guests.', {'bold': True, 'color': BRAND, 'size': 12.5})], 'space': 9},
    {'runs': [B('1. Open '), (URL, {'bold': True, 'color': BRAND}), N(' on a phone or computer.')], 'space': 6},
    {'runs': [B('2. Tap “Start the check”. '), N('About 5 minutes, no account.')], 'space': 6},
    {'runs': [B('3. Instant examples: '), N('/#/result?example=C44, C28, or C45 (emergency).')], 'space': 6},
    {'runs': [B('4. Clinician inbox (demo): '), N('/#/clinician')], 'space': 6},
    {'runs': [B('5. Safety and test results: '), N('/#/evaluation')], 'space': 6},
    {'runs': [B('6. Arabic: '), N('use the language switch at the top, or add ?lang=ar to any link.')], 'space': 6},
], size=10.5)
picture(S[10], ASSETS / 'hero-desk.jpg', 5.05, TOP + 0.08, w=4.53, name='Home page')

# ---------------------------------------------------------------- 12. Path to pilot
phases = [
    ('Phase 1 · Months 0–3', 'Validate', ['Two clinicians label the test cases', 'Andrology / urology sign-off on rules v1.0', 'Native Arabic clinical review', 'Usability with 30 men; DoH data-protection review']),
    ('Phase 2 · Months 3–9', 'Pilot', ['2–3 primary care centres + 1 fertility centre', 'Embedded in Sehatna (web view)', 'FHIR summaries to family physicians via Malaffi', 'Track completion, time to evaluation, referral completion, trust']),
    ('Phase 3 · Months 9–18', 'Scale', ['Emirate-wide through Sehatna', 'Linked to IFHAS booking', 'Payer pathways (Thiqa / Daman)', 'Publish outcomes; extend to couples’ preconception checks']),
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
    {'runs': [N('DoH Abu Dhabi, ADPHC (IFHAS), Malaffi, Sehatna, primary care networks, fertility centres, payers.')], 'bullet': True},
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
          ['Lucide icons (lucide-react)', 'Interface icons', 'ISC (open source)'],
          ['IBM Plex Sans / Plex Sans Arabic', 'Typeface, bundled with the app', 'SIL Open Font Licence 1.1'],
          ['Microsoft Azure OpenAI (GPT-4.1)', 'Optional plain-language explanations', 'Commercial API, Microsoft terms'],
          ['Cloud hosting (static site + serverless function)', 'Delivery of the prototype', 'Provider’s commercial terms'],
          ['Clinical guidelines (WHO, AUA, EAU, NICE)', 'Evidence for the rules', 'Publisher copyright; cited, not reproduced'],
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

# ---------------------------------------------------------------- 15. Additional: assumptions & limitations
title15 = next(sh for sh in S[14].shapes if sh.has_text_frame and 'Additional' in sh.text_frame.text)
title15.top = Inches(0.94)
title15.left = Inches(0.28)
p0 = title15.text_frame.paragraphs[0]
p0.runs[0].text = 'Assumptions and limitations'
for r in p0.runs[1:]:
    r.text = ''
cw = (W0 - 0.3) / 2
text(S[14], X0, TOP - 0.05, cw, 3.9, [
    {'runs': [('Assumptions', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [N('Users have a smartphone and internet access.')], 'bullet': True},
    {'runs': [N('A family physician is reachable (Abu Dhabi family physician programme).')], 'bullet': True},
    {'runs': [N('Referral summaries can travel through existing Malaffi FHIR interfaces.')], 'bullet': True},
    {'runs': [N('Thiqa cardholders can book IFHAS; other residents reach routine checks through their insurer or family doctor.')], 'bullet': True},
    {'runs': [N('Men engage with reproductive health more readily than with cardiometabolic screening (ADPHC observation).')], 'bullet': True},
], size=10)
text(S[14], X0 + cw + 0.3, TOP - 0.05, cw, 3.9, [
    {'runs': [('Limitations', {'bold': True, 'color': BRAND, 'size': 12})], 'space': 5},
    {'runs': [N('Synthetic data only; expected outcomes labelled by the team, not yet by clinicians.')], 'bullet': True},
    {'runs': [N('Rules v0.1 are not yet clinically validated or reviewed by a regulator.')], 'bullet': True},
    {'runs': [N('Arabic text needs native clinical review.')], 'bullet': True},
    {'runs': [N('The service directory is generic: there is no live booking yet.')], 'bullet': True},
    {'runs': [N('The clinician inbox is a single-device demo.')], 'bullet': True},
    {'runs': [N('Fairness is tested counterfactually; real-world equity needs a pilot.')], 'bullet': True},
    {'runs': [N('The AI explainer depends on an external service; the app is complete without it.')], 'bullet': True},
    {'runs': [N('Wiqaya is screening support, not a medical device.')], 'bullet': True},
], size=10)

prs.save(OUT)
print('saved', OUT)
