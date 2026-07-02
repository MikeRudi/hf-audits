#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AUDITS_DIR = path.join(ROOT, "audits");
const OUT_DIR = path.join(ROOT, "figma-ready");
const TEXT_DIR = path.join(OUT_DIR, "text");
const SVG_DIR = path.join(OUT_DIR, "svg");
const COMBINED_TEXT = path.join(OUT_DIR, "all-audits-figma-copy.txt");
const COMBINED_SVG = path.join(OUT_DIR, "all-audits-figma-board.svg");

fs.mkdirSync(TEXT_DIR, { recursive: true });
fs.mkdirSync(SVG_DIR, { recursive: true });

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toFigmaText(markdown) {
  return markdown
    .replace(/^# (.+)$/gm, "$1")
    .replace(/^## (.+)$/gm, "$1")
    .replace(/^### (.+)$/gm, "$1")
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

function wrapLine(line, maxChars) {
  if (!line.trim()) return [""];
  const words = line.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function lineKind(line) {
  if (!line.trim()) return "blank";
  if (/^[A-Za-z0-9 .&-]+ Website Audit$/.test(line)) return "title";
  if (/^(Audit Summary|Messaging Direction|Performance|Style & Site Experience|Animation & Interactions|Code & Third-Party Scripts|Asset & Media Performance|SEO & Crawlability|Website Standards)$/.test(line)) return "section";
  if (/^(Speed Test Scores|Main Performance Issues|Main Issues|The Affects|The Fixes|Messaging Notes:|Main opportunities:)$/.test(line)) return "subhead";
  if (/^\[\d+\]/.test(line)) return "issue";
  if (/^\d+\.\s/.test(line)) return "numbered";
  if (/^(Website|Company|Contact|Email|Audit Date|Audited By):/.test(line)) return "meta";
  return "body";
}

function kindStyle(kind) {
  switch (kind) {
    case "title":
      return { size: 30, weight: 700, fill: "#111827", gapBefore: 0, lineHeight: 40 };
    case "section":
      return { size: 22, weight: 700, fill: "#111827", gapBefore: 24, lineHeight: 31 };
    case "subhead":
      return { size: 16, weight: 700, fill: "#1f2937", gapBefore: 14, lineHeight: 24 };
    case "issue":
      return { size: 15, weight: 500, fill: "#111827", gapBefore: 5, lineHeight: 22 };
    case "numbered":
    case "meta":
      return { size: 15, weight: 500, fill: "#374151", gapBefore: 4, lineHeight: 22 };
    default:
      return { size: 15, weight: 400, fill: "#374151", gapBefore: 4, lineHeight: 22 };
  }
}

function textToSvg(text, title, yOffset = 0) {
  const width = 1280;
  const marginX = 72;
  const maxChars = 100;
  let y = 72 + yOffset;
  const chunks = [];

  for (const rawLine of text.split("\n")) {
    const kind = lineKind(rawLine);
    if (kind === "blank") {
      y += 10;
      continue;
    }
    const style = kindStyle(kind);
    y += style.gapBefore;
    const wrapped = wrapLine(rawLine, maxChars);

    for (const line of wrapped) {
      chunks.push(
        `<text x="${marginX}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${style.size}" font-weight="${style.weight}" fill="${style.fill}">${escapeXml(line)}</text>`
      );
      y += style.lineHeight;
    }
  }

  const height = y + 72 - yOffset;
  return {
    width,
    height,
    body: chunks.join("\n"),
    svg: [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
      `<rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="0" fill="#ffffff" stroke="#e5e7eb"/>`,
      `<title>${escapeXml(title)}</title>`,
      chunks.join("\n"),
      "</svg>",
      "",
    ].join("\n"),
  };
}

const auditFiles = fs
  .readdirSync(AUDITS_DIR)
  .filter((file) => file.endsWith("-audit.txt"))
  .sort();

const combinedTextParts = [];
const boardParts = [];
let boardY = 0;
let maxBoardWidth = 0;

for (const file of auditFiles) {
  const slug = file.replace(/\.txt$/, "");
  const markdown = fs.readFileSync(path.join(AUDITS_DIR, file), "utf8");
  const figmaText = toFigmaText(markdown);
  const title = figmaText.split("\n")[0] || slug;
  const svg = textToSvg(figmaText, title);

  fs.writeFileSync(path.join(TEXT_DIR, `${slug}.figma.txt`), figmaText, "utf8");
  fs.writeFileSync(path.join(SVG_DIR, `${slug}.svg`), svg.svg, "utf8");

  combinedTextParts.push(figmaText.trimEnd());
  boardParts.push(`<g transform="translate(0 ${boardY})">\n${svg.body}\n</g>`);
  boardY += svg.height + 120;
  maxBoardWidth = Math.max(maxBoardWidth, svg.width);
}

fs.writeFileSync(COMBINED_TEXT, combinedTextParts.join("\n\n\n"), "utf8");

const combinedSvg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${maxBoardWidth}" height="${boardY}" viewBox="0 0 ${maxBoardWidth} ${boardY}">`,
  `<rect width="${maxBoardWidth}" height="${boardY}" fill="#f3f4f6"/>`,
  boardParts.join("\n"),
  "</svg>",
  "",
].join("\n");

fs.writeFileSync(COMBINED_SVG, combinedSvg, "utf8");

console.log(`Exported ${auditFiles.length} Figma text files to ${path.relative(ROOT, TEXT_DIR)}`);
console.log(`Exported ${auditFiles.length} SVG files to ${path.relative(ROOT, SVG_DIR)}`);
console.log(`Combined text: ${path.relative(ROOT, COMBINED_TEXT)}`);
console.log(`Combined SVG board: ${path.relative(ROOT, COMBINED_SVG)}`);
