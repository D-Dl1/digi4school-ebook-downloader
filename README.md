# digi4school-ebook-downloader
2025 The latest available digi4school ebook downloader

digi4school-downloader/
│
├── userscript/
│   └── digi4school-svg-downloader.user.js     ← 油猴脚本（注释：中文）
│
├── svg2pdf/
│   ├── convert_and_merge.py                   ← Python 脚本（注释：中文）
│   └── requirements.txt                       ← pip依赖
│
├── svgs/                                      ← 下载后的 SVG 存储目录
├── pdf_pages/                                 ← 中间 PDF 页（自动生成）
├── merged_book.pdf                            ← 最终输出 PDF
│
├── .gitignore
└── README.md                                  ← 全德语文档

# 📘 Digi4School Downloader Werkzeugkasten

Ein inoffizielles Toolset zum Herunterladen und Konvertieren von digi4school.at-E-Books.  
Dieses Projekt ermöglicht das automatische Herunterladen aller Seiten eines digitalen Schulbuchs im `.svg`-Format und deren Konvertierung zu einer einzigen `.pdf`-Datei zur Offline-Nutzung.

---

## ✨ Funktionen

- 🖱️ Tampermonkey-Button im Browser zum Herunterladen aller Seiten
- 📄 Automatisches Speichern der Seiten als `.svg`-Dateien
- 🐍 Python-Skript zur Konvertierung jeder `.svg`-Datei in `.pdf`
- 📘 Automatisches Zusammenführen zu einem vollständigen Buch
- 🔒 Vollständig lokal – kein Zugriff auf API oder interne Schnittstellen notwendig

---

## 📥 Anwendung

### 1. SVG-Dateien im Browser herunterladen (mit Tampermonkey)

#### Voraussetzungen

- [✔] Installierter Browser (z. B. Chrome, Firefox)
- [✔] Erweiterung [Tampermonkey](https://www.tampermonkey.net/)

#### Schritte

1. Öffne Tampermonkey > Neues Userscript erstellen
2. Füge den Code aus [`userscript/digi4school-svg-downloader.user.js`](./userscript/digi4school-svg-downloader.user.js) ein und speichere
3. Besuche deine Schulbuch-Seite auf digi4school, z. B.:
https://a.digi4school.at/ebook/5819/1/index.html
4. Rechts oben erscheint ein Button: **📥 Gesamtes Buch herunterladen**
5. Alle `.svg`-Dateien werden automatisch heruntergeladen (je nach Browser in deinen Standard-Downloadordner)
6. Verschiebe alle Dateien in einen Ordner `svgs/`

---

### 2. SVG zu PDF konvertieren & zusammenführen (Python)

#### Voraussetzungen

- [✔] Python 3.7+
- [✔] `pip` Paketmanager

#### Schritte

1. Wechsle ins `svg2pdf/`-Verzeichnis
2. Installiere die Abhängigkeiten:
```bash
pip install -r requirements.txt
```
3. Starte das Skript:
```bash
python convert_and_merge.py
```
4. Die finale Datei merged_book.pdf wird im Hauptverzeichnis erstellt

---

## 📝 Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](https://opensource.org/licenses/MIT) – frei zur Nutzung, Modifikation und Weitergabe unter Beibehaltung der Lizenzinformationen.

---

## ⚖️ Rechtlicher Hinweis

Dieses Projekt ist **ausschließlich für Forschungs-, Lern- und Demonstrationszwecke** gedacht.  
Es darf **nicht verwendet werden, um urheberrechtlich geschützte Inhalte herunterzuladen oder zu verbreiten**.

Der Quellcode dient lediglich dazu, den Umgang mit SVG-Dateien, Browserautomatisierung und PDF-Erstellung zu demonstrieren.  
Der Einsatz dieses Codes zum Herunterladen oder Speichern von Materialien aus digi4school.at oder anderen Plattformen ist **ausdrücklich untersagt**.

Die Entwickler dieses Projekts übernehmen keinerlei Verantwortung für missbräuchliche Verwendung.
