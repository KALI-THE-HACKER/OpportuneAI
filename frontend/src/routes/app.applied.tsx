import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Send,
  Search,
  ExternalLink,
  Mail,
  ChevronDown,
  FileEdit,
  Trash2,
  CheckCircle2,
  Clock,
  Briefcase,
  X,
  Plus,
  Compass,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

import { jobsApi } from "@/lib/api";
import { type ApplicationStatus } from "@/lib/mock/jobs";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { MatchBadge } from "@/components/shared/job-card";
import { formatSalary, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/applied")({
  head: () => ({ meta: [{ title: "Applications · OpportuneAI" }] }),
  component: AppliedPage,
});

const STATUS_CONFIG: Record<
  ApplicationStatus | "withdrawn",
  { label: string; badgeClass: string; dotClass: string }
> = {
  applied: {
    label: "Applied",
    badgeClass:
      "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
    dotClass: "bg-blue-500",
  },
  interviewing: {
    label: "Interviewing",
    badgeClass:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  offer: {
    label: "Offer",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-surface text-muted-foreground border border-border",
    dotClass: "bg-muted-foreground/50",
  },
  saved: {
    label: "Saved",
    badgeClass: "bg-surface text-muted-foreground border border-border",
    dotClass: "bg-muted-foreground/50",
  },
  withdrawn: {
    label: "Withdrawn",
    badgeClass: "bg-surface text-muted-foreground border border-border",
    dotClass: "bg-muted-foreground/40",
  },
};

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "applied", label: "Applied" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offer", label: "Offers" },
  { id: "rejected", label: "Rejected" },
];

function AppliedPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNoteAppId, setEditingNoteAppId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");

  const q = useQuery({
    queryKey: ["applications"],
    queryFn: () => jobsApi.applications(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status?: ApplicationStatus;
      notes?: string;
    }) => jobsApi.updateApplication(id, { status, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingNoteAppId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobsApi.deleteApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const allApplications = q.data ?? [];

  // Filter applications by active status tab and search term
  const filteredApplications = allApplications.filter((app) => {
    if (activeTab !== "all" && app.status !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      const matchTitle = app.job?.title?.toLowerCase().includes(qLower);
      const matchCompany = app.job?.company?.toLowerCase().includes(qLower);
      const matchLocation = app.job?.location?.toLowerCase().includes(qLower);
      const matchSkills = app.job?.skills?.some((s) => s.toLowerCase().includes(qLower));
      if (!matchTitle && !matchCompany && !matchLocation && !matchSkills) {
        return false;
      }
    }
    return true;
  });

  // Calculate counts for badges in tabs
  const tabCounts: Record<string, number> = {
    all: allApplications.length,
    applied: allApplications.filter((a) => a.status === "applied").length,
    interviewing: allApplications.filter((a) => a.status === "interviewing").length,
    offer: allApplications.filter((a) => a.status === "offer").length,
    rejected: allApplications.filter((a) => a.status === "rejected").length,
  };

  function openNoteEditor(appId: string, currentNotes?: string) {
    setEditingNoteAppId(appId);
    setNoteContent(currentNotes ?? "");
  }

  function handleSaveNotes(appId: string) {
    updateMutation.mutate({ id: appId, notes: noteContent });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Track and manage the progress of every role you've applied to in real time."
        actions={
          allApplications.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                {allApplications.length} applied {allApplications.length === 1 ? "role" : "roles"}
              </span>
              <Link
                to="/app/jobs"
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="size-3.5" />
                Find more jobs
              </Link>
            </div>
          ) : undefined
        }
      />

      {q.isLoading ? (
        <LoadingState variant="table" count={5} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : allApplications.length === 0 ? (
        <EmptyState
          icon={<Send className="size-6 text-brand" />}
          title="No applications tracked yet"
          description="When you apply to jobs directly or through email outreach, your real application records and status timeline will appear here."
          action={
            <Link
              to="/app/jobs"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              <Compass className="size-4" />
              Explore Job Recommendations
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Filter Bar: Tabs + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {TABS.map((tab) => {
                const count = tabCounts[tab.id] ?? 0;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-all duration-150 cursor-pointer
                      ${
                        isActive
                          ? "bg-foreground text-background font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface"
                      }
                    `}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`
                        text-[10px] px-1.5 py-0.2 rounded-full font-bold
                        ${
                          isActive
                            ? "bg-background/20 text-background"
                            : "bg-surface text-muted-foreground"
                        }
                      `}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick search input */}
            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search by role, company, skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-7 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-accent transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Applications Content */}
          {filteredApplications.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded-xl shadow-card space-y-3">
              <div className="size-10 rounded-xl bg-surface border border-border grid place-items-center text-muted-foreground mx-auto">
                <AlertCircle className="size-5 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No applications found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery
                  ? `No applications matched "${searchQuery}". Try a different keyword or clear search.`
                  : `You don't have any applications marked as "${activeTab}".`}
              </p>
              {(searchQuery || activeTab !== "all") && (
                <button
                  onClick={() => {
                    setActiveTab("all");
                    setSearchQuery("");
                  }}
                  className="text-xs font-semibold text-accent hover:underline cursor-pointer pt-1"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface/70 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest">
                        Role & Company
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest hidden md:table-cell">
                        Location / Salary
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest">
                        Applied
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest hidden lg:table-cell">
                        Notes
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredApplications.map((a) => {
                      const status = STATUS_CONFIG[a.status] ?? STATUS_CONFIG["applied"];
                      const isEditingNote = editingNoteAppId === a.id;

                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-surface/40 transition-colors duration-100 group"
                        >
                          {/* Role & Company */}
                          <td className="px-5 py-4 min-w-[220px]">
                            <div className="flex items-start gap-3">
                              <div className="size-9 shrink-0 rounded-lg bg-surface border border-border grid place-items-center font-mono text-xs font-bold text-muted-foreground shadow-xs">
                                {a.job.company ? a.job.company.slice(0, 2).toUpperCase() : "CO"}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  to="/app/jobs/$jobId"
                                  params={{ jobId: a.jobId }}
                                  className="font-semibold text-foreground hover:text-accent transition-colors block truncate"
                                >
                                  {a.job.title}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground truncate">
                                    {a.job.company}
                                  </span>
                                  {a.job.matchScore > 0 && (
                                    <div className="scale-85 origin-left">
                                      <MatchBadge score={a.job.matchScore} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Location & Salary */}
                          <td className="px-5 py-4 text-xs text-muted-foreground hidden md:table-cell min-w-[160px]">
                            <div className="space-y-0.5">
                              <div className="text-foreground/90 font-medium">
                                {a.job.location || "Remote"} · {a.job.workMode || "Full-time"}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {formatSalary(a.job.salaryMin, a.job.salaryMax)}
                              </div>
                            </div>
                          </td>

                          {/* Applied Time */}
                          <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">
                            <div className="flex items-center gap-1.5">
                              <Clock className="size-3.5 opacity-60" />
                              <span>{timeAgo(a.appliedAt)}</span>
                            </div>
                          </td>

                          {/* Status Selector Dropdown */}
                          <td className="px-5 py-4 min-w-[150px]">
                            <div className="relative inline-block">
                              <select
                                value={a.status}
                                onChange={(e) =>
                                  updateMutation.mutate({
                                    id: a.id,
                                    status: e.target.value as ApplicationStatus,
                                  })
                                }
                                disabled={updateMutation.isPending}
                                className={`
                                  appearance-none pl-6 pr-6 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border cursor-pointer
                                  focus:outline-hidden focus:ring-1 focus:ring-accent transition-all
                                  ${status.badgeClass}
                                `}
                              >
                                <option value="applied">Applied</option>
                                <option value="interviewing">Interviewing</option>
                                <option value="offer">Offer</option>
                                <option value="rejected">Rejected</option>
                                <option value="withdrawn">Withdrawn</option>
                              </select>
                              <span
                                className={`absolute left-2.5 top-1/2 -translate-y-1/2 size-2 rounded-full pointer-events-none ${status.dotClass}`}
                              />
                              <ChevronDown className="size-3 absolute right-2 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="px-5 py-4 text-xs text-muted-foreground hidden lg:table-cell max-w-[240px]">
                            {isEditingNote ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={noteContent}
                                  onChange={(e) => setNoteContent(e.target.value)}
                                  placeholder="Recruiter, round notes..."
                                  className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveNotes(a.id);
                                    if (e.key === "Escape") setEditingNoteAppId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveNotes(a.id)}
                                  disabled={updateMutation.isPending}
                                  className="h-7 px-2 bg-brand text-brand-foreground rounded text-[10px] font-semibold hover:opacity-90 shrink-0 cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingNoteAppId(null)}
                                  className="h-7 px-1.5 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => openNoteEditor(a.id, a.notes)}
                                className="group/note flex items-center justify-between gap-1.5 p-1 -m-1 rounded hover:bg-surface cursor-pointer"
                                title="Click to edit notes"
                              >
                                <span className="truncate">
                                  {a.notes ? (
                                    <span className="text-foreground/90">{a.notes}</span>
                                  ) : (
                                    <span className="text-muted-foreground/60 italic">
                                      + Add notes
                                    </span>
                                  )}
                                </span>
                                <FileEdit className="size-3 text-muted-foreground opacity-0 group-hover/note:opacity-100 shrink-0 transition-opacity" />
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right whitespace-nowrap min-w-[140px]">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Direct apply link if available */}
                              {a.job.applyUrl && (
                                <a
                                  href={a.job.applyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-border bg-surface hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  title="Open external job post"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              )}

                              {/* Outreach email if contact exists */}
                              {a.job.contactEmail && (
                                <a
                                  href={`mailto:${a.job.contactEmail}`}
                                  className="p-1.5 rounded-lg border border-border bg-surface hover:bg-card text-muted-foreground hover:text-accent transition-colors cursor-pointer"
                                  title={`Email ${a.job.contactName || "Recruiter"}`}
                                >
                                  <Mail className="size-3.5" />
                                </a>
                              )}

                              {/* View Details */}
                              <Link
                                to="/app/jobs/$jobId"
                                params={{ jobId: a.jobId }}
                                className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-border bg-surface hover:bg-card text-xs font-semibold text-foreground hover:text-accent transition-colors"
                              >
                                <span>Details</span>
                                <span className="text-xs">→</span>
                              </Link>

                              {/* Delete / Remove */}
                              <button
                                onClick={() => {
                                  if (confirm("Remove this application from tracking?")) {
                                    deleteMutation.mutate(a.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove application"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
