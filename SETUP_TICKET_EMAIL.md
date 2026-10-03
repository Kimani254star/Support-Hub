# Automatic ticket-conversation emails (one-time setup)

The panel calls a Supabase Edge Function named `send-ticket-email`. It sends through Resend (free tier is fine).

1. Create a Resend account, verify your sending domain, and copy an API key.
2. Install the Supabase CLI and link your project:  `supabase login`  then  `supabase link --project-ref YOUR_PROJECT_REF`
3. Set the secrets:
   ```
   supabase secrets set RESEND_API_KEY=re_xxx \
     FROM_EMAIL="Acacia Books Support <support@yourdomain.com>" \
     BRAND_NAME="Acacia Books Support" \
     REPLY_TO=support@yourdomain.com \
     SUPPORT_BCC=you@yourdomain.com
   ```
   (REPLY_TO and SUPPORT_BCC are optional.)
4. Deploy:  `supabase functions deploy send-ticket-email`
5. In the panel: Settings > Preferences has a checkbox to turn the automatic email on or off.

Notes
- The email goes to `user_email` on the ticket (acacia_tickets). Tickets without it are skipped.
- Re-resolving the same conversation does not send it twice; History > Email transcript always re-sends.
