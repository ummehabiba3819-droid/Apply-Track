export type Status = "applied" | "interview" | "offer" | "rejected";

export const STATUSES: Status[] = ["applied", "interview", "offer", "rejected"];

export const STATUS_LABEL: Record<Status, string> = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export const STATUS_BAR: Record<Status, string> = {
  applied: "status-bar-applied",
  interview: "status-bar-interview",
  offer: "status-bar-offer",
  rejected: "status-bar-rejected",
};

export const STATUS_DOT: Record<Status, string> = {
  applied: "bg-status-applied",
  interview: "bg-status-interview",
  offer: "bg-status-offer",
  rejected: "bg-status-rejected",
};

export const STATUS_TEXT: Record<Status, string> = {
  applied: "text-status-applied",
  interview: "text-status-interview",
  offer: "text-status-offer",
  rejected: "text-status-rejected",
};

export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  job_description: string;
  status: Status;
  date_applied: string;
  notes: string | null;
  cover_letter: string | null;
  created_at: string;
  updated_at: string;
}
