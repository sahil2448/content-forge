"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

type CreateResp =
  | { success: true; requestId: string; message?: string }
  | { success: false; error?: string };

export default function HomePage() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const p = fetch("/api/create-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl, userEmail }),
    });

    toast.promise(p, {
      loading: "Starting generation…",
      success: async (res) => {
        const data = (await res.json().catch(() => ({}))) as CreateResp;
        if (!res.ok || !data || data.success === false) throw new Error(data?.error || "Failed");
        router.push(`/request/${data.requestId}`);
        return `Request started (ID: ${data.requestId})`;
      },
      error: (err) => err?.message ?? "Failed to start request",
    });

    try {
      await p;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-10">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500" />
            <div>
              <div className="text-xl font-semibold">ContentForge</div>
              <div className="text-sm text-muted-foreground">
                YouTube → Transcript → Posts → Review → Email approval → Publish
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="secondary">Motia workflows</Badge>
            <Badge variant="secondary">OpenRouter generation</Badge>
            <Badge variant="secondary">UI review</Badge>
            <Badge variant="secondary">Email approval</Badge>
          </div>

          <Separator className="mt-6" />
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Generate content</CardTitle>
              <CardDescription>Paste a YouTube link and get the content in the dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="youtubeUrl">YouTube URL</Label>
                  <Input
                    id="youtubeUrl"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Start generation"
                  )}
                </Button>

              </form>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Flow</CardTitle>
              <CardDescription>Optimized for demo + real users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>1) Submit URL + email</div>
              <div>2) Transcript + content generated</div>
              <div>3) Review content in UI</div>
              <div>4) Click “Send approval email”</div>
              <div>5) Approve from email → publish unlocks in UI</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
