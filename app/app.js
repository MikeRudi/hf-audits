const data = await loadInitialData();

const SECTION_ORDER = [
  "Performance",
  "Style & Site Experience",
  "Animation & Interactions",
  "Code & Third-Party Scripts",
  "Asset & Media Performance",
  "SEO & Crawlability",
  "Website Standards",
];

const CATEGORY_LABELS = {
  mainIssues: "Main Issues",
  affects: "The Affects",
  fixes: "The Fixes",
  speedScores: "Speed Test Scores",
};

const storageKey = "audit-builder-state-v1";
const manualScoresKey = "audit-manual-scores-v1";
const optionBankKey = "audit-option-bank-v1";
const savedAuditsKey = "audit-saved-audits-v1";
const SCORE_LABELS = ["Performance", "Accessibility", "Best Practices", "SEO"];
let remoteSaveTimer;
let auditSaveTimer;
let remoteSaveFailed = false;

const state = {
  activeAuditId: data.audits[0]?.id,
  activeView: "frames",
  auditSearch: "",
  librarySection: "Performance",
  optionSearch: "",
  editMode: false,
  libraryEditMode: false,
  builder: loadBuilder(),
  manualScores: loadManualScores(),
  optionBank: loadOptionBank(),
  savedAudits: loadSavedAudits(),
};

const els = {
  app: document.querySelector("#app"),
  pageTitle: document.querySelector("#pageTitle"),
  auditSearch: document.querySelector("#auditSearch"),
  auditList: document.querySelector("#auditList"),
  auditCountLabel: document.querySelector("#auditCountLabel"),
  framesView: document.querySelector("#framesView"),
  libraryView: document.querySelector("#libraryView"),
  builderView: document.querySelector("#builderView"),
  copyAuditBtn: document.querySelector("#copyAuditBtn"),
  editAuditBtn: document.querySelector("#editAuditBtn"),
  seedBuilderBtn: document.querySelector("#seedBuilderBtn"),
  exportPdfBtn: document.querySelector("#exportPdfBtn"),
  resetBuilderBtn: document.querySelector("#resetBuilderBtn"),
  exportBuilderBtn: document.querySelector("#exportBuilderBtn"),
};

async function loadInitialData() {
  const seedResponse = await fetch(new URL("./data/audits.json", import.meta.url));
  const seed = await seedResponse.json();

  try {
    const response = await fetch("/api/state", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Remote state is unavailable");
    const remote = await response.json();
    return {
      ...seed,
      ...remote,
      audits: Array.isArray(remote.audits) ? remote.audits : seed.audits,
      optionBank: remote.optionBank?.sections ? remote.optionBank : seed.optionBank,
      manualScores: remote.manualScores || {},
      remoteEnabled: Boolean(remote.databaseReady),
    };
  } catch {
    return {
      ...seed,
      manualScores: {},
      remoteEnabled: false,
    };
  }
}

function blankBuilder() {
  const sections = {};
  for (const title of SECTION_ORDER) {
    sections[title] = {
      mainIssues: [],
      affects: [],
      fixes: [],
      speedScores: [],
    };
  }

  return {
    meta: {
      company: "New Company",
      website: "https://",
      contact: "",
      email: "",
      auditDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      auditedBy: "",
    },
    summaryOpportunities: [],
    messaging: {
      model: "",
      notes: "",
    },
    sections,
  };
}

function loadBuilder() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.sections) {
      if (saved.meta?.company === "New Company" && saved.meta?.auditedBy === "Codex") saved.meta.auditedBy = "";
      if (saved.meta?.company === "New Company" && saved.messaging?.model === "Platform-Led") saved.messaging.model = "";
      return saved;
    }
  } catch {
    // Ignore invalid saved state.
  }
  return blankBuilder();
}

function loadManualScores() {
  if (data.remoteEnabled) return data.manualScores || {};
  try {
    const saved = JSON.parse(localStorage.getItem(manualScoresKey));
    if (saved && typeof saved === "object") return saved;
  } catch {
    // Ignore invalid saved state.
  }
  return {};
}

function loadOptionBank() {
  if (data.remoteEnabled) return JSON.parse(JSON.stringify(data.optionBank));
  try {
    const saved = JSON.parse(localStorage.getItem(optionBankKey));
    if (saved?.sections) return saved;
  } catch {
    // Ignore invalid saved state.
  }
  return JSON.parse(JSON.stringify(data.optionBank));
}

function loadSavedAudits() {
  if (data.remoteEnabled) return [];
  try {
    const saved = JSON.parse(localStorage.getItem(savedAuditsKey));
    if (Array.isArray(saved)) return saved;
  } catch {
    // Ignore invalid saved state.
  }
  return [];
}

function saveBuilder() {
  localStorage.setItem(storageKey, JSON.stringify(state.builder));
}

function saveManualScores() {
  localStorage.setItem(manualScoresKey, JSON.stringify(state.manualScores));
  persistRemoteStateSoon();
}

function saveOptionBank() {
  localStorage.setItem(optionBankKey, JSON.stringify(state.optionBank));
  persistRemoteStateSoon();
}

