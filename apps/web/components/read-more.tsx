"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

function clampText(text: string, limit: number) {
    const t = (text || "").trim();
    if (t.length <= limit) return { clamped: t, isClamped: false };
    return { clamped: t.slice(0, limit).trimEnd() + "…", isClamped: true };
}

export function ReadMore({
    text,
    limit = 400,
    className,
}: {
    text: string;
    limit?: number;
    className?: string;
}) {
    const [open, setOpen] = React.useState(false);

    const { clamped, isClamped } = React.useMemo(() => clampText(text, limit), [text, limit]);

    return (
        <div className={className}>
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {open || !isClamped ? text : clamped}
            </pre>

            {isClamped ? (
                <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
                        {open ? "Show less" : "Show more"}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
