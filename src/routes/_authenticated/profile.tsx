import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const [bio, setBio] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase.from("profiles").select("bio").eq("user_id", userRes.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { if (data?.bio !== undefined) setBio(data?.bio ?? ""); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: userRes.user.id, bio }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Background saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Dossier</p>
      <h1 className="text-3xl font-semibold mb-6">Your background</h1>

      <div className="rounded-lg bg-card border border-border p-6">
        <div className="space-y-3">
          <Label htmlFor="bio">Resume / background / skills</Label>
          <p className="text-sm text-muted-foreground">
            Paste your resume or write freely about your skills, experience, projects, and education.
            This is reused by the AI to tailor cover letters to each application.
          </p>
          <Textarea
            id="bio"
            rows={16}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isLoading}
            placeholder="Example: 3rd year CS student at UW, built a real-time chat app in Go+React (5k users), interned at Acme doing data pipelines in Python…"
            className="font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
              {save.isPending ? "Saving…" : "Save background"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
