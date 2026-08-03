/* An in-memory stand-in for the PostgREST + GoTrue endpoints the two Edge
   Functions actually call. The real @supabase/supabase-js client talks to it
   over real HTTP, so the query builder, filters and error shapes are exercised
   for real — only the storage behind them is fake. */
const http = require("http");

let failNext = null;
const state = {
  tracker_settings: [
    { user_id: "11111111-2222-4333-8444-555555555555", inbound_token: "aaaatoken", digest_email: null,
      digest_enabled: true, stale_after: 7, last_digest_at: null },
  ],
  applications: [],
  inbound_messages: [],
  users: { "11111111-2222-4333-8444-555555555555": { id: "11111111-2222-4333-8444-555555555555", email: "alice@example.com" } },
};

const reset = (extra = {}) => {
  state.applications = (extra.applications || []).map((r) => ({ ...r }));
  state.inbound_messages = [];
  state.tracker_settings = (extra.tracker_settings ||
    [{ user_id: "11111111-2222-4333-8444-555555555555", inbound_token: "aaaatoken", digest_email: null,
       digest_enabled: true, stale_after: 7, last_digest_at: null }]).map((r) => ({ ...r }));
};

/* PostgREST filters arrive as ?col=eq.value */
const matches = (row, params) => {
  for (const [k, v] of params) {
    if (["select", "limit", "offset", "order"].includes(k)) continue;
    if (!v.startsWith("eq.")) continue;
    const want = v.slice(3);
    const got = row[k];
    const norm = (x) => (x === true ? "true" : x === false ? "false" : String(x));
    if (norm(got) !== want) return false;
  }
  return true;
};

const send = (res, status, body) => {
  const b = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) });
  res.end(b);
};

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const u = new URL(req.url, "http://localhost");
    const params = [...u.searchParams.entries()];

    if (u.pathname === "/__reset") { reset(JSON.parse(raw || "{}")); failNext = null; return send(res, 200, { ok: true }); }
    if (u.pathname === "/__fail") { failNext = JSON.parse(raw); return send(res, 200, { ok: true }); }

    /* Fault injection: fail one specific request once, to see what the
       function does when the database blinks mid-delivery. */
    if (failNext && u.pathname.endsWith("/" + failNext.table) && req.method === failNext.method) {
      failNext = null;
      return send(res, 500, { code: "57014", message: "canceling statement due to statement timeout" });
    }
    if (u.pathname === "/__state") return send(res, 200, state);

    const admin = u.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
    if (admin) {
      const user = state.users[admin[1]];
      return user ? send(res, 200, user) : send(res, 404, { message: "not found" });
    }

    const m = u.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (!m) return send(res, 404, { message: "no route " + u.pathname });
    const table = m[1];
    if (!state[table]) return send(res, 404, { message: "no table " + table });

    if (req.method === "GET") {
      let rows = state[table].filter((r) => matches(r, params));
      const limit = u.searchParams.get("limit");
      if (limit) rows = rows.slice(0, Number(limit));
      return send(res, 200, rows);
    }

    if (req.method === "POST") {
      const body = JSON.parse(raw);
      const list = Array.isArray(body) ? body : [body];
      for (const row of list) {
        /* inbound_messages.message_id is the primary key — a provider retry
           has to collide here, which is what makes delivery idempotent. */
        if (table === "inbound_messages" &&
            state.inbound_messages.some((r) => r.message_id === row.message_id)) {
          return send(res, 409, {
            code: "23505",
            message: 'duplicate key value violates unique constraint "inbound_messages_pkey"',
            details: null, hint: null,
          });
        }
        state[table].push({ ...row });
      }
      return send(res, 201, list);
    }

    if (req.method === "PATCH") {
      const body = JSON.parse(raw);
      let n = 0;
      state[table] = state[table].map((r) => {
        if (!matches(r, params)) return r;
        n++; return { ...r, ...body };
      });
      return send(res, 200, []);
    }

    return send(res, 405, { message: "method" });
  });
});

server.listen(8801, "127.0.0.1", () => console.log("fake supabase on 8801"));
