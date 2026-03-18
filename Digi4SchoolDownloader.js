// ==UserScript==
// @name         Digi4School Downloader
// @namespace    https://digi4school.at/
// @version      4.2
// @description  SVG batch download + one-click PDF export (no Python needed)
// @match        https://a.digi4school.at/ebook/*
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /* ── URL parsing ─────────────────────────────────── */
    const parts  = window.location.pathname.split('/').filter(Boolean);
    const bookId = parts[1] || '';
    const volume = parts[2] || '';

    function detectPageCount() {
        const meta = document.querySelector('meta[name="pageLabels"]');
        if (meta && meta.content) return meta.content.split(',').length;
        return parseInt(GM_getValue('pages_' + bookId + '_' + volume, 0)) || 0;
    }

    function svgUrl(page) {
        const pat = GM_getValue('pattern_' + bookId, 'A');
        if (pat === 'B') return 'https://a.digi4school.at/ebook/' + bookId + '/' + page + '.svg';
        return 'https://a.digi4school.at/ebook/' + bookId + '/' + volume + '/' + page + '.svg';
    }
    function svgName(page) {
        return bookId + '_' + (volume || '1') + '_' + String(page).padStart(4, '0') + '.svg';
    }

    /* ── State ───────────────────────────────────────── */
    let isRunning = false, isPaused = false, abortFlag = false;
    let downloaded = 0, failed = 0;
    let pdfRunning = false;

    /* ── Styles ──────────────────────────────────────── */
    const css = document.createElement('style');
    css.textContent = `
        #d4s{position:fixed;top:16px;right:16px;z-index:2147483647;width:290px;
            background:#1a1d27;border:1px solid #2e3347;border-radius:12px;
            box-shadow:0 8px 32px rgba(0,0,0,.65);
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            font-size:13px;color:#e0e4f0;user-select:none;}
        #d4s-hdr{display:flex;align-items:center;justify-content:space-between;
            padding:12px 14px 10px;border-bottom:1px solid #2e3347;cursor:move;}
        #d4s-title{font-size:13px;font-weight:600;color:#e0e4f0;}
        #d4s-sub{font-size:11px;color:#6b7394;margin-top:1px;}
        #d4s-tog{background:none;border:none;cursor:pointer;color:#6b7394;
            font-size:16px;line-height:1;padding:2px 4px;}
        #d4s-tog:hover{color:#e0e4f0;}
        #d4s-body{padding:12px 14px 14px;}
        #d4s-body.hidden{display:none;}
        .chips{display:flex;gap:6px;margin-bottom:12px;}
        .chip{flex:1;background:#12141e;border:1px solid #2e3347;border-radius:6px;padding:6px 8px;}
        .clabel{font-size:10px;color:#6b7394;margin-bottom:2px;}
        .cval{font-size:13px;color:#e0e4f0;font-weight:500;word-break:break-all;}
        .d4s-sec{font-size:10px;font-weight:600;letter-spacing:.8px;
            text-transform:uppercase;color:#4a5170;margin-bottom:8px;}
        .d4s-sep{border:none;border-top:1px solid #2e3347;margin:12px 0;}
        input.fi{width:100%;box-sizing:border-box;background:#12141e;
            border:1px solid #2e3347;border-radius:6px;padding:7px 10px;
            color:#e0e4f0;font-size:13px;outline:none;transition:border-color .15s;}
        input.fi:focus{border-color:#5b7cf7;}
        input.fi::placeholder{color:#3e4460;}
        .row{display:flex;gap:6px;align-items:center;}
        .row input.fi{flex:1;}
        button.b{display:flex;align-items:center;justify-content:center;gap:6px;
            width:100%;padding:9px 12px;border:none;border-radius:7px;cursor:pointer;
            font-size:13px;font-weight:500;transition:opacity .15s,transform .1s;outline:none;}
        button.b:active:not(:disabled){transform:scale(.98);}
        button.b:disabled{opacity:.4;cursor:not-allowed;}
        .bp{background:#3d5bf5;color:#fff;}
        .bp:hover:not(:disabled){background:#5070f7;}
        .bs{background:#1f2336;border:1px solid #2e3347;color:#c0c8e8;}
        .bs:hover:not(:disabled){background:#252942;border-color:#3e4a6e;}
        .bd{background:#1f2336;border:1px solid #2e3347;color:#c0c8e8;}
        .bd:hover:not(:disabled){background:#2e1a1a;border-color:#7a2c2c;color:#f08080;}
        .bg{background:#1d2030;border:1px solid #2e3347;color:#9ca8d4;font-size:12px;}
        .bg:hover:not(:disabled){background:#222640;border-color:#f0c040;color:#f0c040;}
        .bn{background:#1a2e20;border:1px solid #2e4736;color:#7ed4a0;}
        .bn:hover:not(:disabled){background:#1f3827;border-color:#3d7a55;}
        .bpdf{background:#0f3d3d;border:1px solid #1a6060;color:#4dd4c4;font-size:13px;font-weight:600;}
        .bpdf:hover:not(:disabled){background:#164f4f;border-color:#2a8080;color:#6ef0e0;}
        .prog{display:none;margin-top:10px;}
        .prog.on{display:block;}
        .prow{display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;}
        .plabel{color:#8891b4;}
        .ppct{color:#5b7cf7;font-weight:600;}
        .ptrack{height:4px;background:#12141e;border-radius:2px;overflow:hidden;}
        .pbar{height:100%;width:0%;border-radius:2px;transition:width .2s ease;}
        .pbar-svg{background:#3d5bf5;}
        .pbar-pdf{background:linear-gradient(90deg,#1a9090,#4dd4c4);}
        .pcounts{display:flex;justify-content:space-between;font-size:11px;margin-top:5px;}
        #d4s-log{margin-top:10px;max-height:100px;overflow-y:auto;background:#0d0f18;
            border:1px solid #2e3347;border-radius:6px;padding:7px 9px;
            font-size:12px;line-height:1.65;color:#6b7394;}
        #d4s-log::-webkit-scrollbar{width:3px;}
        #d4s-log::-webkit-scrollbar-thumb{background:#2e3347;border-radius:2px;}
        .lok{color:#5ab87a;} .lerr{color:#e06060;}
        .linf{color:#5b7cf7;} .lwrn{color:#d4a830;} .ldim{color:#4a5170;}
        #d4s-dbp{display:none;margin-top:10px;background:#0d0f18;
            border:1px solid #2e3347;border-radius:6px;padding:9px 10px;
            font-size:12px;line-height:1.75;}
        #d4s-dbp.on{display:block;}
        .dr{display:flex;gap:6px;}
        .dl{color:#6b7394;min-width:115px;flex-shrink:0;}
        .dv{color:#e0e4f0;word-break:break-all;}
        .dok{color:#5ab87a;} .derr{color:#e06060;} .dwrn{color:#d4a830;}
        @keyframes d4s-run{0%,100%{border-color:#2e3347}50%{border-color:#3d5bf5}}
        #d4s.running{animation:d4s-run 2s infinite;}
        @keyframes d4s-pdf{0%,100%{border-color:#2e3347}50%{border-color:#4dd4c4}}
        #d4s.pdfing{animation:d4s-pdf 2s infinite;}
    `;
    document.head.appendChild(css);

    /* ── Panel HTML ──────────────────────────────────── */
    const panel = document.createElement('div');
    panel.id = 'd4s';
    const dp = detectPageCount();
    panel.innerHTML = `
        <div id="d4s-hdr">
            <div>
                <div id="d4s-title">Digi4School Downloader</div>
                <div id="d4s-sub">${bookId || '—'} &middot; v4.2</div>
            </div>
            <button id="d4s-tog">&#9650;</button>
        </div>
        <div id="d4s-body">
            <div class="chips">
                <div class="chip"><div class="clabel">Book</div><div class="cval">${bookId || '—'}</div></div>
                <div class="chip"><div class="clabel">Vol</div><div class="cval">${volume || 'n/a'}</div></div>
                <div class="chip"><div class="clabel">Pages</div><div class="cval" id="d4s-pchip">${dp || '?'}</div></div>
            </div>

            <div class="d4s-sec">Page count</div>
            <div class="row" style="margin-bottom:12px">
                <input id="d4s-pages" class="fi" type="number" min="1"
                    value="${dp || ''}" placeholder="e.g. 380" style="text-align:center"/>
                <button id="d4s-save" class="b bs" style="width:auto;padding:7px 12px;flex:0 0 auto">Save</button>
            </div>

            <hr class="d4s-sep">
            <div class="d4s-sec">PDF export &nbsp;<span style="color:#1a6060;font-size:9px;letter-spacing:.5px">IN-BROWSER</span></div>
            <button id="d4s-pdf-all" class="b bpdf" style="margin-bottom:6px">&#8659; Export full book as PDF</button>
            <div class="row" style="margin-bottom:4px">
                <input id="d4s-pdf-from" class="fi" type="number" min="1" placeholder="From" style="text-align:center"/>
                <span style="color:#4a5170;flex:0 0 auto">&ndash;</span>
                <input id="d4s-pdf-to" class="fi" type="number" min="1" placeholder="To" style="text-align:center"/>
                <button id="d4s-pdf-range" class="b bpdf" style="width:auto;padding:7px 12px;flex:0 0 auto">&#8659;</button>
            </div>
            <div id="d4s-pprog" class="prog">
                <div class="prow"><span id="d4s-pplabel" class="plabel">—</span><span id="d4s-pppct" class="ppct">0%</span></div>
                <div class="ptrack"><div id="d4s-ppbar" class="pbar pbar-pdf"></div></div>
                <div class="pcounts">
                    <span id="d4s-ppok" style="color:#4dd4c4">&#10003; 0</span>
                    <span id="d4s-ppfail" style="color:#e06060">&#10007; 0</span>
                </div>
            </div>

            <hr class="d4s-sep">
            <div class="d4s-sec">SVG downloads</div>
            <button id="d4s-all" class="b bp" style="margin-bottom:6px">&#8595; Download all SVGs</button>
            <div class="row" style="margin-bottom:8px">
                <button id="d4s-pause" class="b bs" disabled>&#9208; Pause</button>
                <button id="d4s-stop"  class="b bd" disabled>&#10005; Stop</button>
            </div>
            <div class="row" style="margin-bottom:6px">
                <input id="d4s-from" class="fi" type="number" min="1" placeholder="From" style="text-align:center"/>
                <span style="color:#4a5170;flex:0 0 auto">&ndash;</span>
                <input id="d4s-to" class="fi" type="number" min="1" placeholder="To" style="text-align:center"/>
            </div>
            <button id="d4s-range" class="b bs" style="margin-bottom:8px">&#8595; Download SVG range</button>
            <div class="d4s-sec" style="margin-top:4px">Single page</div>
            <div class="row">
                <input id="d4s-single" class="fi" type="number" min="1" placeholder="Page #"/>
                <button id="d4s-dl1" class="b bn" style="width:auto;padding:7px 14px;flex:0 0 auto">&#8595;</button>
            </div>
            <div id="d4s-sprog" class="prog">
                <div class="prow"><span id="d4s-splabel" class="plabel">—</span><span id="d4s-sppct" class="ppct">0%</span></div>
                <div class="ptrack"><div id="d4s-spbar" class="pbar pbar-svg"></div></div>
                <div class="pcounts">
                    <span id="d4s-sok" style="color:#5ab87a">&#10003; 0</span>
                    <span id="d4s-sfail" style="color:#e06060">&#10007; 0</span>
                </div>
            </div>

            <hr class="d4s-sep">
            <button id="d4s-diag" class="b bg">&#9881; Run diagnostics</button>
            <div id="d4s-dbp"></div>
            <div id="d4s-log"><span class="ldim">Ready.</span></div>
        </div>`;

    /* ── Main init — wait for body ───────────────────── */
    function init() {
        document.body.appendChild(panel);

        const $ = id => document.getElementById(id);
        const E = {
            tog:$('d4s-tog'), body:$('d4s-body'),
            pages:$('d4s-pages'), pchip:$('d4s-pchip'), save:$('d4s-save'),
            pdfAll:$('d4s-pdf-all'), pdfFrom:$('d4s-pdf-from'), pdfTo:$('d4s-pdf-to'), pdfRange:$('d4s-pdf-range'),
            pprog:$('d4s-pprog'), pplabel:$('d4s-pplabel'), pppct:$('d4s-pppct'),
            ppbar:$('d4s-ppbar'), ppok:$('d4s-ppok'), ppfail:$('d4s-ppfail'),
            all:$('d4s-all'), pause:$('d4s-pause'), stop:$('d4s-stop'),
            from:$('d4s-from'), to:$('d4s-to'), range:$('d4s-range'),
            single:$('d4s-single'), dl1:$('d4s-dl1'),
            sprog:$('d4s-sprog'), splabel:$('d4s-splabel'), sppct:$('d4s-sppct'),
            spbar:$('d4s-spbar'), sok:$('d4s-sok'), sfail:$('d4s-sfail'),
            diag:$('d4s-diag'), dbp:$('d4s-dbp'), log:$('d4s-log'),
        };

        /* ── Helpers ─────────────────────────────────── */
        function log(msg, cls) {
            cls = cls || 'ldim';
            const el = document.createElement('div');
            el.className = cls; el.textContent = msg;
            E.log.appendChild(el);
            E.log.scrollTop = E.log.scrollHeight;
            while (E.log.children.length > 100) E.log.removeChild(E.log.firstChild);
        }
        function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
        function getPageCount() { return parseInt(E.pages.value, 10) || detectPageCount(); }

        /* ── SVG download ────────────────────────────── */
        function dlSvg(page, onDone) {
            GM_download({
                url: svgUrl(page), name: svgName(page),
                onload:  function()  { downloaded++; log('✓ SVG p' + page, 'lok'); if(onDone) onDone(true); },
                onerror: function(e) { failed++;     log('✗ SVG p' + page + ' — ' + (e.error||'err'), 'lerr'); if(onDone) onDone(false); }
            });
        }

        function setSvgRunning(v) {
            isRunning = v;
            E.all.disabled = E.range.disabled = E.dl1.disabled = v;
            E.pdfAll.disabled = E.pdfRange.disabled = v;
            E.pause.disabled = E.stop.disabled = !v;
            panel.classList.toggle('running', v);
        }

        async function runSvgBatch(pages) {
            downloaded = 0; failed = 0; abortFlag = false; isPaused = false;
            setSvgRunning(true);
            E.sprog.classList.add('on');
            log('SVG batch: ' + pages.length + ' pages…', 'linf');
            for (let i = 0; i < pages.length; i++) {
                if (abortFlag) { log('Aborted.', 'lwrn'); break; }
                while (isPaused) await sleep(200);
                const p = pages[i];
                const pct = Math.round(i / pages.length * 100);
                E.splabel.textContent = 'p' + p + '  (' + (i+1) + '/' + pages.length + ')';
                E.spbar.style.width = pct + '%'; E.sppct.textContent = pct + '%';
                E.sok.textContent = '✓ ' + downloaded; E.sfail.textContent = '✗ ' + failed;
                dlSvg(p, null);
                await sleep(300);
            }
            E.spbar.style.width = '100%'; E.sppct.textContent = '100%';
            E.splabel.textContent = abortFlag ? 'Stopped' : 'Done';
            E.sok.textContent = '✓ ' + downloaded; E.sfail.textContent = '✗ ' + failed;
            log('SVG done — ✓' + downloaded + ' ✗' + failed, downloaded > 0 ? 'lok' : 'lwrn');
            setSvgRunning(false);
        }

        /* ── PDF export ──────────────────────────────── */
        function setPdfRunning(v) {
            pdfRunning = v;
            E.pdfAll.disabled = E.pdfRange.disabled = v;
            E.all.disabled = E.range.disabled = E.dl1.disabled = v;
            panel.classList.toggle('pdfing', v);
        }

        async function exportPDF(pages) {
            if (pdfRunning) return;

            const jsPDF = window.jspdf && window.jspdf.jsPDF;
            if (!jsPDF) { log('✗ jsPDF not loaded.', 'lerr'); return; }

            setPdfRunning(true);
            abortFlag = false;
            E.pprog.classList.add('on');

            let fetched = 0, errors = 0, pdf = null;

            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');

            log('PDF export: ' + pages.length + ' pages…', 'linf');

            for (let i = 0; i < pages.length; i++) {
                if (abortFlag) { log('Aborted.', 'lwrn'); break; }

                const p   = pages[i];
                const pct = Math.round(i / pages.length * 100);
                E.pplabel.textContent = 'p' + p + '  (' + (i+1) + '/' + pages.length + ')';
                E.ppbar.style.width   = pct + '%';
                E.pppct.textContent   = pct + '%';
                E.ppok.textContent    = '✓ ' + fetched;
                E.ppfail.textContent  = '✗ ' + errors;

                try {
                    const resp = await fetch(svgUrl(p));
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    const svgText = await resp.text();
                    const objUrl  = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));

                    await new Promise(function(resolve, reject) {
                        const img = new Image();
                        img.onload = function() {
                            const w = img.naturalWidth  || 909;
                            const h = img.naturalHeight || 1286;
                            canvas.width  = w;
                            canvas.height = h;
                            ctx.clearRect(0, 0, w, h);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, w, h);
                            ctx.drawImage(img, 0, 0, w, h);

                            const imgData = canvas.toDataURL('image/jpeg', 0.92);
                            if (!pdf) {
                                pdf = new jsPDF({
                                    unit: 'px', format: [w, h],
                                    orientation: h > w ? 'portrait' : 'landscape',
                                    compress: true
                                });
                            } else {
                                pdf.addPage([w, h], h > w ? 'portrait' : 'landscape');
                            }
                            pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
                            resolve();
                        };
                        img.onerror = function() {
                            reject(new Error('Image load failed'));
                        };
                        img.src = objUrl;
                    });

                    fetched++;
                    log('✓ p' + p, 'lok');
                } catch(e) {
                    errors++;
                    log('✗ p' + p + ' — ' + e.message, 'lerr');
                }

                await sleep(20);
            }

            E.ppbar.style.width  = '100%';
            E.pppct.textContent  = '100%';
            E.ppok.textContent   = '✓ ' + fetched;
            E.ppfail.textContent = '✗ ' + errors;

            if (pdf && fetched > 0) {
                const fname = bookId + '_' + (volume || '1') + '_p' + pages[0] + '-p' + pages[pages.length-1] + '.pdf';
                E.pplabel.textContent = 'Saving…';
                pdf.save(fname);
                log('✓ Saved: ' + fname, 'lok');
                E.pplabel.textContent = 'Done!';
            } else {
                log('✗ No pages exported.', 'lerr');
                E.pplabel.textContent = 'Failed.';
            }

            setPdfRunning(false);
        }

        /* ── Diagnostics ─────────────────────────────── */
        async function runDiagnostics() {
            E.dbp.classList.add('on');
            E.dbp.innerHTML = '<span style="color:#6b7394">Running…</span>';
            E.diag.disabled = true;

            const rows = [];
            function row(label, val, cls) {
                cls = cls || '';
                rows.push('<div class="dr"><span class="dl">' + label + '</span><span class="dv ' + cls + '">' + val + '</span></div>');
            }
            function render() { E.dbp.innerHTML = rows.join(''); }

            row('URL', window.location.pathname);
            row('bookId', bookId || '⚠ empty', bookId ? '' : 'derr');
            row('volume', volume || '(none)');

            const meta = document.querySelector('meta[name="pageLabels"]');
            if (meta) {
                const n = meta.content.split(',').length;
                row('pageLabels', '✓ found — ' + n + ' pages', 'dok');
                if (!E.pages.value) { E.pages.value = n; E.pchip.textContent = n; }
            } else {
                row('pageLabels', '✗ not found', 'derr');
            }

            const jsPDF   = window.jspdf && window.jspdf.jsPDF;
            const svg2pdf = window.svg2pdf && (window.svg2pdf.svg2pdf || window.svg2pdf);
            row('jsPDF',   jsPDF   ? '✓ loaded' : '✗ not loaded', jsPDF   ? 'dok' : 'derr');
            row('svg2pdf', svg2pdf ? '✓ loaded' : '✗ not loaded', svg2pdf ? 'dok' : 'derr');

            const urlA = 'https://a.digi4school.at/ebook/' + bookId + '/' + volume + '/1.svg';
            const urlB = 'https://a.digi4school.at/ebook/' + bookId + '/1.svg';
            row('Probing A', '…/' + bookId + '/' + volume + '/1.svg', 'dwrn');
            render();

            let pattern = null;
            for (const pair of [['A', urlA], ['B', urlB]]) {
                if (pattern) break;
                const key = pair[0], url = pair[1];
                try {
                    const r = await fetch(url, { method: 'HEAD' });
                    if (r.ok) {
                        row('Pattern ' + key, '✓ HTTP ' + r.status, 'dok');
                        GM_setValue('pattern_' + bookId, key);
                        pattern = key;
                    } else {
                        row('Pattern ' + key, '✗ HTTP ' + r.status, 'derr');
                        if (key === 'A') { row('Probing B', '…/' + bookId + '/1.svg', 'dwrn'); render(); }
                    }
                } catch(e) { row('Pattern ' + key, '✗ ' + e.message, 'derr'); }
            }

            if (!pattern) {
                row('Auth', '✗ Both failed — session cookie missing?', 'derr');
                render(); E.diag.disabled = false; return;
            }
            row('Auth', '✓ Authenticated', 'dok');

            try {
                const txt = await fetch(pattern === 'A' ? urlA : urlB).then(function(r){ return r.text(); });
                if (!txt.includes('<svg')) {
                    row('SVG body', '✗ Got HTML, not SVG', 'derr');
                    render(); E.diag.disabled = false; return;
                }
                row('SVG body', '✓ Valid SVG', 'dok');
                const checks = [
                    ['paths',        !txt.includes('<path')        ? '— absent' : '✓ present',                    !txt.includes('<path') ? '' : 'dok'],
                    ['clipPath',     !txt.includes('clipPath')     ? '✓ absent' : '⚠ present (OK)',               txt.includes('clipPath') ? 'dwrn' : 'dok'],
                    ['filter',       !txt.includes('<filter')      ? '✓ absent' : '✗ present — may cause issues', txt.includes('<filter') ? 'derr' : 'dok'],
                    ['image',        !txt.includes('<image')       ? '✓ absent' : '⚠ raster embed',               txt.includes('<image') ? 'dwrn' : 'dok'],
                    ['text',         !txt.includes('<text')        ? '✓ paths only' : '⚠ raw text (font risk)',   txt.includes('<text') ? 'dwrn' : 'dok'],
                    ['foreignObject',!txt.includes('foreignObject')? '✓ absent' : '✗ present — will be dropped',  txt.includes('foreignObject') ? 'derr' : 'dok'],
                ];
                for (const c of checks) row('  ' + c[0], c[1], c[2]);

                const risky = txt.includes('<filter') || txt.includes('foreignObject');
                const mild  = txt.includes('<text');
                if      (risky) row('PDF verdict', '✗ Risky — use Python instead', 'derr');
                else if (mild)  row('PDF verdict', '⚠ Moderate — test range first', 'dwrn');
                else            row('PDF verdict', '✓ High confidence — safe to go', 'dok');
            } catch(e) { row('SVG fetch', '✗ ' + e.message, 'derr'); }

            render();
            E.diag.disabled = false;
            log('Diagnostics done.', 'linf');
        }

        /* ── Events ──────────────────────────────────── */
        E.tog.addEventListener('click', function() {
            const h = E.body.classList.toggle('hidden');
            E.tog.textContent = h ? '▼' : '▲';
        });

        E.save.addEventListener('click', function() {
            const v = parseInt(E.pages.value, 10);
            if (v > 0) {
                GM_setValue('pages_' + bookId + '_' + volume, v);
                E.pchip.textContent = v;
                E.save.textContent = '✓';
                setTimeout(function(){ E.save.textContent = 'Save'; }, 1200);
                log('Saved ' + v + ' pages.', 'linf');
            }
        });

        E.pdfAll.addEventListener('click', function() {
            const n = getPageCount();
            if (!n) { log('Set page count first.', 'lerr'); return; }
            exportPDF(Array.from({length: n}, function(_, i){ return i + 1; }));
        });

        E.pdfRange.addEventListener('click', function() {
            const from = parseInt(E.pdfFrom.value, 10), to = parseInt(E.pdfTo.value, 10);
            if (!from || !to || from > to) { log('Invalid range.', 'lerr'); return; }
            exportPDF(Array.from({length: to - from + 1}, function(_, i){ return from + i; }));
        });

        E.all.addEventListener('click', function() {
            const n = getPageCount();
            if (!n) { log('Set page count first.', 'lerr'); return; }
            runSvgBatch(Array.from({length: n}, function(_, i){ return i + 1; }));
        });

        E.pause.addEventListener('click', function() {
            isPaused = !isPaused;
            E.pause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
            log(isPaused ? 'Paused.' : 'Resumed.', 'linf');
        });

        E.stop.addEventListener('click', function() {
            abortFlag = true; isPaused = false;
            E.pause.textContent = '⏸ Pause';
        });

        E.range.addEventListener('click', function() {
            const from = parseInt(E.from.value, 10), to = parseInt(E.to.value, 10);
            if (!from || !to || from > to) { log('Invalid range.', 'lerr'); return; }
            runSvgBatch(Array.from({length: to - from + 1}, function(_, i){ return from + i; }));
        });

        E.dl1.addEventListener('click', function() {
            const p = parseInt(E.single.value, 10);
            if (!p || p < 1) { log('Enter a valid page.', 'lerr'); return; }
            log('Fetching SVG p' + p + '…', 'linf');
            dlSvg(p);
        });
        E.single.addEventListener('keydown', function(e){ if (e.key === 'Enter') E.dl1.click(); });

        E.diag.addEventListener('click', runDiagnostics);

        /* ── Draggable ───────────────────────────────── */
        let drag = false, ox = 0, oy = 0;
        $('d4s-hdr').addEventListener('mousedown', function(e) {
            drag = true;
            const r = panel.getBoundingClientRect();
            ox = e.clientX - r.left; oy = e.clientY - r.top;
        });
        document.addEventListener('mousemove', function(e) {
            if (!drag) return;
            panel.style.right = 'auto';
            panel.style.left  = (e.clientX - ox) + 'px';
            panel.style.top   = (e.clientY - oy) + 'px';
        });
        document.addEventListener('mouseup', function(){ drag = false; });

    } // end init()

    /* ── Wait for body then run ──────────────────────── */
    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})();
