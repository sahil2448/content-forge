export async function GET(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const action = url.searchParams.get("action") ?? "";
    const upstream = `${process.env.MOTIA_BASE_URL}/api/approve?id=${encodeURIComponent(id)}&action=${encodeURIComponent(action)}`;

    const res = await fetch(upstream, { cache: "no-store" });
    const html = await res.text();

    return new Response(html, {
        status: res.status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
