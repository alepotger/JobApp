/* A Supabase Realtime server, small enough to read.
 *
 * WHY THIS EXISTS
 * Every other harness in this project is HTTP-only. No WebSocket ever opened,
 * so no postgres_changes event ever fired, so nothing about realtime was ever
 * executed — only read. That blind spot hid the contact-email echo bug and
 * then the reorder sync bug. Both were reported as working.
 *
 * This closes it. It speaks enough of the protocol for @supabase/supabase-js
 * to open a channel, subscribe to postgres_changes, and receive them.
 *
 * There is no `ws` dependency, and there is not going to be one — the project
 * bans new dependencies, and a harness that needs an install is a harness that
 * quietly stops being run. RFC 6455 is implemented below in about eighty
 * lines: handshake, frame decode, frame encode. Text frames only, which is all
 * Phoenix uses.
 *
 * PROTOCOL, as supabase-js v2 speaks it (vsn=2.0.0)
 * Every message is a JSON array: [join_ref, ref, topic, event, payload]
 *   client → phx_join on "realtime:<name>", carrying its postgres_changes
 *            bindings in payload.config
 *   server → phx_reply {status:"ok", response:{postgres_changes:[…]}} and the
 *            bindings MUST be echoed back in order, each with an id. The
 *            client matches them positionally; get this wrong and it raises
 *            "mismatch between server and client bindings" instead of
 *            subscribing.
 *   server → postgres_changes {ids:[…], data:{…}} for each row change
 *   client → heartbeat on the "phoenix" topic, which must be answered or the
 *            client tears the socket down and reconnects in a loop.
 */
const http = require("http");
const crypto = require("crypto");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/* ---- RFC 6455, the parts Phoenix uses ---------------------------------- */

function accept(key) {
  return crypto.createHash("sha1").update(key + GUID).digest("base64");
}

/* Server→client frames are never masked. */
function encode(text) {
  const body = Buffer.from(text, "utf8");
  const n = body.length;
  let head;
  if (n < 126) {
    head = Buffer.from([0x81, n]);
  } else if (n < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x81; head[1] = 126; head.writeUInt16BE(n, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([head, body]);
}

/* Client→server frames are always masked. Returns [messages, remainder] so a
   partial frame at the end of a chunk is carried into the next one. */
function decode(buf) {
  const out = [];
  let i = 0;
  while (i + 2 <= buf.length) {
    const opcode = buf[i] & 0x0f;
    const masked = (buf[i + 1] & 0x80) !== 0;
    let len = buf[i + 1] & 0x7f;
    let p = i + 2;
    if (len === 126) { if (p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (p + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    let mask = null;
    if (masked) { if (p + 4 > buf.length) break; mask = buf.slice(p, p + 4); p += 4; }
    if (p + len > buf.length) break;
    const payload = buf.slice(p, p + len);
    if (mask) for (let k = 0; k < payload.length; k++) payload[k] ^= mask[k % 4];
    if (opcode === 0x1) out.push(payload.toString("utf8"));
    if (opcode === 0x8) out.push(null);              // close
    i = p + len;
  }
  return [out, buf.slice(i)];
}

/* ---- the Phoenix / Realtime layer -------------------------------------- */

function startRealtime(port = 8788) {
  const sockets = new Set();
  let nextBindingId = 1;

  const server = http.createServer((_, res) => { res.writeHead(404); res.end(); });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept(key)}\r\n\r\n`
    );

    const client = { socket, topics: new Map() };   // topic -> [bindingId…]
    sockets.add(client);
    let buf = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const [messages, rest] = decode(buf);
      buf = rest;
      for (const raw of messages) {
        if (raw === null) { socket.end(); return; }
        let msg;
        try { msg = JSON.parse(raw); } catch (e) { continue; }
        const [joinRef, ref, topic, event, payload] = msg;

        if (event === "heartbeat") {
          socket.write(encode(JSON.stringify(
            [joinRef, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]
          )));
          continue;
        }

        if (event === "phx_join") {
          /* Echo the bindings back in the SAME ORDER with ids. supabase-js
             matches them positionally and refuses to subscribe otherwise. */
          const asked = (payload && payload.config && payload.config.postgres_changes) || [];
          const granted = asked.map((b) => ({ ...b, id: nextBindingId++ }));
          client.topics.set(topic, granted.map((b) => b.id));
          socket.write(encode(JSON.stringify(
            [joinRef, ref, topic, "phx_reply",
             { status: "ok", response: { postgres_changes: granted } }]
          )));
          continue;
        }

        if (event === "access_token" || event === "phx_leave") {
          socket.write(encode(JSON.stringify(
            [joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]
          )));
          if (event === "phx_leave") client.topics.delete(topic);
        }
      }
    });

    const drop = () => sockets.delete(client);
    socket.on("close", drop);
    socket.on("error", drop);
  });

  server.listen(port, "127.0.0.1");

  /* Push a row change to every subscribed client, exactly as Postgres would. */
  function broadcast(table, type, newRow, oldRow) {
    const data = {
      schema: "public",
      table,
      commit_timestamp: new Date().toISOString(),
      type,                       // supabase-js reads this as eventType
      /* `record` / `old_record`, NOT `new` / `old`. That is the wire format,
         and supabase-js maps them to payload.new / payload.old itself. Sending
         new/old makes payload.new arrive undefined, which looks exactly like
         the app ignoring realtime — this stub's first run "reproduced" the
         reported bug that way, and the bug was in the stub. */
      record: newRow || {},
      old_record: oldRow || {},
      errors: null,
      columns: [],
    };
    for (const client of sockets) {
      for (const [topic, ids] of client.topics) {
        if (!ids.length) continue;
        try {
          client.socket.write(encode(JSON.stringify(
            [null, null, topic, "postgres_changes", { ids, data }]
          )));
        } catch (e) { /* socket went away mid-write */ }
      }
    }
  }

  return {
    broadcast,
    clients: () => sockets.size,
    subscribed: () => [...sockets].reduce((n, c) => n + c.topics.size, 0),
    close: () => { for (const c of sockets) c.socket.destroy(); server.close(); },
  };
}

module.exports = { startRealtime };
