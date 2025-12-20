"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ReadMore } from "@/components/read-more";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContentState = {
    requestId: string;
    userEmail: string;
    youtubeUrl?: string;
    transcript?: string;
    blogPost?: string;
    tweet?: string;
    linkedinPost?: string;
    status: string;
    results?: {
        blog?: { url?: string };
        tweet?: { url?: string };
        linkedin?: { url?: string };
    };
    createdAt?: string;
    decidedAt?: string;
    publishedAt?: string;
};

type ApiResp =
    | { success: true; data: ContentState }
    | { success: false; error?: string };

function statusBadge(status?: string) {
    const s = (status || "").toLowerCase();
    if (s === "published") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Published</Badge>;
    if (s === "publishing") return <Badge className="bg-amber-600 hover:bg-amber-600">Publishing</Badge>;
    if (s === "approved") return <Badge className="bg-sky-600 hover:bg-sky-600">Approved</Badge>;
    if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (s === "pending_approval") return <Badge variant="secondary">Pending approval</Badge>;
    if (s === "generated") return <Badge variant="secondary">Generated</Badge>;
    if (s === "expired") return <Badge variant="destructive">Expired</Badge>;
    return <Badge variant="secondary">{status || "Queued"}</Badge>;
}

function isFinal(status?: string) {
    return status === "published" || status === "rejected" || status === "expired";
}

async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
}

