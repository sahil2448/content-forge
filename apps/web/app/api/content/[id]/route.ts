import { NextResponse } from "next/server";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const res = await fetch(
        `${process.env.MOTIA_BASE_URL}/content?id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}
