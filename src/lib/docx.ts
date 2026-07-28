import mammoth from "mammoth";

export interface ParsedParagraph {
  text: string;
  html: string;
  style: string;
}

export interface ParsedDocx {
  paragraphs: ParsedParagraph[];
  detectedTitle: string | null;
  detectedNumber: number | null;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export async function parseDocx(file: File | ArrayBuffer): Promise<ParsedDocx> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const container = document.createElement("div");
  container.innerHTML = result.value;

  const paragraphs: ParsedParagraph[] = [];
  let detectedTitle: string | null = null;
  let detectedNumber: number | null = null;

  for (const el of Array.from(container.children)) {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || "").trim();
    if (!text) continue;

    let style = "normal";
    if (tag === "h1" || tag === "h2") style = "heading";
    else if (tag === "h3" || tag === "h4") style = "subheading";

    const html = el.innerHTML.trim();

    if (style === "heading" && !detectedTitle) {
      detectedTitle = text;
      const m = text.match(/(?:chapter\s*)?(\d+)/i);
      if (m) detectedNumber = parseInt(m[1], 10);
    }

    paragraphs.push({ text, html, style });
  }

  if (paragraphs.length === 0) {
    const raw = await mammoth.extractRawText({ arrayBuffer });
    const lines = raw.value.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    for (const line of lines) {
      paragraphs.push({ text: line, html: escapeHtml(line), style: "normal" });
    }
  }

  if (detectedNumber === null) {
    const nameNum = file instanceof File
      ? (file.name.match(/(\d+)/)?.[1] ?? null)
      : null;
    if (nameNum) detectedNumber = parseInt(nameNum, 10);
  }

  return { paragraphs, detectedTitle, detectedNumber };
}

export function paragraphsToContent(paragraphs: ParsedParagraph[]): string[] {
  return paragraphs.map((p) => p.html);
}

export function paragraphsToPreviewHtml(paragraphs: ParsedParagraph[]): string {
  return paragraphs
    .map((p) => {
      if (p.style === "heading") return `<h2 class="font-serif text-lg font-bold mt-4 mb-2">${p.html}</h2>`;
      if (p.style === "subheading") return `<h3 class="font-serif text-base font-semibold mt-3 mb-1">${p.html}</h3>`;
      return `<p class="mb-3 leading-relaxed">${p.html}</p>`;
    })
    .join("\n");
}