function saveSavedAudits() {
  localStorage.setItem(savedAuditsKey, JSON.stringify(state.savedAudits));
  persistRemoteStateSoon();
}

function remoteStatePayload() {
  return {
    audits: data.remoteEnabled ? data.audits : allAudits(),
    optionBank: state.optionBank,
    manualScores: state.manualScores,
  };
}

function persistRemoteStateSoon() {
  if (!data.remoteEnabled) return;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(() => {
    persistRemoteState();
  }, 450);
}

function persistAuditSoon(audit) {
  if (!data.remoteEnabled || !audit) return;
  window.clearTimeout(auditSaveTimer);
  auditSaveTimer = window.setTimeout(() => {
    persistAudit(audit);
  }, 600);
}

async function persistRemoteState() {
  if (!data.remoteEnabled) return;

  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(remoteStatePayload()),
    });
    if (!response.ok) throw new Error("Remote save failed");
    remoteSaveFailed = false;
  } catch {
    if (!remoteSaveFailed) {
      remoteSaveFailed = true;
      showToast("Remote save failed");
    }
  }
}

function upsertLocalAudit(audit) {
  if (data.remoteEnabled) {
    data.audits = data.audits.filter((item) => item.id !== audit.id);
    data.audits.push(audit);
  } else {
    state.savedAudits = state.savedAudits.filter((item) => item.id !== audit.id);
    state.savedAudits.push(audit);
    saveSavedAudits();
  }
}

async function persistAudit(audit) {
  if (!data.remoteEnabled) return;
  try {
    const response = await fetch("/api/audits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(audit),
    });
    if (!response.ok) throw new Error("Audit save failed");
    remoteSaveFailed = false;
  } catch {
    if (!remoteSaveFailed) {
      remoteSaveFailed = true;
      showToast("Remote save failed");
    }
  }
}

function allAudits() {
  return [...data.audits, ...state.savedAudits];
}

function activeAudit() {
  return allAudits().find((audit) => audit.id === state.activeAuditId) || allAudits()[0];
}

function sectionOf(audit, title) {
  return audit.sections.find((section) => section.title === title);
}

function linesWithoutEmpty(lines) {
  return (lines || []).filter((line) => line && line.trim());
}

function parseMetric(section, label) {
  const line = section?.speedScores?.find((item) => item.startsWith(`${label}:`));
  return line ? line.split(":").slice(1).join(":").trim() : "N/A";
}

function metricNumber(audit, label) {
  const raw = parseMetric(sectionOf(audit, "Performance"), label);
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hasUsefulLine(line) {
  const text = String(line || "").toLowerCase();
  return Boolean(text.trim()) && !text.includes("no major issue") && !text.includes("no specific");
}

function usefulCount(lines) {
  return linesWithoutEmpty(lines).filter(hasUsefulLine).length;
}

function subjectiveDefaults(audit) {
  const lookIssueCount =
    usefulCount(sectionOf(audit, "Style & Site Experience")?.mainIssues) +
    usefulCount(sectionOf(audit, "Website Standards")?.mainIssues);
  const animationIssueCount = usefulCount(sectionOf(audit, "Animation & Interactions")?.mainIssues);
  return {
    lookAndFeel: clamp(Math.round(100 - lookIssueCount * 7), 35, 100),
    animation: clamp(Math.round(100 - animationIssueCount * 12), 35, 100),
  };
}

function manualScore(audit, key, fallback) {
  const saved = Number(state.manualScores[audit.id]?.[key]);
  return Number.isFinite(saved) ? saved : fallback;
}

function factorScores(audit) {
  const performance = metricNumber(audit, "Performance");
  const seo = metricNumber(audit, "SEO");
  const defaults = subjectiveDefaults(audit);
  const lookAndFeel = manualScore(audit, "lookAndFeel", defaults.lookAndFeel);
  const animation = manualScore(audit, "animation", defaults.animation);
  const overall = Math.round(performance * 0.4 + seo * 0.2 + lookAndFeel * 0.2 + animation * 0.2);

  return {
    overall,
    performance,
    seo,
    lookAndFeel,
    animation,
  };
}

function scoreClass(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (number < 60) return "bad";
  if (number < 80) return "warn";
  return "";
}

function setScoreClass(element, baseClass, value) {
  if (!element) return;
  element.className = [baseClass, scoreClass(value)].filter(Boolean).join(" ");
}

function updateRenderedScores(audit, input) {
  const scores = factorScores(audit);
  const overall = document.querySelector(".overall-score");
  const overallValue = overall?.querySelector("strong");
  setScoreClass(overall, "overall-score", scores.overall);
  if (overallValue) overallValue.textContent = scores.overall;

  const row = Array.from(els.auditList.querySelectorAll("[data-audit-id]")).find(
    (button) => button.dataset.auditId === audit.id,
  );
  const rowScore = row?.querySelector(".score-pill");
  setScoreClass(rowScore, "score-pill", scores.overall);
  if (rowScore) rowScore.textContent = scores.overall;

  const card = input?.closest(".factor-card");
  if (card) {
    card.className = ["factor-card", "is-editable", scoreClass(input.value)].filter(Boolean).join(" ");
  }
}

function updateManualScore(input, normalize = false) {
  const audit = allAudits().find((item) => item.id === input.dataset.scoreAuditId);
  if (!audit) return;
  const number = Number(input.value);
  if (!Number.isFinite(number)) return;
  const value = clamp(Math.round(number), 0, 100);
  if (normalize) input.value = value;
  state.manualScores[audit.id] = {
    ...(state.manualScores[audit.id] || {}),
    [input.dataset.scoreField]: value,
  };
  saveManualScores();
  updateRenderedScores(audit, input);
}

function stripIssueId(line) {
  return line.replace(/^\[(\d+)\]\s*/, "");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 220);
  }, 1800);
}

