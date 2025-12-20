"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

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
    status: string; // generated | pending_approval | approved | rejected | publishing | published
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
    return <Badge variant="secondary">{status || "Unknown"}</Badge>;
}

async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
}

export default function RequestPage() {
    const params = useParams<{ id: string }>();
    const requestId = params.id;

    const [data, setData] = React.useState<ContentState | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [handles, setHandles] = React.useState({ devto: "", x: "", linkedin: "" });

    const canSendEmail = data?.status === "generated";
    const canPublish = data?.status === "approved";

    async function refresh() {
        try {
            setError(null);
            const res = await fetch(`/api/content/${requestId}`, { cache: "no-store" });
            const json = (await res.json().catch(() => ({}))) as ApiResp;

            if (!res.ok || !json || json.success === false) {
                throw new Error(json?.error || `Failed to fetch (${res.status})`);
            }

            setData(json.data);
        } catch (e: any) {
            setError(e?.message ?? "Failed to fetch");
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        refresh();
        const t = setInterval(refresh, 2000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                return "Email sent. Waiting for approval…";
            },
            error: (e) => e?.message ?? "Failed to send email",
        });

        await p;
        await refresh();
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
                return "Publish started.";
            },
            error: (e) => e?.message ?? "Publish failed",
        });

        await p;
        await refresh();
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-xl font-semibold">Request</div>
                        <div className="text-sm text-muted-foreground">ID: {requestId}</div>
                    </div>

                    <div className="flex items-center gap-2">
                        {statusBadge(data?.status)}
                        <Button variant="outline" onClick={refresh}>
                            Refresh
                        </Button>
                    </div>
                </div>

                {error ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Couldn’t load status</CardTitle>
                            <CardDescription className="text-red-500">{error}</CardDescription>
                        </CardHeader>
                    </Card>
                ) : null}

                <Card className="border-border/60">
                    <CardHeader>
                        <CardTitle>Workflow</CardTitle>
                        <CardDescription>Auto-refreshing every 2 seconds.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-2/3" />
                                <Skeleton className="h-5 w-1/2" />
                                <Skeleton className="h-5 w-3/4" />
                            </div>
                        ) : (
                            <>
                                <div className="text-sm">
                                    <span className="text-muted-foreground">YouTube:</span>{" "}
                                    {data?.youtubeUrl ? (
                                        <a className="underline underline-offset-4" href={data.youtubeUrl} target="_blank" rel="noreferrer">
                                            Open video
                                        </a>
                                    ) : (
                                        <span className="text-muted-foreground">N/A</span>
                                    )}
                                </div>

                                <div className="text-sm">
                                    <span className="text-muted-foreground">Email:</span> {data?.userEmail || "N/A"}
                                </div>

                                <Separator />

                                {canSendEmail ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Button onClick={sendApprovalEmail}>Send approval email</Button>
                                        <div className="text-xs text-muted-foreground self-center">
                                            Review content here → then approve from email → publishing unlocks.
                                        </div>
                                    </div>
                                ) : null}

                                {data?.status === "pending_approval" ? (
                                    <div className="text-sm text-muted-foreground">
                                        Waiting for email approval… (Approve/Reject from your inbox)
                                    </div>
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
                                                <Input
                                                    value={handles.linkedin}
                                                    onChange={(e) => setHandles((h) => ({ ...h, linkedin: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <Button onClick={publishNow}>Publish</Button>
                                    </div>
                                ) : null}

                                {data?.status === "published" && data?.results ? (
                                    <>
                                        <Separator />
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            <a className="text-sm underline underline-offset-4" target="_blank" rel="noreferrer" href={data.results.blog?.url || "#"}>
                                                Blog link
                                            </a>
                                            <a className="text-sm underline underline-offset-4" target="_blank" rel="noreferrer" href={data.results.tweet?.url || "#"}>
                                                Tweet link
                                            </a>
                                            <a className="text-sm underline underline-offset-4" target="_blank" rel="noreferrer" href={data.results.linkedin?.url || "#"}>
                                                LinkedIn link
                                            </a>
                                        </div>
                                    </>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-border/60">
                        <CardHeader>
                            <CardTitle>Transcript</CardTitle>
                            <CardDescription>Used to generate the content.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-40 w-full" />
                            ) : (
                                <Textarea readOnly value={data?.transcript || ""} className="min-h-[240px]" placeholder="Transcript will appear here…" />
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
                            {loading ? (
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
                                        <Button
                                            variant="outline"
                                            disabled={!data?.linkedinPost}
                                            onClick={() => copyToClipboard(data?.linkedinPost || "", "linkedin")}
                                        >
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
