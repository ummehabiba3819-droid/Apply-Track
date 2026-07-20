import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, STATUS_BAR, STATUS_LABEL, STATUS_DOT, type Application, type Status } from "@/lib/applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | "all">("all");
  const [open, setOpen] = useState(false);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("date_applied", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    for (const s of STATUSES) c[s] = 0;
    for (const a of apps) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [apps]);

  const visible = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  const create = useMutation({
    mutationFn: async (payload: {
      company: string; role: string; job_description: string; status: Status; date_applied: string; notes: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { error } = await supabase.from("applications").insert({ ...payload, user_id: userRes.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      setOpen(false);
      toast.success("Application logged");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Mission log</p>
          <h1 className="text-3xl font-semibold">Applications</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> New entry</Button>
          </DialogTrigger>
          <NewApplicationDialog onSubmit={(p) => create.mutate(p)} loading={create.isPending} />
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_LABEL[s]}
            count={counts[s] ?? 0}
            active={filter === s}
            dot={STATUS_DOT[s]}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {apps.length === 0 ? "No entries yet. Log your first application." : "No applications in this stage."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <Link
              key={a.id}
              to="/applications/$id"
              params={{ id: a.id }}
              className={`block rounded-lg bg-card p-5 pl-6 border border-border hover:border-primary/60 transition ${STATUS_BAR[a.status]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold text-lg truncate">{a.role}</h3>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-foreground/80 truncate">{a.company}</span>
                  </div>
                  {a.notes && <p className="text-sm text-muted-foreground line-clamp-1">{a.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={a.status} />
                  <span className="font-mono text-xs text-muted-foreground">{a.date_applied}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, count, active, onClick, dot }: { label: string; count: number; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
        active ? "bg-accent border-primary/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      <span>{label}</span>
      <span className="font-mono text-xs opacity-70">{count}</span>
    </button>
  );
}

function NewApplicationDialog({ onSubmit, loading }: { onSubmit: (p: { company: string; role: string; job_description: string; status: Status; date_applied: string; notes: string }) => void; loading: boolean }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState<Status>("applied");
  const [dateApplied, setDateApplied] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New application</DialogTitle></DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ company, role, job_description: jobDescription, status, date_applied: dateApplied, notes });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input required value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Input required value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Job description</Label>
          <Textarea rows={5} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the full posting here — the AI uses this for cover letters." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date applied</Label>
            <Input type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Log entry"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