async function copyText(text, message) {
  await navigator.clipboard.writeText(text);
  showToast(message);
}

function currentAuditText() {
  const frame = els.framesView.querySelector(".audit-frame");
  return frame?.innerText.replace(/\n{3,}/g, "\n\n").trim() || activeAudit().sourceText;
}

function applyEditMode() {
  const frame = els.framesView.querySelector(".audit-frame");
  if (!frame) return;
  frame.classList.toggle("is-editing", state.editMode);
  const editableSelectors = [
    "[data-edit-meta]",
    "[data-edit-summary-index]",
    "[data-edit-messaging]",
    "[data-edit-section-title]",
  ].join(",");

  for (const element of frame.querySelectorAll(editableSelectors)) {
    if (state.editMode) {
      element.setAttribute("contenteditable", "true");
      element.setAttribute("spellcheck", "true");
    } else {
      element.removeAttribute("contenteditable");
      element.removeAttribute("spellcheck");
    }
  }
}

function preparePrintPage() {
  const existing = document.querySelector("#dynamicPrintSize");
  if (existing) existing.remove();

  const frame = els.framesView.querySelector(".audit-frame");
  if (!frame) return;

  const printScale = 0.5;
  const pageWidthMm = 210;
  const marginMm = 10;
  const availableWidthMm = pageWidthMm - marginMm * 2;
  const contentWidthPx = frame.scrollWidth || frame.getBoundingClientRect().width;
  const contentHeightPx = frame.scrollHeight || frame.getBoundingClientRect().height;
  const pxPerMm = contentWidthPx / availableWidthMm;
  const contentHeightMm = (contentHeightPx * printScale) / pxPerMm;
  const pageHeightMm = Math.ceil(contentHeightMm + marginMm * 2 + 12);

  const style = document.createElement("style");
  style.id = "dynamicPrintSize";
  style.textContent = `
    @media print {
      @page {
        size: ${pageWidthMm}mm ${pageHeightMm}mm;
        margin: ${marginMm}mm;
      }
    }
  `;
  document.head.appendChild(style);
}

function updateAuditFromEditable(element) {
  if (!state.editMode) return;
  const audit = activeAudit();
  if (!audit) return;
  const text = element.textContent.trim();

  if (element.dataset.editMeta) {
    audit.meta[element.dataset.editMeta] = text;
    if (element.dataset.editMeta === "company") {
      audit.meta.title = `${text} Website Audit`;
    }
  }

  if (element.dataset.editSummaryIndex) {
    audit.summary.opportunities[Number(element.dataset.editSummaryIndex)] = text;
  }

  if (element.dataset.editMessaging) {
    audit.messaging[element.dataset.editMessaging] = text;
  }

  if (element.dataset.editSectionTitle) {
    const section = sectionOf(audit, element.dataset.editSectionTitle);
    const category = element.dataset.editSectionCategory;
    const index = Number(element.dataset.editSectionIndex);
    if (section?.[category]?.[index] !== undefined) {
      const previous = section[category][index];
      const issuePrefix = category === "mainIssues" ? previous.match(/^\[\d+\]\s*/)?.[0] || "" : "";
      section[category][index] = `${issuePrefix}${text}`;
    }
  }

  audit.sourceText = currentAuditText();
  persistAuditSoon(audit);
}

function render() {
  renderAuditList();
  renderActiveView();
  updateToolbar();
}

function updateToolbar() {
  const titles = {
    frames: "Audit Frames",
    library: "Template Library",
    builder: "Build New Audit",
  };
  els.pageTitle.textContent = titles[state.activeView];
  els.copyAuditBtn.hidden = state.activeView !== "frames";
  els.editAuditBtn.hidden = state.activeView !== "frames";
  els.editAuditBtn.textContent = state.editMode ? "Done editing" : "Edit audit";
  els.seedBuilderBtn.hidden = state.activeView !== "frames";
  els.exportPdfBtn.hidden = state.activeView !== "frames";
  els.resetBuilderBtn.hidden = state.activeView !== "builder";
  els.exportBuilderBtn.hidden = state.activeView !== "builder";
}

