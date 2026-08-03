/* Runs the real weekly-digest function unmodified. Three redirections, all
   environmental: the Supabase client specifier (jsr -> npm), the listen port,
   and api.resend.com — captured to a file instead of sent, so the composed
   message can be inspected. Everything else is the shipped code path. */
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (String(url).startsWith("https://api.resend.com/")) {
    const sent = JSON.parse(String(init?.body ?? "{}"));
    sent.__auth = String(init?.headers?.Authorization ?? "");
    await Deno.writeTextFile(new URL("./outbox.jsonl", import.meta.url).pathname,
      JSON.stringify(sent) + "\n", { append: true });
    return new Response(JSON.stringify({ id: "sent-" + crypto.randomUUID() }), { status: 200 });
  }
  return realFetch(input, init);
};
const serve = Deno.serve;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (handler: any) =>
  serve({ port: Number(Deno.env.get("PORT") ?? 8803), hostname: "127.0.0.1" }, handler);
await import("../weekly-digest/index.ts");
