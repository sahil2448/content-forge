import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const body = await req.json();
    const res = await fetch(`${process.env.MOTIA_BASE_URL}/create-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}
