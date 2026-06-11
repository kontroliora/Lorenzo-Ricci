import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const ADMIN_EMAIL = "dserbezov7@gmail.com";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, rating, title, body, productSlug } = data;

    if (!name?.trim() || !body?.trim() || !productSlug) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const review = {
      productSlug,
      author: name.trim(),
      rating: Number(rating) || 5,
      title: title?.trim() || "",
      body: body.trim(),
      date: new Date().toISOString().split("T")[0],
    };

    // Send email notification to admin
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

      await resend.emails.send({
        from: "Lorenzo Ricci <noreply@lorenzo-ricci.com>",
        to: ADMIN_EMAIL,
        subject: `Ново ревю за одобрение — ${productSlug} (${stars})`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
            <h2 style="margin: 0 0 4px; font-size: 18px;">Ново ревю за одобрение</h2>
            <p style="margin: 0 0 20px; color: #666; font-size: 13px;">Изисква се ръчно добавяне в <code>lib/reviews.ts</code></p>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px 0; color: #666; width: 130px;">Продукт</td><td style="padding: 8px 0; font-weight: 600;">${productSlug}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Автор</td><td style="padding: 8px 0;">${review.author}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Рейтинг</td><td style="padding: 8px 0; font-size: 16px;">${stars} (${review.rating}/5)</td></tr>
              ${review.title ? `<tr><td style="padding: 8px 0; color: #666;">Заглавие</td><td style="padding: 8px 0;">${review.title}</td></tr>` : ""}
              <tr><td style="padding: 8px 0; color: #666; vertical-align: top;">Текст</td><td style="padding: 8px 0;">${review.body}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Дата</td><td style="padding: 8px 0;">${review.date}</td></tr>
            </table>

            <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999; margin: 0;">Lorenzo Ricci · Система за ревюта</p>
          </div>
        `,
      });
    } else {
      // Fallback: log to console if no API key configured
      console.log("⚠️  RESEND_API_KEY not set — review logged only:");
      console.log(JSON.stringify(review, null, 2));
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Review submission error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
