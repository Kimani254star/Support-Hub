// Supabase Edge Function: emails a support ticket's full conversation to the customer.
// Called from the developer panel when a ticket is resolved (or via History > Email transcript).
// It only needs the ticket id: the ticket, its messages and the recipient are all loaded here,
// using the caller's own login, so nobody can make it email arbitrary text to arbitrary addresses.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id is required" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: t, error } = await sb.from("acacia_tickets").select("*").eq("id", ticket_id).single();
    if (error || !t) return json({ error: "Ticket not found or no access" }, 404);
    if (!t.user_email) return json({ error: "This ticket has no customer email" }, 400);

    const { data: msgs } = await sb
      .from("acacia_ticket_messages").select("*").eq("ticket_id", ticket_id).order("created_at", { ascending: true });
    const list = msgs ?? [];
    const customer = t.user_name || t.user_email;
    const short = String(t.id).slice(0, 8).toUpperCase();
    const brand = Deno.env.get("BRAND_NAME") ?? "Acacia Books Support";

    const text =
      `${brand}\nConversation for: ${t.subject} [${short}]\n\n` +
      list.map((m) => `${m.sender === "customer" ? customer : "Support"} (${new Date(m.created_at).toUTCString()}):\n${m.body}`).join("\n\n---\n\n");

    const rows = list.map((m) => {
      const mine = m.sender !== "customer";
      return `<tr><td style="padding:6px 0;text-align:${mine ? "right" : "left"}">
        <div style="display:inline-block;max-width:80%;text-align:left;padding:10px 14px;border-radius:14px;background:${mine ? "#22615D" : "#f1f1ef"};color:${mine ? "#fff" : "#111"}">
          <div style="font-size:11px;opacity:.7;margin-bottom:3px">${esc(mine ? "Support" : customer)} &middot; ${esc(new Date(m.created_at).toUTCString())}</div>
          <div style="white-space:pre-wrap">${esc(m.body)}</div></div></td></tr>`;
    }).join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">
      <h2 style="color:#0E2B29;margin-bottom:4px">${esc(t.subject)}</h2>
      <p style="color:#666;margin-top:0">Ticket ${esc(short)} &middot; ${esc(t.status)}</p>
      <p>Hi ${esc(customer)}, here is a copy of your conversation with ${esc(brand)}.</p>
      <table width="100%" cellspacing="0" cellpadding="0">${rows}</table>
      <p style="color:#888;font-size:12px;margin-top:24px">Need more help? Just reply to this email.</p></div>`;

    const last = list.length ? list[list.length - 1].created_at : "none";
    const bcc = Deno.env.get("SUPPORT_BCC");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ticket-${ticket_id}-${last}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL"),            // e.g. "Acacia Books Support <support@yourdomain.com>"
        to: [t.user_email],
        ...(bcc ? { bcc: [bcc] } : {}),
        ...(Deno.env.get("REPLY_TO") ? { reply_to: Deno.env.get("REPLY_TO") } : {}),
        subject: `Conversation: ${t.subject} [${short}]`,
        html,
        text,
      }),
    });
    if (!res.ok) return json({ error: "Email provider error: " + (await res.text()) }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
