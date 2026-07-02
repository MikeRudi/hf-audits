const { getState, patchState, readJsonBody, sendJson } = require("./_state");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      sendJson(response, 200, await getState());
      return;
    }

    if (request.method === "PUT") {
      const patch = await readJsonBody(request);
      sendJson(response, 200, await patchState(patch));
      return;
    }

    response.setHeader("allow", "GET, PUT");
    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
};
