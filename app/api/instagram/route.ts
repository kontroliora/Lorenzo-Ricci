import { NextResponse } from "next/server";

export const revalidate = 3600; // refresh every hour

export async function GET() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json({ posts: [] });
  }

  try {
    // Fetch 30 to have enough after filtering - include timestamp so we can sort
    // and bypass pinned posts which Instagram API may return first
    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&limit=30&access_token=${token}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error("Instagram API error:", res.status);
      return NextResponse.json({ posts: [] });
    }

    const data = await res.json();

    if (!data.data) return NextResponse.json({ posts: [] });

    type RawPost = {
      id: string;
      media_type: string;
      media_url: string;
      thumbnail_url?: string;
      permalink: string;
      timestamp: string;
    };

    const posts = (data.data as RawPost[])
      .filter((p) => p.media_type === "IMAGE" || p.media_type === "CAROUSEL_ALBUM")
      // Sort newest-first by actual timestamp - this removes pinned post ordering
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        url: p.media_url || p.thumbnail_url || "",
        permalink: p.permalink,
      }));

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("Instagram fetch error:", err);
    return NextResponse.json({ posts: [] });
  }
}
