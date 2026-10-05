export const runtime = "nodejs";

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  description: string;
}

export const CREDIT_PACKS: Record<string, CreditPack> = {
  starter: {
    id: "starter",
    name: "Creator Pack",
    credits: 50,
    priceCents: 900,
    description: "50 scenes (~10 quick videos or 2 full multi-scene episodes)",
  },
  series: {
    id: "series",
    name: "Series Director",
    credits: 200,
    priceCents: 2500,
    description: "200 scenes (A full 10-episode series with character consistency)",
  },
  studio: {
    id: "studio",
    name: "Studio Unlimited",
    credits: 600,
    priceCents: 5900,
    description: "600 scenes (Best value for ongoing daily publishing)",
  },
};

export async function POST(req: Request) {
  try {
    const { packId, userId, successUrl, cancelUrl } = await req.json();

    const pack = CREDIT_PACKS[packId];
    if (!pack) {
      return Response.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    // Real Stripe Integration if API key is provided
    if (process.env.STRIPE_SECRET_KEY) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const origin = req.headers.get("origin") || "http://localhost:3000";

      const params = new URLSearchParams({
        "payment_method_types[0]": "card",
        mode: "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(pack.priceCents),
        "line_items[0][price_data][product_data][name]": `ReelForge ${pack.name} (${pack.credits} Credits)`,
        "line_items[0][price_data][product_data][description]": pack.description,
        "line_items[0][quantity]": "1",
        "metadata[userId]": userId,
        "metadata[credits]": String(pack.credits),
        "metadata[packId]": pack.id,
        success_url: successUrl || `${origin}/profile?checkout=success&credits=${pack.credits}`,
        cancel_url: cancelUrl || `${origin}/profile?checkout=cancelled`,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!stripeRes.ok) {
        const errText = await stripeRes.text();
        return Response.json({ error: `Stripe API error: ${errText.slice(0, 200)}` }, { status: 500 });
      }

      const session = await stripeRes.json();
      return Response.json({ url: session.url });
    }

    // Demo / Dev Mode Fallback:
    const origin = req.headers.get("origin") || "http://localhost:3000";
    return Response.json({
      url: `${origin}/profile?checkout=mock_success&credits=${pack.credits}&pack=${pack.id}`,
      mock: true,
      credits: pack.credits,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Checkout error" },
      { status: 500 }
    );
  }
}
