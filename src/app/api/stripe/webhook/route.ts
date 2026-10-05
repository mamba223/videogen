export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const sig = req.headers.get("stripe-signature");

  // In production, verify signature with STRIPE_WEBHOOK_SECRET
  let event: any;
  try {
    event = JSON.parse(bodyText);
  } catch (err) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.metadata?.userId;
    const credits = Number(session?.metadata?.credits);

    if (userId && credits > 0) {
      const sbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (sbUrl && sbServiceKey) {
        const sb = createClient(sbUrl, sbServiceKey, { auth: { persistSession: false } });

        // Record purchase in credit ledger
        await sb.from("credit_ledger").insert({
          user_id: userId,
          delta: credits,
          reason: `stripe_checkout_${session.id || "session"}`,
        });

        // Refill profile credits
        const { data: profile } = await sb
          .from("profiles")
          .select("credits")
          .eq("id", userId)
          .single();

        const currentCredits = profile?.credits ?? 0;
        await sb
          .from("profiles")
          .update({ credits: currentCredits + credits })
          .eq("id", userId);

        console.log(`[Stripe Webhook] Credited ${credits} to user ${userId}`);
      }
    }
  }

  return Response.json({ received: true });
}
