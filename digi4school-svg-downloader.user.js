// ==UserScript==
// @name         Digi4school SVG Downloader Pro
// @namespace    https://digi4school.at/
// @version      2.0
// @description  高颜值下载面板：批量 / 单页 / 范围下载，实时进度，支持暂停继续
// @match        https://a.digi4school.at/ebook/*
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /* ─────────────────────────────────────────────
       PARSE URL
    ───────────────────────────────────────────── */
    const pathParts = window.location.pathname.split('/');
    const bookId    = pathParts[2] || 'book';
    const volume    = pathParts[3] || '1';

    /* ─────────────────────────────────────────────
       STATE
    ───────────────────────────────────────────── */
    let totalPages  = parseInt(GM_getValue(`pages_${bookId}_${volume}`, 0)) || 0;
    let isRunning   = false;
    let isPaused    = false;
    let abortFlag   = false;
    let downloaded  = 0;
    let failed      = 0;

    /* ─────────────────────────────────────────────
       INJECT STYLES
    ───────────────────────────────────────────── */
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@600;800&display=swap');

        #d4s-panel {
            position: fixed;
            top: 18px;
            right: 18px;
            z-index: 2147483647;
            width: 320px;
            background: #0d0f14;
            border: 1px solid #1e2330;
            border-radius: 16px;
            box-shadow: 0 24px 64px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04) inset;
            font-family: 'JetBrains Mono', monospace;
            color: #c8d0e0;
            overflow: hidden;
            transition: box-shadow .3s;
            user-select: none;
        }
        #d4s-panel:hover {
            box-shadow: 0 28px 72px rgba(0,0,0,.8), 0 0 0 1px rgba(99,179,237,.12) inset;
        }

        /* ── Header ── */
        #d4s-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px 12px;
            background: linear-gradient(135deg, #111520 0%, #151a26 100%);
            border-bottom: 1px solid #1e2330;
            cursor: move;
        }
        #d4s-title {
            font-family: 'Syne', sans-serif;
            font-weight: 800;
            font-size: 13px;
            letter-spacing: .5px;
            background: linear-gradient(90deg, #63b3ed, #9f7aea);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        #d4s-badge {
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 1.5px;
            color: #4a5568;
            text-transform: uppercase;
        }
        #d4s-collapse-btn {
            background: none; border: none; cursor: pointer;
            color: #4a5568; font-size: 14px; line-height: 1;
            transition: color .2s; padding: 2px 4px;
        }
        #d4s-collapse-btn:hover { color: #c8d0e0; }

        /* ── Body ── */
        #d4s-body { padding: 14px 16px 16px; }
        #d4s-body.collapsed { display: none; }

        /* ── Info row ── */
        .d4s-info {
            display: flex; gap: 8px; margin-bottom: 14px;
        }
        .d4s-chip {
            flex: 1; background: #151a26; border: 1px solid #1e2330;
            border-radius: 8px; padding: 7px 10px;
            font-size: 9.5px; color: #4a5568; letter-spacing: .5px;
        }
        .d4s-chip span { display: block; font-size: 12px; color: #c8d0e0; font-weight: 600; margin-top: 2px; }

        /* ── Page count input ── */
        .d4s-label { font-size: 9px; letter-spacing: 1px; color: #4a5568; text-transform: uppercase; margin-bottom: 6px; }
        .d4s-input-row { display: flex; gap: 8px; margin-bottom: 14px; align-items: center; }
        .d4s-input {
            flex: 1; background: #151a26; border: 1px solid #1e2330;
            border-radius: 8px; padding: 8px 10px;
            color: #c8d0e0; font-family: 'JetBrains Mono', monospace;
            font-size: 12px; outline: none; transition: border-color .2s;
            width: 100%; box-sizing: border-box;
        }
        .d4s-input:focus { border-color: #63b3ed; }
        .d4s-input-row .d4s-input { max-width: 70px; text-align: center; }

        /* ── Delay slider ── */
        .d4s-slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .d4s-slider { flex: 1; -webkit-appearance: none; height: 3px;
            background: #1e2330; border-radius: 2px; outline: none; }
        .d4s-slider::-webkit-slider-thumb {
            -webkit-appearance: none; width: 14px; height: 14px;
            border-radius: 50%; background: #63b3ed; cursor: pointer;
            box-shadow: 0 0 6px rgba(99,179,237,.5);
            transition: box-shadow .2s;
        }
        .d4s-slider::-webkit-slider-thumb:hover { box-shadow: 0 0 10px rgba(99,179,237,.8); }
        #d4s-delay-val { font-size: 11px; color: #63b3ed; min-width: 40px; text-align: right; }

        /* ── Separator ── */
        .d4s-sep { border: none; border-top: 1px solid #1e2330; margin: 14px 0; }

        /* ── Section titles ── */
        .d4s-section-title {
            font-family: 'Syne', sans-serif; font-size: 9.5px; font-weight: 600;
            letter-spacing: 1.5px; text-transform: uppercase; color: #4a5568;
            margin-bottom: 8px;
        }

        /* ── Buttons ── */
        .d4s-btn {
            display: flex; align-items: center; justify-content: center; gap: 7px;
            width: 100%; padding: 10px 14px;
            border: none; border-radius: 9px; cursor: pointer;
            font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
            letter-spacing: .5px; transition: all .2s; outline: none;
        }
        #d4s-btn-all {
            background: linear-gradient(135deg, #2b6cb0, #553c9a);
            color: #e2e8f0;
            box-shadow: 0 4px 14px rgba(99,179,237,.2);
            margin-bottom: 8px;
        }
        #d4s-btn-all:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(99,179,237,.35);
        }
        #d4s-btn-all:active:not(:disabled) { transform: translateY(0); }
        #d4s-btn-all:disabled { opacity: .5; cursor: not-allowed; transform: none; }

        .d4s-btn-row { display: flex; gap: 8px; margin-bottom: 8px; }
        #d4s-btn-pause {
            flex: 1; background: #1a2035; border: 1px solid #1e2330; color: #c8d0e0;
        }
        #d4s-btn-pause:hover:not(:disabled) { background: #1e2740; border-color: #63b3ed; color: #63b3ed; }
        #d4s-btn-pause:disabled { opacity: .35; cursor: not-allowed; }

        #d4s-btn-stop {
            flex: 1; background: #1a2035; border: 1px solid #1e2330; color: #c8d0e0;
        }
        #d4s-btn-stop:hover:not(:disabled) { background: #261a1a; border-color: #fc8181; color: #fc8181; }
        #d4s-btn-stop:disabled { opacity: .35; cursor: not-allowed; }

        /* ── Single page ── */
        #d4s-single-row { display: flex; gap: 8px; }
        #d4s-single-input { flex: 1; }
        #d4s-btn-single {
            flex: 0 0 auto; width: auto; padding: 8px 14px;
            background: linear-gradient(135deg, #276749, #2f855a);
            color: #c6f6d5;
            box-shadow: 0 4px 12px rgba(72,187,120,.15);
        }
        #d4s-btn-single:hover { background: linear-gradient(135deg, #2f855a, #276749); box-shadow: 0 4px 16px rgba(72,187,120,.3); }

        /* ── Range download ── */
        #d4s-range-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        #d4s-btn-range {
            background: linear-gradient(135deg, #744210, #975a16);
            color: #fefcbf;
            box-shadow: 0 4px 12px rgba(236,201,75,.1);
        }
        #d4s-btn-range:hover { box-shadow: 0 4px 16px rgba(236,201,75,.25); }

        /* ── Progress ── */
        #d4s-progress-wrap { margin-top: 14px; display: none; }
        #d4s-progress-wrap.active { display: block; }
        .d4s-progress-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 10px; }
        #d4s-progress-label { color: #63b3ed; }
        #d4s-progress-pct { color: #9f7aea; font-weight: 600; }
        #d4s-progress-bar-bg {
            width: 100%; height: 5px; background: #1e2330;
            border-radius: 3px; overflow: hidden;
        }
        #d4s-progress-bar {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, #63b3ed, #9f7aea);
            border-radius: 3px;
            transition: width .3s ease;
            box-shadow: 0 0 8px rgba(99,179,237,.5);
        }
        #d4s-progress-stats { display: flex; justify-content: space-between; margin-top: 6px; font-size: 9.5px; color: #4a5568; }
        #d4s-fail-count { color: #fc8181; }

        /* ── Log ── */
        #d4s-log {
            margin-top: 12px; max-height: 90px; overflow-y: auto;
            background: #080a0f; border: 1px solid #1e2330;
            border-radius: 8px; padding: 8px 10px;
            font-size: 9.5px; line-height: 1.7; color: #4a5568;
        }
        #d4s-log::-webkit-scrollbar { width: 4px; }
        #d4s-log::-webkit-scrollbar-track { background: transparent; }
        #d4s-log::-webkit-scrollbar-thumb { background: #1e2330; border-radius: 2px; }
        .log-ok  { color: #68d391; }
        .log-err { color: #fc8181; }
        .log-inf { color: #63b3ed; }
        .log-warn{ color: #f6e05e; }

        /* ── Pulse animation when running ── */
        @keyframes d4s-pulse {
            0%,100% { box-shadow: 0 28px 72px rgba(0,0,0,.8), 0 0 0 1px rgba(99,179,237,.12) inset; }
            50%      { box-shadow: 0 28px 72px rgba(0,0,0,.8), 0 0 0 1px rgba(99,179,237,.35) inset; }
        }
        #d4s-panel.running { animation: d4s-pulse 2s infinite; }
    `;
    document.head.appendChild(style);

    /* ─────────────────────────────────────────────
       BUILD PANEL HTML
    ───────────────────────────────────────────── */
    const panel = document.createElement('div');
    panel.id = 'd4s-panel';
    panel.innerHTML = `
        <div id="d4s-header">
            <div>
                <div id="d4s-title">D4S DOWNLOADER</div>
                <div id="d4s-badge">SVG · Pro Edition</div>
            </div>
            <button id="d4s-collapse-btn" title="折叠">▲</button>
        </div>

        <div id="d4s-body">
            <!-- Info chips -->
            <div class="d4s-info">
                <div class="d4s-chip">BOOK ID<span id="d4s-chip-book">${bookId}</span></div>
                <div class="d4s-chip">VOLUME<span id="d4s-chip-vol">${volume}</span></div>
            </div>

            <!-- Total pages -->
            <div class="d4s-label">Total pages</div>
            <div class="d4s-input-row" style="margin-bottom:10px">
                <input id="d4s-pages-input" class="d4s-input" type="number" min="1" value="${totalPages || ''}" placeholder="e.g. 212" style="max-width:100%;text-align:left"/>
                <button class="d4s-btn" id="d4s-btn-save-pages" style="flex:0 0 auto;width:auto;padding:8px 12px;background:#151a26;border:1px solid #1e2330;color:#63b3ed;font-size:10px;">SAVE</button>
            </div>

            <!-- Delay -->
            <div class="d4s-label">Delay between pages</div>
            <div class="d4s-slider-row">
                <input id="d4s-delay-slider" class="d4s-slider" type="range" min="100" max="2000" step="50" value="300"/>
                <span id="d4s-delay-val">300ms</span>
            </div>

            <hr class="d4s-sep"/>

            <!-- Batch download -->
            <div class="d4s-section-title">Batch Download</div>
            <button id="d4s-btn-all" class="d4s-btn">⬇ Download All Pages</button>
            <div class="d4s-btn-row">
                <button id="d4s-btn-pause" class="d4s-btn" disabled>⏸ Pause</button>
                <button id="d4s-btn-stop"  class="d4s-btn" disabled>✕ Stop</button>
            </div>

            <hr class="d4s-sep"/>

            <!-- Range download -->
            <div class="d4s-section-title">Range Download</div>
            <div id="d4s-range-row">
                <input id="d4s-range-from" class="d4s-input" type="number" min="1" placeholder="From" style="max-width:70px;text-align:center"/>
                <span style="color:#4a5568;font-size:11px">—</span>
                <input id="d4s-range-to"   class="d4s-input" type="number" min="1" placeholder="To"   style="max-width:70px;text-align:center"/>
            </div>
            <button id="d4s-btn-range" class="d4s-btn" style="margin-top:8px">⬇ Download Range</button>

            <hr class="d4s-sep"/>

            <!-- Single page download -->
            <div class="d4s-section-title">Single Page</div>
            <div id="d4s-single-row">
                <input id="d4s-single-input" class="d4s-input" type="number" min="1" placeholder="Page #"/>
                <button id="d4s-btn-single" class="d4s-btn">⬇</button>
            </div>

            <!-- Progress -->
            <div id="d4s-progress-wrap">
                <div class="d4s-progress-header">
                    <span id="d4s-progress-label">Initializing…</span>
                    <span id="d4s-progress-pct">0%</span>
                </div>
                <div id="d4s-progress-bar-bg">
                    <div id="d4s-progress-bar"></div>
                </div>
                <div id="d4s-progress-stats">
                    <span id="d4s-ok-count">✓ 0 downloaded</span>
                    <span id="d4s-fail-count">✗ 0 failed</span>
                </div>
            </div>

            <!-- Log -->
            <div id="d4s-log"><span class="log-inf">» Ready. Set total pages and click download.</span></div>
        </div>
    `;
    document.body.appendChild(panel);

    /* ─────────────────────────────────────────────
       ELEMENT REFS
    ───────────────────────────────────────────── */
    const $  = id => document.getElementById(id);
    const collapseBtn    = $('d4s-collapse-btn');
    const body           = $('d4s-body');
    const pagesInput     = $('d4s-pages-input');
    const savePagesBtn   = $('d4s-btn-save-pages');
    const delaySlider    = $('d4s-delay-slider');
    const delayVal       = $('d4s-delay-val');
    const btnAll         = $('d4s-btn-all');
    const btnPause       = $('d4s-btn-pause');
    const btnStop        = $('d4s-btn-stop');
    const singleInput    = $('d4s-single-input');
    const btnSingle      = $('d4s-btn-single');
    const rangeFrom      = $('d4s-range-from');
    const rangeTo        = $('d4s-range-to');
    const btnRange       = $('d4s-btn-range');
    const progressWrap   = $('d4s-progress-wrap');
    const progressLabel  = $('d4s-progress-label');
    const progressPct    = $('d4s-progress-pct');
    const progressBar    = $('d4s-progress-bar');
    const okCount        = $('d4s-ok-count');
    const failCount      = $('d4s-fail-count');
    const log            = $('d4s-log');

    /* ─────────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────────── */
    function getDelay() { return parseInt(delaySlider.value, 10); }

    function logMsg(msg, cls = '') {
        const line = document.createElement('div');
        line.className = cls;
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        // keep log trim
        while (log.children.length > 60) log.removeChild(log.firstChild);
    }

    function svgUrl(page) {
        return `https://a.digi4school.at/ebook/${bookId}/${volume}/${page}.svg`;
    }
    function svgName(page) {
        return `${bookId}_${volume}_${String(page).padStart(4, '0')}.svg`;
    }

    function updateProgress(current, total) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        okCount.textContent   = `✓ ${downloaded} downloaded`;
        failCount.textContent = `✗ ${failed} failed`;
    }

    function downloadPage(page, onDone) {
        const url  = svgUrl(page);
        const name = svgName(page);
        GM_download({
            url,
            name,
            onload:  () => { downloaded++; logMsg(`✓ Page ${page}`, 'log-ok'); onDone && onDone(true); },
            onerror: (e) => { failed++;     logMsg(`✗ Page ${page} — ${e.error || 'error'}`, 'log-err'); onDone && onDone(false); }
        });
    }

    function setRunning(val) {
        isRunning = val;
        btnAll.disabled    = val;
        btnRange.disabled  = val;
        btnSingle.disabled = val;
        btnPause.disabled  = !val;
        btnStop.disabled   = !val;
        panel.classList.toggle('running', val);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function runDownload(pages) {
        downloaded = 0; failed = 0; abortFlag = false; isPaused = false;
        setRunning(true);
        progressWrap.classList.add('active');
        logMsg(`» Starting ${pages.length} page(s)…`, 'log-inf');

        for (let i = 0; i < pages.length; i++) {
            if (abortFlag) { logMsg('» Aborted by user.', 'log-warn'); break; }
            while (isPaused) { await sleep(200); }

            const page = pages[i];
            progressLabel.textContent = `Page ${page}  (${i + 1} / ${pages.length})`;
            updateProgress(i, pages.length);
            downloadPage(page, null);

            await sleep(getDelay());
        }

        updateProgress(pages.length, pages.length);
        progressLabel.textContent = abortFlag ? 'Stopped.' : 'Done!';
        logMsg(`» Finished. ✓${downloaded}  ✗${failed}`, downloaded > 0 ? 'log-ok' : 'log-warn');
        setRunning(false);
    }

    /* ─────────────────────────────────────────────
       EVENTS — collapse
    ───────────────────────────────────────────── */
    collapseBtn.addEventListener('click', () => {
        const collapsed = body.classList.toggle('collapsed');
        collapseBtn.textContent = collapsed ? '▼' : '▲';
    });

    /* ─────────────────────────────────────────────
       EVENTS — save pages
    ───────────────────────────────────────────── */
    savePagesBtn.addEventListener('click', () => {
        const v = parseInt(pagesInput.value, 10);
        if (v > 0) {
            totalPages = v;
            GM_setValue(`pages_${bookId}_${volume}`, v);
            logMsg(`» Saved: ${v} pages.`, 'log-inf');
            savePagesBtn.textContent = '✓';
            setTimeout(() => { savePagesBtn.textContent = 'SAVE'; }, 1200);
        }
    });

    /* ─────────────────────────────────────────────
       EVENTS — delay slider
    ───────────────────────────────────────────── */
    delaySlider.addEventListener('input', () => {
        delayVal.textContent = delaySlider.value + 'ms';
    });

    /* ─────────────────────────────────────────────
       EVENTS — download ALL
    ───────────────────────────────────────────── */
    btnAll.addEventListener('click', () => {
        const n = parseInt(pagesInput.value, 10) || totalPages;
        if (!n) { logMsg('✗ Set total pages first!', 'log-err'); return; }
        const pages = Array.from({ length: n }, (_, i) => i + 1);
        runDownload(pages);
    });

    /* ─────────────────────────────────────────────
       EVENTS — pause / resume
    ───────────────────────────────────────────── */
    btnPause.addEventListener('click', () => {
        isPaused = !isPaused;
        btnPause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        logMsg(isPaused ? '» Paused.' : '» Resumed.', 'log-inf');
    });

    /* ─────────────────────────────────────────────
       EVENTS — stop
    ───────────────────────────────────────────── */
    btnStop.addEventListener('click', () => {
        abortFlag = true; isPaused = false;
        btnPause.textContent = '⏸ Pause';
    });

    /* ─────────────────────────────────────────────
       EVENTS — range download
    ───────────────────────────────────────────── */
    btnRange.addEventListener('click', () => {
        const from = parseInt(rangeFrom.value, 10);
        const to   = parseInt(rangeTo.value,   10);
        if (!from || !to || from > to) {
            logMsg('✗ Invalid range.', 'log-err'); return;
        }
        const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        runDownload(pages);
    });

    /* ─────────────────────────────────────────────
       EVENTS — single page download
    ───────────────────────────────────────────── */
    btnSingle.addEventListener('click', () => {
        const p = parseInt(singleInput.value, 10);
        if (!p || p < 1) { logMsg('✗ Enter a valid page number.', 'log-err'); return; }
        logMsg(`» Downloading page ${p}…`, 'log-inf');
        downloadPage(p, (ok) => {
            logMsg(ok ? `✓ Page ${p} saved.` : `✗ Page ${p} failed.`, ok ? 'log-ok' : 'log-err');
        });
    });

    singleInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') btnSingle.click();
    });

    /* ─────────────────────────────────────────────
       DRAGGABLE PANEL
    ───────────────────────────────────────────── */
    let drag = false, ox = 0, oy = 0;
    $('d4s-header').addEventListener('mousedown', e => {
        drag = true;
        ox = e.clientX - panel.getBoundingClientRect().left;
        oy = e.clientY - panel.getBoundingClientRect().top;
        panel.style.transition = 'none';
    });
    document.addEventListener('mousemove', e => {
        if (!drag) return;
        panel.style.right = 'auto';
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.top  = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => { drag = false; panel.style.transition = ''; });

})();
