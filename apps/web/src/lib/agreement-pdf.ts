import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfSection = { title: string; lines: string[] };

const ink = rgb(0.11, 0.07, 0.19);
const muted = rgb(0.43, 0.39, 0.5);
const accent = rgb(109 / 255, 40 / 255, 216 / 255);

export async function downloadAgreementPdf(input: {
  brand: string;
  title: string;
  sections: PdfSection[];
  footer: string;
  filename: string;
}): Promise<void> {
  const [regularBytes, boldBytes] = await Promise.all([
    fetch("/fonts/NotoSans-Regular.ttf").then((response) => {
      if (!response.ok) throw new Error("font");
      return response.arrayBuffer();
    }),
    fetch("/fonts/NotoSans-Bold.ttf").then((response) => {
      if (!response.ok) throw new Error("font");
      return response.arrayBuffer();
    }),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  pdf.setTitle(input.title);
  pdf.setAuthor(input.brand);
  pdf.setCreator(input.brand);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function nextPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawText(input.brand, { x: margin, y: y - 11, size: 11, font: bold, color: accent });
    y -= 28;
  }

  function ensure(height: number) {
    if (y - height < margin) nextPage();
  }

  function wrap(text: string, font: PDFFont, size: number): string[] {
    const rows: string[] = [];
    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = "";
      const pushWord = (word: string) => {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          line = next;
          return;
        }
        if (line) rows.push(line);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
          line = word;
          return;
        }
        let chunk = "";
        for (const char of word) {
          const grown = chunk + char;
          if (font.widthOfTextAtSize(grown, size) > maxWidth && chunk) {
            rows.push(chunk);
            chunk = char;
          } else {
            chunk = grown;
          }
        }
        line = chunk;
      };
      for (const word of words) pushWord(word);
      rows.push(line);
      line = "";
    }
    return rows.length ? rows : [""];
  }

  function write(text: string, font: PDFFont, size: number, color = ink, gap = 4) {
    for (const row of wrap(text, font, size)) {
      ensure(size + gap);
      page.drawText(row, { x: margin, y: y - size, size, font, color });
      y -= size + gap;
    }
  }

  write(input.brand, bold, 12, accent, 8);
  write(input.title, bold, 20, ink, 14);
  for (const section of input.sections) {
    y -= 8;
    write(section.title, bold, 12, accent, 6);
    for (const line of section.lines) write(line, regular, 11, ink, 4);
  }
  y -= 16;
  write(input.footer, regular, 9, muted, 3);

  const bytes = await pdf.save();
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
