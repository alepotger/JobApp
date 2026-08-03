/* Runs the real inbound-email function unmodified. Two things are redirected
   and nothing else: the Supabase client specifier (jsr -> npm, same library,
   same version the page pins) because jsr.io is unreachable here, and the
   listen port, because Deno.serve otherwise fixes it at 8000. */
const serve = Deno.serve;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (handler: any) =>
  serve({ port: Number(Deno.env.get("PORT") ?? 8802), hostname: "127.0.0.1" }, handler);
await import("../inbound-email/index.ts");