function renderAuditList() {
  const auditsToShow = allAudits();
  els.auditCountLabel.textContent = `Search the ${auditsToShow.length} audits`;
  const query = state.auditSearch.toLowerCase();
  const audits = auditsToShow.filter((audit) => {
    const haystack = [
      audit.meta.company,
      audit.meta.contact,
      audit.meta.email,
      audit.meta.website,
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  }).sort((a, b) => factorScores(a).overall - factorScores(b).overall || a.meta.company.localeCompare(b.meta.company));

  if (!audits.length) {
    els.auditList.innerHTML = document.querySelector("#emptyStateTemplate").innerHTML;
    return;
  }

  els.auditList.innerHTML = audits
    .map((audit) => {
      const scores = factorScores(audit);
      const active = audit.id === state.activeAuditId ? " is-active" : "";
      return `
        <button class="audit-row${active}" type="button" data-audit-id="${audit.id}">
          <span>
            <strong>${escapeHtml(audit.meta.company)}</strong>
            <span>${escapeHtml(audit.meta.website)}</span>
          </span>
          <span class="score-pill ${scoreClass(scores.overall)}">${escapeHtml(scores.overall)}</span>
        </button>
      `;
    })
    .join("");
}

function renderActiveView() {
  els.app.dataset.view = state.activeView;
  for (const view of document.querySelectorAll(".view")) view.classList.remove("is-active");
  document.querySelector(`#${state.activeView}View`).classList.add("is-active");
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("is-active", tab.dataset.view === state.activeView);
  }

  if (state.activeView === "frames") renderFramesView();
  if (state.activeView === "library") renderLibraryView();
  if (state.activeView === "builder") renderBuilderView();
}

function renderFramesView() {
  const audit = activeAudit();
  els.framesView.innerHTML = `
    <div class="frame-layout">
      ${renderAuditFrame(audit)}
    </div>
  `;
  applyEditMode();
}

function renderAuditFrame(audit) {
  const scores = factorScores(audit);
  const factors = [
    { key: "performance", label: "Lighthouse Performance", value: scores.performance, editable: false },
    { key: "lookAndFeel", label: "Look & Feel", value: scores.lookAndFeel, editable: true },
    { key: "animation", label: "Animation", value: scores.animation, editable: true },
    { key: "seo", label: "SEO", value: scores.seo, editable: false },
  ].map((factor) => {
    return `
      <div class="factor-card ${factor.editable ? "is-editable" : ""} ${scoreClass(factor.value)}">
        <span>${escapeHtml(factor.label)}</span>
        ${
          factor.editable
            ? `
              <label class="factor-input-wrap">
                <input
                  class="factor-input"
                  type="number"
                  min="0"
                  max="100"
                  inputmode="numeric"
                  value="${escapeAttr(factor.value)}"
                  aria-label="${escapeAttr(factor.label)} score"
                  data-score-audit-id="${escapeAttr(audit.id)}"
                  data-score-field="${escapeAttr(factor.key)}"
                />
                <span>%</span>
              </label>
            `
            : `<strong>${escapeHtml(factor.value)}%</strong>`
        }
      </div>
    `;
  });

  return `
    <article class="audit-frame">
      <header class="audit-header">
        <h2 class="audit-main-title" data-edit-meta="company">${escapeHtml(audit.meta.company)}</h2>
        <div class="audit-title-card">
          <div class="meta-grid">
            <span><strong>Website:</strong> <span data-edit-meta="website">${escapeHtml(audit.meta.website)}</span></span>
            <span><strong>Contact:</strong> <span data-edit-meta="contact">${escapeHtml(audit.meta.contact)}</span></span>
            <span><strong>Email:</strong> <span data-edit-meta="email">${escapeHtml(audit.meta.email)}</span></span>
            <span><strong>Audit Date:</strong> <span data-edit-meta="auditDate">${escapeHtml(audit.meta.auditDate)}</span></span>
          </div>
        </div>
        <div class="score-board">
          <div class="overall-score ${scoreClass(scores.overall)}">
            <span>Huck Finch Audit Score</span>
            <strong>${escapeHtml(scores.overall)}</strong>
          </div>
          <div class="factor-grid">${factors.join("")}</div>
        </div>
      </header>

      <section id="${slug("Audit Summary")}" class="audit-section">
        <h3>Audit Summary</h3>
        <h4>Main opportunities</h4>
        ${renderOrderedList(audit.summary.opportunities, true)}
      </section>

      <section id="${slug("Messaging Direction")}" class="audit-section">
        <h3>Messaging Direction</h3>
        <p><strong>Recommended messaging model:</strong> <span data-edit-messaging="model">${escapeHtml(audit.messaging.model)}</span></p>
        <h4>Messaging Notes</h4>
        <p data-edit-messaging="notes">${escapeHtml(audit.messaging.notes)}</p>
      </section>

      ${SECTION_ORDER.map((title) => renderAuditSection(sectionOf(audit, title))).join("")}
    </article>
  `;
}

