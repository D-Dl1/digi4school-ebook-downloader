// ==UserScript==
// @name         Digi4School SVG-Downloader
// @namespace    https://digi4school.at/
// @version      1.0
// @description  Lädt alle Seiten eines E-Books im SVG-Format herunter
// @match        https://a.digi4school.at/ebook/*/*/index.html*
// @grant        GM_download
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const pageCount = 212;
    const delay = 300;
    
    const pathParts = window.location.pathname.split('/');
    const bookId = pathParts[2];
    const volume = pathParts[3];

    const button = document.createElement('button');
    button.textContent = '📥 Gesamtes Buch herunterladen';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '9999';
    button.style.padding = '10px';
    button.style.background = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    document.body.appendChild(button);

    button.onclick = async function () {
        for (let i = 1; i <= pageCount; i++) {
            const page = i.toString();
            const url = `https://a.digi4school.at/ebook/${bookId}/${volume}/${page}.svg`;
            const filename = `${bookId}_${volume}_${page.padStart(3, '0')}.svg`;

            console.log(`Lade ${url}`);
            try {
                GM_download({
                    url: url,
                    name: filename,
                    onerror: e => console.error(`Fehler beim Herunterladen von ${url}`, e)
                });
            } catch (e) {
                console.error(`Fehler bei ${url}`, e);
            }
            await new Promise(r => setTimeout(r, delay));
        }
    };
})();
