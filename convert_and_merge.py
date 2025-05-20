import os
import shutil
import cairosvg
from PyPDF2 import PdfMerger

svg_dir = "svgs"
pdf_dir = "pdf_pages"
os.makedirs(pdf_dir, exist_ok=True)

svg_files = sorted(f for f in os.listdir(svg_dir) if f.endswith(".svg"))
pdf_files = []

for svg_file in svg_files:
    svg_path = os.path.join(svg_dir, svg_file)
    pdf_path = os.path.join(pdf_dir, svg_file.replace(".svg", ".pdf"))
    print(f"Konvertiere {svg_file} → {pdf_path}")
    cairosvg.svg2pdf(url=svg_path, write_to=pdf_path)
    pdf_files.append(pdf_path)

output_pdf = "merged_book.pdf"
merger = PdfMerger()

for pdf in pdf_files:
    merger.append(pdf)

merger.write(output_pdf)
merger.close()

print(f"✅ Fertige Datei: {output_pdf}")

shutil.rmtree(pdf_dir)
shutil.rmtree(svg_dir)
print("🧹 Temporäre Ordner wurden gelöscht.")