function renderAuditSection(section) {
  if (!section) return "";
  const isPerformance = section.title === "Performance";
  const issues = linesWithoutEmpty(section.mainIssues);
  const effects = linesWithoutEmpty(section.affects).filter(hasUsefulLine);
  const fixes = linesWithoutEmpty(section.fixes).filter(hasUsefulLine);
  return `
    <section id="${slug(section.title)}" class="audit-section">
      <h3>${escapeHtml(section.title)}</h3>
      <div class="content-block">
        <h4>${isPerformance ? "Main Performance Issues" : "Main Issues"}</h4>
        ${renderIssueCards(issues, section.title, "mainIssues")}
      </div>
      ${effects.length ? `
        <div class="content-block">
          <h4>The Affects</h4>
          ${renderTagList(effects, section.title, "affects")}
        </div>
      ` : ""}
      ${fixes.length ? `
        <div class="content-block">
          <h4>The Fixes</h4>
          ${renderActionCards(fixes, section.title, "fixes")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderOrderedList(lines, editable = false) {
  return `<ol>${linesWithoutEmpty(lines).map((line, index) => `<li ${editable ? `data-edit-summary-index="${index}"` : ""}>${escapeHtml(line)}</li>`).join("")}</ol>`;
}

function renderPlainList(lines) {
  return `<ul>${linesWithoutEmpty(lines).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function renderParagraphLines(lines) {
  return linesWithoutEmpty(lines).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function renderNotePills(lines) {
  return `
    <div class="note-grid">
      ${linesWithoutEmpty(lines).map((line) => `<div class="note-pill">${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
}

function editItemAttributes(sectionTitle, category, index) {
  return `data-edit-section-title="${escapeAttr(sectionTitle)}" data-edit-section-category="${escapeAttr(category)}" data-edit-section-index="${index}"`;
}

function renderIssueCards(lines, sectionTitle, category) {
  return `
    <div class="item-grid">
      ${linesWithoutEmpty(lines)
        .map((line, index) => {
          const text = stripIssueId(line);
          return `
            <div class="audit-item issue">
              <span ${editItemAttributes(sectionTitle, category, index)}>${escapeHtml(text)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderActionCards(lines, sectionTitle, category) {
  return `
    <div class="item-grid">
      ${linesWithoutEmpty(lines).map((line, index) => `<div class="audit-item fix" ${editItemAttributes(sectionTitle, category, index)}>${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
}

function renderTagList(lines, sectionTitle, category) {
  return `
    <div class="tag-list">
      ${linesWithoutEmpty(lines).map((line, index) => `<span class="tag" ${editItemAttributes(sectionTitle, category, index)}>${escapeHtml(line)}</span>`).join("")}
    </div>
  `;
}

function renderLibraryView() {
  const activeBank = state.optionBank.sections[state.librarySection];
  els.libraryView.innerHTML = `
    <div class="library-grid">
      <aside class="library-panel">
        <h3>Template Sections</h3>
        <div class="section-menu">
          ${SECTION_ORDER.map((title) => {
            return `<button type="button" class="${title === state.librarySection ? "is-active" : ""}" data-library-section="${title}">
              ${title}
            </button>`;
          }).join("")}
        </div>
      </aside>
      <section class="library-panel">
        <div class="option-toolbar">
          <div>
            <h3>${escapeHtml(state.librarySection)}</h3>
            <p class="muted">Drag options from here into the builder, or use Add buttons inside the builder.</p>
          </div>
          <button id="editLibraryBtn" class="button secondary" type="button">${state.libraryEditMode ? "Done editing library" : "Edit library"}</button>
          <input id="optionSearch" type="search" placeholder="Search options" value="${escapeAttr(state.optionSearch)}" />
        </div>
        ${renderOptionColumns(activeBank, state.librarySection, false)}
      </section>
    </div>
  `;
}

function renderOptionColumns(bank, sectionTitle, addButtons = false) {
  const categories = ["mainIssues", "affects", "fixes"];
  const query = state.optionSearch.toLowerCase();

  return `
    <div class="option-columns">
      ${categories
        .map((category) => {
          const options = (bank[category] || [])
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.toLowerCase().includes(query));
          return `
            <div class="option-group">
              <h4>${CATEGORY_LABELS[category]}</h4>
              <div class="option-list">
                ${
                  options.length
                    ? options.map(({ item, index }) => renderOptionChip(sectionTitle, category, item, addButtons, index)).join("")
                    : `<div class="muted">No matching options</div>`
                }
              </div>
              ${state.libraryEditMode && !addButtons ? `<button class="small-button add-option-button" type="button" data-add-library-option data-library-section-name="${escapeAttr(sectionTitle)}" data-library-category="${category}">Add option</button>` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderOptionChip(sectionTitle, category, option, addButtons, index) {
  const visibleOption = category === "mainIssues" ? stripIssueId(option) : option;
  if (state.libraryEditMode && !addButtons) {
    return `
      <div class="option-edit-row">
        <textarea
          data-library-option
          data-library-section-name="${escapeAttr(sectionTitle)}"
          data-library-category="${category}"
          data-library-index="${index}"
          rows="3"
        >${escapeHtml(option)}</textarea>
        <button
          type="button"
          aria-label="Remove option"
          data-remove-library-option
          data-library-section-name="${escapeAttr(sectionTitle)}"
          data-library-category="${category}"
          data-library-index="${index}"
        >×</button>
      </div>
    `;
  }

  return `
    <button
      class="option-chip"
      type="button"
      data-drag-option="${escapeAttr(option)}"
    >
      ${escapeHtml(visibleOption)}
    </button>
  `;
}

function renderBuilderView() {
  els.builderView.innerHTML = `
    <div class="builder-layout">
      <section class="builder-panel">
        <h3>Audit Details</h3>
        <div class="builder-form">
          ${renderField("company", "Company")}
          ${renderField("website", "Website")}
          ${renderField("contact", "Contact")}
          ${renderField("email", "Email")}
          ${renderField("auditDate", "Audit Date")}
          ${renderField("auditedBy", "Audited By")}
          <div class="field-group">
            <h4>Lighthouse Scores</h4>
            ${renderBuilderScoreFields()}
          </div>
          <div class="messaging-fields">
            <label class="field">
              <span>Messaging Model</span>
              <select data-builder-messaging-model>
                <option value="" ${state.builder.messaging.model ? "" : "selected"}>Select model</option>
                ${state.optionBank.messagingModels
                  .map((model) => `<option value="${escapeAttr(model)}" ${model === state.builder.messaging.model ? "selected" : ""}>${escapeHtml(model)}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="field messaging-notes-field">
              <span>Messaging Notes</span>
              <textarea data-builder-messaging-notes rows="6">${escapeHtml(state.builder.messaging.notes)}</textarea>
            </label>
          </div>
        </div>
      </section>

      <section>
        <div class="builder-panel">
          <h3>Summary Opportunities</h3>
          <div class="option-list">
            ${state.optionBank.summaryOpportunities
              .map((option) => {
                const selected = state.builder.summaryOpportunities.includes(option);
                return `<label class="check-row">
                  <input type="checkbox" data-summary-option="${escapeAttr(option)}" ${selected ? "checked" : ""} />
                  <span>${escapeHtml(option)}</span>
                </label>`;
              })
              .join("")}
          </div>
        </div>

        <div class="builder-sections">
          ${SECTION_ORDER.map(renderBuilderSection).join("")}
        </div>
      </section>
    </div>
  `;
}

function updateBuilderPreview() {
  // The builder saves rendered audit data directly; no visible text preview is needed.
}

function builderScoreValue(label) {
  const line = state.builder.sections.Performance.speedScores.find((item) => item.startsWith(`${label}:`));
  return line ? line.split(":").slice(1).join(":").trim() : "";
}

function setBuilderScore(label, value) {
  const scores = state.builder.sections.Performance.speedScores.filter((item) => !item.startsWith(`${label}:`));
  const trimmed = value.trim();
  if (trimmed) scores.push(`${label}: ${trimmed}`);
  state.builder.sections.Performance.speedScores = SCORE_LABELS
    .map((scoreLabel) => scores.find((item) => item.startsWith(`${scoreLabel}:`)))
    .filter(Boolean);
  saveBuilder();
  updateBuilderPreview();
}

function renderBuilderScoreFields() {
  return `
    <div class="score-input-grid">
      ${SCORE_LABELS.map((label) => `
        <label class="field">
          <span>${escapeHtml(label)} Score</span>
          <input
            data-builder-score="${escapeAttr(label)}"
            type="number"
            min="0"
            max="100"
            inputmode="numeric"
            value="${escapeAttr(builderScoreValue(label))}"
          />
        </label>
      `).join("")}
    </div>
  `;
}

function renderField(key, label) {
  return `
    <label class="field">
      <span>${label}</span>
      <input data-builder-field="${key}" value="${escapeAttr(state.builder.meta[key] || "")}" />
    </label>
  `;
}

function renderBuilderSection(title) {
  return `
    <details class="builder-section" ${title === "Performance" ? "open" : ""}>
      <summary>${title}</summary>
      ${renderBuilderOptionColumns(title)}
    </details>
  `;
}

function renderBuilderOptionColumns(sectionTitle) {
  const selected = state.builder.sections[sectionTitle];
  return `
    <div class="option-columns builder-option-columns">
      ${["mainIssues", "affects", "fixes"].map((category) => {
        const options = state.optionBank.sections[sectionTitle]?.[category] || [];
        return `
          <div class="option-group">
            <h4>${CATEGORY_LABELS[category]}</h4>
            <div class="option-list">
              ${options.length
                ? options.map((option) => renderBuilderOptionChip(sectionTitle, category, option, selected?.[category]?.includes(option))).join("")
                : `<div class="muted">No saved options</div>`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderBuilderOptionChip(sectionTitle, category, option, isSelected) {
  return `
    <button
      class="option-chip builder-option-chip${isSelected ? " is-selected" : ""}"
      type="button"
      data-toggle-builder-option
      data-builder-section="${escapeAttr(sectionTitle)}"
      data-builder-category="${escapeAttr(category)}"
      data-builder-option-value="${escapeAttr(option)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      ${escapeHtml(category === "mainIssues" ? stripIssueId(option) : option)}
    </button>
  `;
}

function toggleBuilderOption(sectionTitle, category, option) {
  const section = state.builder.sections[sectionTitle];
  if (!section?.[category]) return false;

  if (section[category].includes(option)) {
    section[category] = section[category].filter((item) => item !== option);
  } else {
    section[category].push(option);
  }

  saveBuilder();
  return section[category].includes(option);
}

function buildBuilderText() {
  const b = state.builder;
  const company = b.meta.company || "New Company";
  const lines = [
    `# ${company} Website Audit`,
    "",
    `Website: ${b.meta.website || ""}`,
    `Company: ${company}`,
    `Contact: ${b.meta.contact || ""}`,
    `Email: ${b.meta.email || ""}`,
    `Audit Date: ${b.meta.auditDate || ""}`,
    `Audited By: ${b.meta.auditedBy || ""}`,
    "",
    "---",
    "",
    "## Audit Summary",
    "",
    `${company}'s website was reviewed from a public-facing perspective.`,
    "",
    "Main opportunities:",
    "",
    ...(b.summaryOpportunities.length
      ? b.summaryOpportunities.map((item, index) => `${index + 1}. ${item}`)
      : ["No main opportunities selected yet."]),
    "",
    "---",
    "",
    "## Messaging Direction",
    "",
    `Recommended messaging model: ${b.messaging.model || ""}`,
    "",
    "Messaging Notes:",
    "",
    b.messaging.notes || "No messaging notes selected yet.",
    "",
    "---",
  ];

  for (const title of SECTION_ORDER) {
    const section = b.sections[title];
    lines.push("", `## ${title}`, "");
    if (title === "Performance") {
      lines.push("### Speed Test Scores", "", ...(section.speedScores.length ? section.speedScores : ["Scores need to be added."]), "");
      lines.push("### Main Performance Issues", "");
    } else {
      lines.push("### Main Issues", "");
    }
    lines.push(...(section.mainIssues.length ? section.mainIssues : ["No major issue was found in this section from the external checks."]));
    lines.push("", "### The Affects", "", ...(section.affects.length ? section.affects : ["No specific effect selected from the external checks."]));
    lines.push("", "### The Fixes", "", ...(section.fixes.length ? section.fixes : ["No specific fix selected from the external checks."]));
    lines.push("", "---");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function seedBuilderFromAudit(audit) {
  const builder = blankBuilder();
  builder.meta = { ...audit.meta };
  builder.summaryOpportunities = [...audit.summary.opportunities];
  builder.messaging = { ...audit.messaging };
  for (const title of SECTION_ORDER) {
    const section = sectionOf(audit, title);
    if (!section) continue;
    builder.sections[title] = {
      mainIssues: [...section.mainIssues],
      affects: [...section.affects],
      fixes: [...section.fixes],
      speedScores: [...section.speedScores],
    };
  }
  state.builder = builder;
  saveBuilder();
}

function auditFromBuilder() {
  const b = state.builder;
  const company = (b.meta.company || "New Company").trim();
  const id = slug(company || `saved-audit-${Date.now()}`);
  const sourceText = buildBuilderText();
  return {
    id,
    file: `${id}-audit.txt`,
    meta: {
      title: `${company} Website Audit`,
      website: b.meta.website || "",
      company,
      contact: b.meta.contact || "",
      email: b.meta.email || "",
      auditDate: b.meta.auditDate || "",
      auditedBy: b.meta.auditedBy || "",
    },
    summary: {
      intro: "",
      opportunities: [...b.summaryOpportunities],
    },
    messaging: { ...b.messaging },
    sections: SECTION_ORDER.map((title) => ({
      title,
      raw: "",
      mainIssues: [...(b.sections[title]?.mainIssues || [])],
      affects: [...(b.sections[title]?.affects || [])],
      fixes: [...(b.sections[title]?.fixes || [])],
      speedScores: [...(b.sections[title]?.speedScores || [])],
    })),
    sourceText,
  };
}

async function saveBuilderAudit() {
  const audit = auditFromBuilder();
  upsertLocalAudit(audit);
  await persistAudit(audit);
  state.activeAuditId = audit.id;
  state.activeView = "frames";
  state.editMode = false;
  render();
  showToast("Audit saved");
}

function updateLibraryOption(sectionTitle, category, index, value) {
  const list = state.optionBank.sections[sectionTitle]?.[category];
  if (!list || !list[index]) return;
  list[index] = value;
  saveOptionBank();
}

function addLibraryOption(sectionTitle, category) {
  const list = state.optionBank.sections[sectionTitle]?.[category];
  if (!list) return;
  list.push("New option");
  saveOptionBank();
  state.optionSearch = "";
  renderLibraryView();
}

function removeLibraryOption(sectionTitle, category, index) {
  const list = state.optionBank.sections[sectionTitle]?.[category];
  if (!list || !list[index]) return;
  list.splice(index, 1);
  saveOptionBank();
  renderLibraryView();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

document.addEventListener("click", (event) => {
  const builderOptionButton = event.target.closest("[data-toggle-builder-option]");
  if (builderOptionButton) {
    const isSelected = toggleBuilderOption(
      builderOptionButton.dataset.builderSection,
      builderOptionButton.dataset.builderCategory,
      builderOptionButton.dataset.builderOptionValue,
    );
    builderOptionButton.classList.toggle("is-selected", isSelected);
    builderOptionButton.setAttribute("aria-pressed", isSelected ? "true" : "false");
    return;
  }

  const auditButton = event.target.closest("[data-audit-id]");
  if (auditButton) {
    state.activeAuditId = auditButton.dataset.auditId;
    state.editMode = false;
    render();
    return;
  }

  const tab = event.target.closest(".tab[data-view]");
  if (tab) {
    state.activeView = tab.dataset.view;
    if (state.activeView !== "frames") state.editMode = false;
    renderActiveView();
    updateToolbar();
    return;
  }

  const sectionButton = event.target.closest("[data-library-section]");
  if (sectionButton) {
    state.librarySection = sectionButton.dataset.librarySection;
    renderLibraryView();
    return;
  }

  if (event.target.id === "editLibraryBtn") {
    state.libraryEditMode = !state.libraryEditMode;
    renderLibraryView();
    showToast(state.libraryEditMode ? "Library edit mode on" : "Library edit mode off");
    return;
  }

  const addLibraryButton = event.target.closest("[data-add-library-option]");
  if (addLibraryButton) {
    addLibraryOption(addLibraryButton.dataset.librarySectionName, addLibraryButton.dataset.libraryCategory);
    return;
  }

  const removeLibraryButton = event.target.closest("[data-remove-library-option]");
  if (removeLibraryButton) {
    removeLibraryOption(
      removeLibraryButton.dataset.librarySectionName,
      removeLibraryButton.dataset.libraryCategory,
      Number(removeLibraryButton.dataset.libraryIndex),
    );
    return;
  }

  const scrollButton = event.target.closest("[data-scroll-section]");
  if (scrollButton) {
    document.getElementById(scrollButton.dataset.scrollSection)?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (event.target.id === "resetBuilderBtn") {
    state.builder = blankBuilder();
    saveBuilder();
    renderBuilderView();
  }
});

document.addEventListener("input", (event) => {
  const editable = event.target.closest("[contenteditable='true']");
  if (editable) {
    updateAuditFromEditable(editable);
    return;
  }

  if (event.target === els.auditSearch) {
    state.auditSearch = event.target.value;
    renderAuditList();
    return;
  }

  if (event.target.id === "optionSearch") {
    state.optionSearch = event.target.value;
    if (state.activeView === "library") renderLibraryView();
    return;
  }

  const scoreInput = event.target.closest("[data-score-field]");
  if (scoreInput) {
    updateManualScore(scoreInput);
    return;
  }

  const libraryOption = event.target.closest("[data-library-option]");
  if (libraryOption) {
    updateLibraryOption(
      libraryOption.dataset.librarySectionName,
      libraryOption.dataset.libraryCategory,
      Number(libraryOption.dataset.libraryIndex),
      libraryOption.value,
    );
    return;
  }

  const builderScore = event.target.closest("[data-builder-score]");
  if (builderScore) {
    setBuilderScore(builderScore.dataset.builderScore, builderScore.value);
    return;
  }

  const field = event.target.closest("[data-builder-field]");
  if (field) {
    state.builder.meta[field.dataset.builderField] = field.value;
    saveBuilder();
    updateBuilderPreview();
  }

  const notes = event.target.closest("[data-builder-messaging-notes]");
  if (notes) {
    state.builder.messaging.notes = notes.value;
    saveBuilder();
    updateBuilderPreview();
  }
});

document.addEventListener("change", (event) => {
  const scoreInput = event.target.closest("[data-score-field]");
  if (scoreInput) {
    updateManualScore(scoreInput, true);
    return;
  }

  const model = event.target.closest("[data-builder-messaging-model]");
  if (model) {
    state.builder.messaging.model = model.value;
    saveBuilder();
    updateBuilderPreview();
    return;
  }

  const summaryOption = event.target.closest("[data-summary-option]");
  if (summaryOption) {
    const option = summaryOption.dataset.summaryOption;
    if (summaryOption.checked && !state.builder.summaryOpportunities.includes(option)) {
      state.builder.summaryOpportunities.push(option);
    } else if (!summaryOption.checked) {
      state.builder.summaryOpportunities = state.builder.summaryOpportunities.filter((item) => item !== option);
    }
    saveBuilder();
    renderBuilderView();
  }
});

els.copyAuditBtn.addEventListener("click", () => copyText(currentAuditText(), "Current audit copied"));
els.editAuditBtn.addEventListener("click", () => {
  const wasEditing = state.editMode;
  state.editMode = !state.editMode;
  if (wasEditing) {
    const audit = activeAudit();
    if (audit) {
      audit.sourceText = currentAuditText();
      persistAudit(audit);
      renderAuditList();
    }
  }
  applyEditMode();
  updateToolbar();
  showToast(state.editMode ? "Edit mode on" : "Edit mode off");
});
els.seedBuilderBtn.addEventListener("click", () => {
  seedBuilderFromAudit(activeAudit());
  state.activeView = "builder";
  state.editMode = false;
  renderActiveView();
  updateToolbar();
  showToast("Builder seeded from current audit");
});
els.exportPdfBtn.addEventListener("click", () => {
  state.editMode = false;
  applyEditMode();
  updateToolbar();
  preparePrintPage();
  window.print();
});
els.exportBuilderBtn.addEventListener("click", saveBuilderAudit);

render();
