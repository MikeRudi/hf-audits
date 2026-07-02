#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AUDITS_DIR = path.join(ROOT, "audits");
const OUT_DIR = path.join(ROOT, "app", "data");
const OUT_FILE = path.join(OUT_DIR, "audits.json");

const SECTION_TITLES = [
  "Audit Summary",
  "Messaging Direction",
  "Performance",
  "Style & Site Experience",
  "Animation & Interactions",
  "Code & Third-Party Scripts",
  "Asset & Media Performance",
  "SEO & Crawlability",
  "Website Standards",
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function unique(values) {
  return [...new Set(values.filter((v) => v && v.trim()))];
}

function parseBlockLines(block) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readBetween(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return "";
  const sliced = text.slice(start);
  const end = sliced.search(endPattern);
  return end < 0 ? sliced : sliced.slice(0, end);
}

function parseMeta(text) {
  const firstLine = text.split("\n")[0].replace(/^#\s*/, "").trim();
  const get = (label) => (text.match(new RegExp(`^${label}:\\s*(.+)$`, "m")) || [])[1] || "";
  return {
    title: firstLine,
    website: get("Website"),
    company: get("Company"),
    contact: get("Contact"),
    email: get("Email"),
    auditDate: get("Audit Date"),
    auditedBy: get("Audited By"),
  };
}

function parseSubsection(sectionText, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sectionText.match(new RegExp(`### ${escaped}\\n\\n([\\s\\S]*?)(?=\\n### |$)`));
  return match ? parseBlockLines(match[1]) : [];
}

function parseSection(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`## ${escaped}\\n\\n([\\s\\S]*?)(?=\\n---\\n\\n## |$)`));
  if (!match) return null;
  const sectionText = match[1].trim();
  return {
    title,
    raw: sectionText,
    mainIssues: parseSubsection(sectionText, title === "Performance" ? "Main Performance Issues" : "Main Issues"),
    affects: parseSubsection(sectionText, "The Affects"),
    fixes: parseSubsection(sectionText, "The Fixes"),
    speedScores: parseSubsection(sectionText, "Speed Test Scores"),
  };
}

function parseSummary(text) {
  const block = readBetween(text, /## Audit Summary/, /\n---\n\n## Messaging Direction/);
  const opportunitiesMatch = block.match(/Main opportunities:\n\n([\s\S]*)/);
  const opportunities = opportunitiesMatch
    ? opportunitiesMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
    : [];
  return {
    intro: (block.match(/public-facing perspective\.\n\n([\s\S]*?)\n\nMain opportunities:/) || [])[1] || "",
    opportunities,
  };
}

function parseMessaging(text) {
  const block = readBetween(text, /## Messaging Direction/, /\n---\n\n## Performance/);
  return {
    model: (block.match(/Recommended messaging model:\s*(.+)/) || [])[1] || "",
    notes: (block.match(/Messaging Notes:\n\n([\s\S]*)/) || [])[1]?.trim() || "",
  };
}

function parseAudit(file) {
  const text = fs.readFileSync(path.join(AUDITS_DIR, file), "utf8");
  const meta = parseMeta(text);
  const sections = SECTION_TITLES.map((title) => parseSection(text, title)).filter(Boolean);
  return {
    id: slugify(meta.company || file.replace(/-audit\.txt$/, "")),
    file,
    meta,
    summary: parseSummary(text),
    messaging: parseMessaging(text),
    sections,
    sourceText: text,
  };
}

function makeOptionBank(audits) {
  const sectionBank = {};
  for (const title of SECTION_TITLES) {
    sectionBank[title] = {
      mainIssues: [],
      affects: [],
      fixes: [],
      speedScores: [],
    };
  }

  const summaryOpportunities = [];
  const messagingModels = [];
  const messagingNotes = [];

  for (const audit of audits) {
    summaryOpportunities.push(...audit.summary.opportunities);
    if (audit.messaging.model) messagingModels.push(audit.messaging.model);
    if (audit.messaging.notes) messagingNotes.push(audit.messaging.notes);

    for (const section of audit.sections) {
      const bank = sectionBank[section.title];
      if (!bank) continue;
      bank.mainIssues.push(...section.mainIssues);
      bank.affects.push(...section.affects);
      bank.fixes.push(...section.fixes);
      bank.speedScores.push(...section.speedScores);
    }
  }

  for (const bank of Object.values(sectionBank)) {
    for (const key of Object.keys(bank)) bank[key] = unique(bank[key]).sort();
  }

  return {
    summaryOpportunities: unique(summaryOpportunities).sort(),
    messagingModels: unique(messagingModels).sort(),
    messagingNotes: unique(messagingNotes).sort(),
    sections: sectionBank,
  };
}

const files = fs
  .readdirSync(AUDITS_DIR)
  .filter((file) => file.endsWith("-audit.txt"))
  .sort();

const audits = files.map(parseAudit);
const data = {
  generatedAt: new Date().toISOString(),
  auditCount: audits.length,
  sectionTitles: SECTION_TITLES,
  audits,
  optionBank: makeOptionBank(audits),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} with ${audits.length} audits.`);
