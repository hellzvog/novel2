import type { ParsedParagraph } from "./docx";

export interface ParsedTxt {
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

const CHINESE_NUMERALS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseChineseNumber(text: string): number | null {
  if (/^\d+$/.test(text)) return parseInt(text, 10);
  if (text.length === 1 && text in CHINESE_NUMERALS) return CHINESE_NUMERALS[text];
  if (text.startsWith("十") && text.length === 2) return 10 + (CHINESE_NUMERALS[text[1]] ?? 0);
  if (text.endsWith("十") && text.length === 2) return (CHINESE_NUMERALS[text[0]] ?? 0) * 10;
  if (text.length === 3 && text[1] === "十") {
    return (CHINESE_NUMERALS[text[0]] ?? 0) * 10 + (CHINESE_NUMERALS[text[2]] ?? 0);
  }
  return null;
}

interface HeadingInfo {
  number: number | null;
  title: string;
}

function detectHeading(line: string): HeadingInfo {
  const trimmed = line.trim();

  // English: "Chapter 1 Street Performance" or "Chapter 1: Street Performance"
  const enMatch = trimmed.match(/^chapter\s*(\d+)\s*[:：.\-—\s]\s*(.*)$/i);
  if (enMatch) {
    return { number: parseInt(enMatch[1], 10), title: enMatch[2].trim() };
  }
  // "Chapter 1" with no title
  const enOnly = trimmed.match(/^chapter\s*(\d+)\s*$/i);
  if (enOnly) {
    return { number: parseInt(enOnly[1], 10), title: "" };
  }

  // Chinese: "第1章 街頭賣藝" or "第一章 街頭賣藝"
  const zhMatch = trimmed.match(/^第\s*([0-9零一二两三四五六七八九十]+)\s*章\s*(.*)$/);
  if (zhMatch) {
    const num = parseChineseNumber(zhMatch[1]);
    return { number: num, title: zhMatch[2].trim() };
  }

  // Fallback: try to extract a leading number from any heading-like line
  const genericNum = trimmed.match(/^[\s#*\-]*([0-9]+)[\s.:、\-—#]*(.*)$/);
  if (genericNum) {
    return { number: parseInt(genericNum[1], 10), title: genericNum[2].trim() };
  }

  return { number: null, title: trimmed };
}

export async function parseTxt(file: File): Promise<ParsedTxt> {
  const text = await file.text();
  return parseTxtString(text, file.name);
}

export function parseTxtString(text: string, fileName: string): ParsedTxt {
  // Normalize line endings, split into lines
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // Find first non-empty line = heading
  let headingIdx = 0;
  while (headingIdx < lines.length && lines[headingIdx].trim() === "") {
    headingIdx++;
  }

  let detectedTitle: string | null = null;
  let detectedNumber: number | null = null;
  let bodyStart = 0;

  if (headingIdx < lines.length) {
    const heading = detectHeading(lines[headingIdx]);
    detectedTitle = heading.title || null;
    detectedNumber = heading.number;
    bodyStart = headingIdx + 1;
  }

  // If heading detection found no number, try filename
  if (detectedNumber === null) {
    const nameMatch = fileName.match(/(\d+)/);
    if (nameMatch) detectedNumber = parseInt(nameMatch[1], 10);
  }

  // If still no title, use filename (without extension)
  if (!detectedTitle) {
    detectedTitle = fileName.replace(/\.txt$/i, "").replace(/^[0-9]+[_\-\s]*/, "");
  }

  // Split body into paragraphs on blank lines, preserving text exactly
  const paragraphs: ParsedParagraph[] = [];
  let current: string[] = [];

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      if (current.length > 0) {
        const para = current.join("\n");
        paragraphs.push({ text: para, html: escapeHtml(para), style: "normal" });
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    const para = current.join("\n");
    paragraphs.push({ text: para, html: escapeHtml(para), style: "normal" });
  }

  return { paragraphs, detectedTitle, detectedNumber };
}
