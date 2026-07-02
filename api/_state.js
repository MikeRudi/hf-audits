const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

const STATE_KEY = "main";
const seedPath = path.join(process.cwd(), "app", "data", "audits.json");

let tableReady = false;

function readSeedState() {
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  return {
    audits: seed.audits || [],
    optionBank: seed.optionBank || { sections: {}, messagingModels: [], summaryOpportunities: [] },
    manualScores: {},
    generatedAt: seed.generatedAt || new Date().toISOString(),
  };
}

function getSql() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!databaseUrl) return null;
  return neon(databaseUrl);
}

async function ensureTable(sql) {
  if (tableReady) return;
  await sql`
    create table if not exists audit_app_state (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  tableReady = true;
}

async function getState() {
  const seed = readSeedState();
  const sql = getSql();
  if (!sql) {
    return {
      ...seed,
      databaseReady: false,
    };
  }

  await ensureTable(sql);
  const rows = await sql`select value from audit_app_state where key = ${STATE_KEY}`;
  if (rows.length) {
    return {
      ...seed,
      ...rows[0].value,
      databaseReady: true,
    };
  }

  await writeState(seed);
  return {
    ...seed,
    databaseReady: true,
  };
}

async function writeState(nextState) {
  const sql = getSql();
  if (!sql) return readSeedState();

  await ensureTable(sql);
  const value = {
    audits: nextState.audits || [],
    optionBank: nextState.optionBank || { sections: {}, messagingModels: [], summaryOpportunities: [] },
    manualScores: nextState.manualScores || {},
    generatedAt: nextState.generatedAt || new Date().toISOString(),
  };

  await sql`
    insert into audit_app_state (key, value, updated_at)
    values (${STATE_KEY}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key)
    do update set value = excluded.value, updated_at = now()
  `;
  return {
    ...value,
    databaseReady: true,
  };
}

async function patchState(patch) {
  const current = await getState();
  return writeState({
    ...current,
    audits: patch.audits || current.audits || [],
    optionBank: patch.optionBank || current.optionBank,
    manualScores: patch.manualScores || current.manualScores || {},
    generatedAt: new Date().toISOString(),
  });
}

async function upsertAudit(audit) {
  const current = await getState();
  const audits = current.audits || [];
  const nextAudits = audits.filter((item) => item.id !== audit.id);
  nextAudits.push(audit);
  return writeState({
    ...current,
    audits: nextAudits,
    generatedAt: new Date().toISOString(),
  });
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 6_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

module.exports = {
  getState,
  patchState,
  readJsonBody,
  sendJson,
  upsertAudit,
};
