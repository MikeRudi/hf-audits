const { readJsonBody, sendJson, upsertAudit } = require("./_state");

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("allow", "POST");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const audit = await readJsonBody(request);
    if (!audit || !audit.id || !audit.meta || !Array.isArray(audit.sections)) {
      sendJson(response, 400, { error: "A complete audit payload is required" });
      return;
    }

    sendJson(response, 200, await upsertAudit(audit));
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
};
