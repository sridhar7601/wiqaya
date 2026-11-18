// Stage for the demo video. The renderer drives everything through window.S, one frame at a time.
;(() => {
  const $ = (s) => document.querySelector(s)
  const FR = { pf: $('#pf'), df: $('#df') }
  const APP_STYLE = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}'
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const easeOut = (p) => 1 - Math.pow(1 - p, 3)
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const S = {
    ready: false,
    lines: [],
    hlEl: null,
    hlFrame: null,
    hlBox: null,

    win: (f) => FR[f].contentWindow,
    doc: (f) => FR[f].contentDocument,

    async load(f, route) {
      await new Promise((res) => {
        FR[f].onload = res
        FR[f].src = '/app/index.html#' + route
      })
      await S.prep(f)
    },
    async reload(f) {
      await new Promise((res) => {
        FR[f].onload = res
        S.win(f).location.reload()
      })
      await S.prep(f)
    },
    async prep(f) {
      const d = S.doc(f)
      if (!d.getElementById('__stage')) {
        const st = d.createElement('style')
        st.id = '__stage'
        st.textContent = APP_STYLE
        d.head.appendChild(st)
      }
      await d.fonts.ready
      await S.until(f, () => d.querySelector('#root')?.children.length > 0)
      await S.raf(f)
    },
    async go(f, route) {
      S.win(f).location.hash = route
      await sleep(30)
      await S.raf(f)
    },
    async until(f, fn, timeout = 20000) {
      const t0 = Date.now()
      while (!fn()) {
        if (Date.now() - t0 > timeout) throw new Error('timeout waiting in ' + f + ' on ' + norm(S.doc(f).querySelector('h1')?.textContent) + ' | notices: ' + [...S.doc(f).querySelectorAll('.ring-inset')].map((e) => norm(e.textContent).slice(0, 90)).join(' / '))
        await sleep(40)
      }
      await S.raf(f)
      return true
    },
    untilText: (f, text, timeout) => S.until(f, () => S.doc(f).body.innerText.includes(text), timeout),
    untilH1Not: (f, prev, timeout = 4000) => S.until(f, () => norm(S.doc(f).querySelector('h1')?.textContent) !== prev, timeout),
    h1: (f) => norm(S.doc(f).querySelector('h1')?.textContent),
    // Headless Chrome can stop ticking animation frames when nothing is being captured, so a timer backs it up.
    raf: (f) =>
      new Promise((r) => {
        const w = f ? S.win(f) : window
        setTimeout(r, 60)
        w.requestAnimationFrame(() => w.requestAnimationFrame(r))
      }),
    sy: (f) => S.win(f).scrollY,
    scroll: (f, y) => S.win(f).scrollTo({ top: y, left: 0, behavior: 'instant' }),

    storage(obj, merge = false) {
      if (!merge) localStorage.clear()
      for (const [k, v] of Object.entries(obj)) localStorage.setItem(k, JSON.stringify(v))
      return true
    },

    find(f, q) {
      const d = S.doc(f)
      let els = [...d.querySelectorAll(q.sel || 'button, a, label, summary')]
      els = els.filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 1 && r.height > 1
      })
      if (q.text != null) {
        els = els.filter((e) => {
          const t = norm(e.textContent).replace(/^✓\s*/, '')
          return q.exact ? t === q.text : q.contains ? t.includes(q.text) : t.startsWith(q.text)
        })
      }
      els = els.filter((e) => !els.some((o) => o !== e && e.contains(o)))
      let el = els[q.nth || 0]
      if (!el) throw new Error('not found in ' + f + ': ' + JSON.stringify(q) + ' | page: ' + S.h1(f))
      if (q.closest) el = el.closest(q.closest) || el
      return el
    },
    frameXf(f) {
      const r = FR[f].getBoundingClientRect()
      return { fx: r.left, fy: r.top, s: r.width / FR[f].offsetWidth }
    },
    locate(f, q) {
      const el = S.find(f, q)
      const w = S.win(f)
      const d = w.document
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const top = cy >= 0 && cy < w.innerHeight ? d.elementFromPoint(cx, cy) : null
      const hit = !!top && (top === el || el.contains(top))
      return { x: r.left, y: r.top, w: r.width, h: r.height, sy: w.scrollY, vh: w.innerHeight, max: d.documentElement.scrollHeight - w.innerHeight, hit, h1: S.h1(f), ...S.frameXf(f) }
    },

    press(f, q) {
      const el = S.find(f, q)
      if (el.matches('input, textarea, select')) el.focus()
      else el.click()
      return true
    },
    typeChar(f, ch) {
      const el = S.doc(f).activeElement
      if (!el || !('value' in el)) throw new Error('nothing focused to type into')
      const proto = el instanceof S.win(f).HTMLTextAreaElement ? S.win(f).HTMLTextAreaElement.prototype : S.win(f).HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, el.value + ch)
      el.dispatchEvent(new (S.win(f).Event)('input', { bubbles: true }))
      return true
    },

    // Review copies carry a badge so they cannot be mistaken for the final cut.
    preview(text) {
      const e = $('#preview')
      e.textContent = text
      e.style.display = 'block'
      return true
    },

    hlTarget(f, q) {
      S.hlEl = q ? S.find(f, q) : null
      S.hlFrame = f
      return true
    },

    setCaption(c, mode, chapter, total) {
      document.body.classList.toggle('desk', mode === 'desk')
      const cap = $('#cap')
      cap.innerHTML = ''
      const add = (tag, cls, html) => {
        const e = document.createElement(tag)
        e.className = 'ln ' + cls
        e.innerHTML = html
        cap.appendChild(e)
      }
      if (c) {
        if (c.eyebrow) add('p', 'eyebrow', (chapter ? `<b>${String(chapter).padStart(2, '0')}</b> / ${String(total).padStart(2, '0')} &nbsp;·&nbsp; ` : '') + esc(c.eyebrow))
        if (c.title) add('h2', 'title', esc(c.title))
        for (const p of c.points || []) add('p', 'pt', esc(p))
        for (const [v, l] of c.stats || []) add('div', 'stat', `<b>${esc(v)}</b><span>${esc(l)}</span>`)
      }
      S.lines = [...cap.querySelectorAll('.ln')]
      const bar = $('#chapters')
      bar.innerHTML = ''
      for (let i = 1; i <= total; i++) {
        const e = document.createElement('i')
        if (i < chapter) e.className = 'done'
        if (i === chapter) e.className = 'on'
        bar.appendChild(e)
      }
      bar.style.visibility = chapter ? 'visible' : 'hidden'
      return true
    },

    apply(st) {
      const show = (el, o) => {
        el.style.opacity = o
        el.style.visibility = o > 0.001 ? 'visible' : 'hidden'
      }
      const T = $('#title')
      show(T, st.title.o)
      T.style.transform = `translateY(${st.title.y}px)`
      const E = $('#end')
      show(E, st.end.o)
      E.style.transform = `translateY(${st.end.y}px)`
      const P = $('#phone')
      show(P, st.phone.o)
      P.style.transform = `translate(${st.phone.x}px, ${st.phone.y}px) scale(${st.phone.s})`
      const D = $('#desk')
      show(D, st.desk.o)
      D.style.transform = `translateY(${st.desk.y}px) scale(${st.desk.s})`

      $('#caption').style.opacity = st.cap.o
      S.lines.forEach((el, i) => {
        const p = easeOut(clamp((st.cap.age - i * 0.08) / 0.55))
        el.style.opacity = p * (1 - st.cap.out)
        el.style.transform = `translateY(${(1 - p) * 22 - st.cap.out * 10}px)`
      })

      const tc = $('#touch')
      tc.style.opacity = st.touch.o
      tc.style.transform = `translate(${st.touch.x}px, ${st.touch.y}px) scale(${st.touch.s})`
      const rp = tc.firstElementChild
      rp.style.opacity = st.touch.r > 0 && st.touch.r < 1 ? (1 - st.touch.r) * 0.9 : 0
      rp.style.transform = `scale(${1 + st.touch.r * 1.3})`

      const cu = $('#cursor')
      cu.style.opacity = st.cursor.o
      cu.style.transform = `translate(${st.cursor.x - 5}px, ${st.cursor.y - 3}px) scale(${1 - st.cursor.p * 0.14})`

      const hl = $('#hl')
      const seen = () => {
        // A ring is only drawn around something inside the frame's visible area, never outside the device.
        const r = S.hlEl.getBoundingClientRect()
        const mid = r.top + r.height / 2
        return mid > 0 && mid < S.win(S.hlFrame).innerHeight
      }
      if (st.hl && st.hl > 0.001 && S.hlEl && S.hlEl.isConnected && seen()) {
        const r = S.hlEl.getBoundingClientRect()
        const { fx, fy, s } = S.frameXf(S.hlFrame)
        const pad = 6
        const box = { x: fx + r.left * s - pad, y: fy + r.top * s - pad, w: r.width * s + pad * 2, h: r.height * s + pad * 2 }
        hl.style.transform = `translate(${box.x}px, ${box.y}px)`
        hl.style.width = box.w + 'px'
        hl.style.height = box.h + 'px'
        hl.style.opacity = st.hl
      } else hl.style.opacity = 0

      $('#phone .veil').style.opacity = st.veil.pf
      $('#desk .veil').style.opacity = st.veil.df
      $('#fade').style.opacity = st.fade
      if (st.scroll.pf != null) S.scroll('pf', st.scroll.pf)
      if (st.scroll.df != null) S.scroll('df', st.scroll.df)
      return true
    },
  }

  window.S = S
  Promise.all([
    document.fonts.load('600 40px Plex'),
    document.fonts.load('400 40px Plex'),
    document.fonts.load('500 40px Plex'),
    document.fonts.load('600 40px PlexAr', 'وقاية'),
  ]).then(() => document.fonts.ready).then(() => (S.ready = true))
})()
