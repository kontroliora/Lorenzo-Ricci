import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildRecoveryEmail } from "@/lib/recovery-email";

const TEST_RECIPIENT = "dserbezov7@gmail.com";

// Mock abandoned cart — cardholder + watch
const MOCK_SESSION = {
  session_id:  "test-session-001",
  email:       TEST_RECIPIENT,
  name:        "Давид Сербезов",
  phone:       "0888123456",
  subtotal:    159.00,
  updated_at:  new Date(Date.now() - 75 * 60 * 1000).toISOString(), // 75 min ago
  items: [
    {
      name:     "Lorenzo Ricci Bianco — Бял кардхолдър",
      sku:      "LR-CH-BIANCO",
      slug:     "cardholder-bianco",
      price:    55.00,
      currency: "€",
      quantity: 1,
      coverImage: {
        src: "https://lorenzo-ricci.com/products/cardholders/bianco-cover.jpg",
        alt: "Bianco Cardholder",
      },
    },
    {
      name:     "Lorenzo Ricci Chrono Black — Часовник",
      sku:      "LR-W-CHRONO-BLK",
      slug:     "chrono-black",
      price:    104.00,
      currency: "€",
      quantity: 1,
      coverImage: {
        src: "https://lorenzo-ricci.com/products/watches/chrono-black-cover.jpg",
        alt: "Chrono Black Watch",
      },
    },
  ],
};

// GET /api/test/recovery-email
// Sends a test recovery email to dserbezov7@gmail.com.
// Only callable when RESEND_API_KEY is set.

export async function GET() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY not configured" },
      { status: 503 }
    );
  }

  const html = buildRecoveryEmail(MOCK_SESSION);
  const resend = new Resend(resendKey);

  const { data, error } = await resend.emails.send({
    from:    "Lorenzo Ricci <info@lorenzo-ricci.com>",
    to:      TEST_RECIPIENT,
    subject: "Вашата количка ви очаква — Lorenzo Ricci",
    html,
  });

  if (error) {
    console.error("[TestRecoveryEmail] Resend error:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  console.log("[TestRecoveryEmail] Sent to", TEST_RECIPIENT, "id:", data?.id);
  return NextResponse.json({ ok: true, to: TEST_RECIPIENT, id: data?.id });
}
