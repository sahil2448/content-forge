import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { id: string } }) {
    const res = await fetch(
        `${process.env.MOTIA_BASE_URL}/content?id=${encodeURIComponent(params.id)}`,
        { cache: "no-store" }
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}