export default function RequestPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const requestId = params.id;


    const [data, setData] = React.useState<ContentState | null>(null);

    const [initialLoading, setInitialLoading] = React.useState(true);
    const [backgroundFetching, setBackgroundFetching] = React.useState(false);

    const [fatalError, setFatalError] = React.useState<string | null>(null);
    const [consecutiveErrors, setConsecutiveErrors] = React.useState(0);

    const [handles, setHandles] = React.useState({ devto: "", x: "", linkedin: "" });
    const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRef = React.useRef(false);
    const [manualRefreshing, setManualRefreshing] = React.useState(false);


    const status = data?.status;
    const canSendEmail = status === "generated";
    const canPublish = status === "approved";

    const hasGeneratedContent = Boolean(
        data?.transcript?.trim() || data?.blogPost?.trim() || data?.tweet?.trim() || data?.linkedinPost?.trim()
    );

    const showSpinner = initialLoading || (!hasGeneratedContent && !fatalError);

    async function fetchLatest(opts?: { silent?: boolean }) {
        const silent = opts?.silent ?? true;
        if (inFlightRef.current) return;

        inFlightRef.current = true;
        if (!silent) setManualRefreshing(true);

        try {
            const res = await fetch(`/api/content/${requestId}`, { cache: "no-store" });

            if (res.status === 404 && !data) return;

            const json = (await res.json().catch(() => ({}))) as ApiResp;

            if (!res.ok) {
                if (json && typeof json === "object" && "success" in json && json.success === false) {
                    throw new Error(json.error || `Failed to fetch (${res.status})`);
                }
                throw new Error(`Failed to fetch (${res.status})`);
            }

            if (!json || json.success === false) {
                throw new Error(json?.error || "Failed to fetch");
            }

            setData(json.data);
            setFatalError(null);
            setConsecutiveErrors(0);
        } catch (e: any) {
            setConsecutiveErrors((prev) => {
                const next = prev + 1;
                if (next >= 3) setFatalError(e?.message ?? "Failed to fetch");
                return next;
            });
        } finally {
            setInitialLoading(false);
            if (!silent) setManualRefreshing(false);
            inFlightRef.current = false;
        }

    }

    async function manualRefresh() {
        await fetchLatest({ silent: false });
    }
    React.useEffect(() => {
        let alive = true;

        const schedule = (ms: number) => {
            if (!alive) return;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            pollTimerRef.current = setTimeout(tick, ms);
        };

        const tick = async () => {
            if (!alive) return;

            await fetchLatest({ silent: true });

            const s = (data?.status || "").toLowerCase();
            if (s === "published" || s === "rejected" || s === "expired") return;

            if (!data || s === "queued" || s === "generate" || s === "transcript" || s === "publishing") {
                schedule(900);
                return;
            }

            if (s === "pending_approval") {
                schedule(1200);
                return;
            }

            schedule(1200);
        };

        tick();

        return () => {
            alive = false;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, [requestId]);


    async function sendApprovalEmail() {
        const p = fetch("/api/send-approval-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId }),
        });

        toast.promise(p, {
            loading: "Sending approval email…",
            success: async (res) => {
                const j = await res.json().catch(() => ({}));
                if (!res.ok || j?.success === false) throw new Error(j?.error || "Failed");

                setData((d) => (d ? { ...d, status: "pending_approval" } : d));

                return "Email sent. Waiting for approval…";
            },
            error: (e) => e?.message ?? "Failed to send email",
        });

        await p;
        // await refreshOnce();
    }

    async function publishNow() {
        const payload = {
            requestId,
            handles: {
                devto: handles.devto || undefined,
                x: handles.x || undefined,
                linkedin: handles.linkedin || undefined,
            },
        };

        const p = fetch("/api/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        toast.promise(p, {
            loading: "Publishing…",
            success: async (res) => {
                const j = await res.json().catch(() => ({}));
                if (!res.ok || j?.success === false) throw new Error(j?.error || "Failed");

                setData((d) => (d ? { ...d, status: "publishing" } : d));

                return "Publish started.";
            },
            error: (e) => e?.message ?? "Publish failed",
        });

        await p;
        // await refreshOnce();
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>

                        <div>
                            <div className="text-xl font-semibold">Request</div>
                            <div className="text-sm text-muted-foreground">ID: {requestId}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {statusBadge(data?.status)}
                        <Button variant="outline" onClick={manualRefresh} disabled={manualRefreshing}>
                            {manualRefreshing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Refresh
                                </>
                            ) : (
                                "Refresh"
                            )}
                        </Button>

                    </div>
                </div>

                <Card className="border-border/60">
                    <CardHeader>
                        <CardTitle>Live workflow</CardTitle>
                        <CardDescription>
                            {showSpinner ? "Working…" : "Up to date."}{" "}
                            {data?.status === "pending_approval" ? "Approve/Reject from email to unlock Publish." : null}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {fatalError ? (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                Couldn’t load status: {fatalError}
                            </div>
                        ) : null}

                        <div className="text-sm">
                            <span className="text-muted-foreground">YouTube:</span>{" "}
                            {data?.youtubeUrl ? (
                                <a className="underline underline-offset-4" href={data.youtubeUrl} target="_blank" rel="noreferrer">
                                    Open video
                                </a>
                            ) : (
                                <span className="text-muted-foreground">Waiting…</span>
                            )}
                        </div>

                        <div className="text-sm">
                            <span className="text-muted-foreground">Email:</span> {data?.userEmail || <span className="text-muted-foreground">Waiting…</span>}
                        </div>

                        <Separator />

                        {showSpinner ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating transcript + content… (auto-updating)
                            </div>
                        ) : null}

                        {canSendEmail ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={sendApprovalEmail}>Send approval email</Button>
                                <div className="text-xs text-muted-foreground">
                                    Review here → send email → approve from inbox → publish unlocks.
                                </div>
                            </div>
                        ) : null}

                        {data?.status === "pending_approval" ? (
                            <div className="text-sm text-muted-foreground">Waiting for email approval…</div>
                        ) : null}

                        {canPublish ? (
                            <div className="space-y-3">
                                <Separator />
                                <div className="text-sm font-medium">Where to publish</div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Dev.to username (optional)</Label>
                                        <Input value={handles.devto} onChange={(e) => setHandles((h) => ({ ...h, devto: e.target.value }))} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>X handle (optional)</Label>
                                        <Input value={handles.x} onChange={(e) => setHandles((h) => ({ ...h, x: e.target.value }))} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>LinkedIn handle (optional)</Label>
                                        <Input value={handles.linkedin} onChange={(e) => setHandles((h) => ({ ...h, linkedin: e.target.value }))} />
                                    </div>
                                </div>

                                <Button onClick={publishNow}>Publish</Button>
                            </div>
                        ) : null}

                        {data?.status === "published" && data?.results ? (
                            <>
                                <Separator />
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <Link className="text-sm underline underline-offset-4" target="_blank" href={data.results.blog?.url || "#"}>
                                        Blog link
                                    </Link>
                                    <Link className="text-sm underline underline-offset-4" target="_blank" href={data.results.tweet?.url || "#"}>
                                        Tweet link
                                    </Link>
                                    <Link className="text-sm underline underline-offset-4" target="_blank" href={data.results.linkedin?.url || "#"}>
                                        LinkedIn link
                                    </Link>
                                </div>
                            </>
                        ) : null}
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-border/60 h-fit">
                        <CardHeader>
                            <CardTitle>Transcript</CardTitle>
                            <CardDescription>Auto-filled when ready.</CardDescription>
                        </CardHeader>

                        <CardContent>
                            {showSpinner && !data?.transcript ? (
                                <Skeleton className="h-40 w-full" />
                            ) : data?.transcript ? (
                                <ReadMore text={data.transcript} limit={1025} className="rounded-md border bg-background p-3" />
                            ) : (
                                <div className="text-sm text-muted-foreground">Transcript will appear here…</div>
                            )}


                            <div className="mt-3 flex gap-2">
                                <Button variant="outline" disabled={!data?.transcript} onClick={() => copyToClipboard(data?.transcript || "", "transcript")}>
                                    Copy
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60">
                        <CardHeader>
                            <CardTitle>Generated content</CardTitle>
                            <CardDescription>Blog / Tweet / LinkedIn</CardDescription>
                        </CardHeader>

                        <CardContent>
                            {!hasGeneratedContent && showSpinner ? (
                                <Skeleton className="h-40 w-full" />
                            ) : (
                                <Tabs defaultValue="blog" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="blog">Blog</TabsTrigger>
                                        <TabsTrigger value="tweet">Tweet</TabsTrigger>
                                        <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="blog" className="space-y-2">
                                        <Textarea readOnly value={data?.blogPost || ""} className="min-h-[220px]" />
                                        <Button variant="outline" disabled={!data?.blogPost} onClick={() => copyToClipboard(data?.blogPost || "", "blog")}>
                                            Copy blog
                                        </Button>
                                    </TabsContent>

                                    <TabsContent value="tweet" className="space-y-2">
                                        <Textarea readOnly value={data?.tweet || ""} className="min-h-[220px]" />
                                        <Button variant="outline" disabled={!data?.tweet} onClick={() => copyToClipboard(data?.tweet || "", "tweet")}>
                                            Copy tweet
                                        </Button>
                                    </TabsContent>

                                    <TabsContent value="linkedin" className="space-y-2">
                                        <Textarea readOnly value={data?.linkedinPost || ""} className="min-h-[220px]" />
                                        <Button variant="outline" disabled={!data?.linkedinPost} onClick={() => copyToClipboard(data?.linkedinPost || "", "linkedin")}>
                                            Copy LinkedIn
                                        </Button>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
