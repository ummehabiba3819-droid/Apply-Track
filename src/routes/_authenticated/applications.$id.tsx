import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateCoverLetter } from "@/lib/ai.functions";
import { STATUSES, STATUS_LABEL, STATUS_BAR, type Application, type Status } from "@/lib/applications";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Copy, Sparkles, Trash2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applications/$id")({
  component: DetailPage,
});

function DetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const genFn = useServerFn(generateCoverLetter);
  const [editing, setEditing] = useState(false);

  const { data: app, isLoading } = useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Application | null;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Application>) => {
      const { error } = await supabase.from("applications").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application", id] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      setEditing(false);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Deleted");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const generate = useMutation({
    mutationFn: async () => genFn({ data: { applicationId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application", id] });
      toast.success("Cover letter generated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!app) return <p className="text-muted-foreground text-sm">Not found.</p>;

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Log
      </Link>

      <div className={`rounded-lg bg-card border border-border p-6 pl-7 ${STATUS_BAR[app.status]}`}>
        {editing ? (
          <EditForm app={app} onSave={(p) => update.mutate(p)} onCancel={() => setEditing(false)} saving={update.isPending} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Entry</p>
                <h1 className="text-2xl font-semibold">{app.role}</h1>
                <p className="text-foreground/80 mt-0.5">{app.company}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={app.status} />
                <span className="font-mono text-xs text-muted-foreground">{app.date_applied}</span>
              </div>
            </div>

            {app.job_description && (
              <section className="mt-6">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">Job description</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{app.job_description}</p>
              </section>
            )}
            {app.notes && (
              <section className="mt-6">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">Notes</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{app.notes}</p>
              </section>
            )}

            <div className="mt-6 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>

      <CoverLetterCard
        coverLetter={app.cover_letter}
        loading={generate.isPending}
        onGenerate={() => generate.mutate()}
      />
    </div>
  );
}

function EditForm({ app, onSave, onCancel, saving }: { app: Application; onSave: (p: Partial<Application>) => void; onCancel: () => void; saving: boolean }) {
  const [company, setCompany] = useState(app.company);
  const [role, setRole] = useState(app.role);
  const [jobDescription, setJobDescription] = useState(app.job_description);
  const [status, setStatus] = useState<Status>(app.status);
  const [dateApplied, setDateApplied] = useState(app.date_applied);
  const [notes, setNotes] = useState(app.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ company, role, job_description: jobDescription, status, date_applied: dateApplied, notes });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Company</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>Role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} required /></div>
      </div>
      <div className="space-y-1.5"><Label>Job description</Label><Textarea rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Date applied</Label><Input type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function CoverLetterCard({ coverLetter, loading, onGenerate }: { coverLetter: string | null; loading: boolean; onGenerate: () => void }) {
  const copy = () => {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter);
    toast.success("Copied");
  };

  return (
    <div className="rounded-lg bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">AI</p>
          <h2 className="text-lg font-semibold">Tailored cover letter</h2>
        </div>
        <div className="flex gap-2">
          {coverLetter && (
            <Button variant="outline" size="sm" onClick={copy}><Copy className="w-4 h-4 mr-1" /> Copy</Button>
          )}
          <Button size="sm" onClick={onGenerate} disabled={loading}>
            {coverLetter ? <RefreshCw className="w-4 h-4 mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {loading ? "Generating…" : coverLetter ? "Regenerate" : "Generate cover letter"}
          </Button>
        </div>
      </div>
      {coverLetter ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{coverLetter}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Uses your saved background from the Profile page plus this job's description to draft a tailored letter.
        </p>
      )}
    </div>
  );
}
