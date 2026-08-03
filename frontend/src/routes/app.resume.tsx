import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  FileText,
  Upload,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { resumeApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";

const resumeSearchSchema = z.object({
  onboarding: z.string().optional(),
});

export const Route = createFileRoute("/app/resume")({
  validateSearch: resumeSearchSchema,
  head: () => ({ meta: [{ title: "Resume · OpportuneAI" }] }),
  component: ResumePage,
});

function ResumePage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/app/resume" });
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["resume"],
    queryFn: () => resumeApi.get(),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Monitor status transitions to alert the user when processing finishes
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentStatus = q.data?.status;
    const prevStatus = prevStatusRef.current;
    if (prevStatus === "processing" && currentStatus === "processed") {
      toast.success("Resume processing complete! Extracted skills added to your profile.");
      void qc.invalidateQueries({ queryKey: ["user"] });
    } else if (prevStatus === "processing" && currentStatus === "failed") {
      toast.error("Resume processing failed. Please check the PDF format and try again.");
    }
    prevStatusRef.current = currentStatus;
  }, [q.data?.status, qc]);

  const upload = useMutation({
    mutationFn: (f: File) => resumeApi.upload(f),
    onSuccess: () => {
      toast.success("Resume uploaded successfully! AI is extracting skills...");
      void qc.invalidateQueries({ queryKey: ["resume"] });
      if (search.onboarding === "true") {
        void navigate({ to: "/app/dashboard" });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Resume upload failed");
    },
  });

  const remove = useMutation({
    mutationFn: () => resumeApi.remove(),
    onSuccess: () => {
      toast.info("Resume removed");
      void qc.invalidateQueries({ queryKey: ["resume"] });
    },
  });

  function handleFiles(files?: FileList | null) {
    const f = files?.[0];
    if (f) {
      console.log("[Resume Upload] Submitting file to backend:", f.name, f.size, f.type);
      upload.mutate(f);
    }
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  async function handleViewResume() {
    try {
      setIsDownloading(true);
      const res = await resumeApi.getDownloadUrl();
      if (res.downloadUrl && res.downloadUrl !== "#") {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.info("Resume stored in local dev mode.");
      }
    } catch {
      toast.error("Failed to generate secure download link.");
    } finally {
      setIsDownloading(false);
    }
  }

  const isProcessing = upload.isPending || q.data?.status === "processing";

  return (
    <>
      <PageHeader
        title="Resume & profile extraction"
        description="Upload once. We extract skills, level, and projects to power every match."
      />

      {search.onboarding === "true" && (
        <div className="mb-6 p-4 bg-accent/5 ring-1 ring-accent/20 rounded-lg flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-accent flex items-center gap-1.5">
              <Sparkles className="size-4 animate-pulse" /> Step 2: Upload your resume
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload your resume to automatically extract your skills, experience, and unlock
              personalized AI recommendations.
            </p>
          </div>
          <Link
            to="/app/dashboard"
            className="text-xs font-medium text-foreground hover:text-accent whitespace-nowrap"
          >
            Skip to Dashboard &rarr;
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`p-10 rounded-lg ring-1 ring-dashed flex flex-col items-center justify-center text-center bg-card transition-colors ${
            dragOver ? "ring-accent bg-accent/5" : "ring-border"
          }`}
        >
          <div className="size-12 grid place-items-center rounded-full bg-surface mb-4">
            {isProcessing ? (
              <Loader2 className="size-5 text-accent animate-spin" />
            ) : (
              <Upload className="size-5 text-muted-foreground" />
            )}
          </div>
          <h3 className="font-medium">
            {isProcessing ? "AI is processing your resume..." : "Drop your resume here"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">PDF, up to 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = "";
              fileRef.current?.click();
            }}
            disabled={isProcessing}
            className="mt-4 h-9 px-4 rounded-md bg-brand text-brand-foreground text-sm font-medium ring-1 ring-brand hover:bg-brand/90 disabled:opacity-60 cursor-pointer inline-flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing…
              </>
            ) : (
              "Choose file"
            )}
          </button>

          {upload.isError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive flex items-center gap-2 max-w-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                {upload.error instanceof Error
                  ? upload.error.message
                  : "Resume upload failed. Please try again."}
              </span>
            </div>
          )}
        </div>

        <aside>
          {q.isLoading ? (
            <LoadingState variant="resume" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : !q.data ? (
            <EmptyState title="No resume on file" description="Upload one to start matching." />
          ) : (
            <div className="p-6 bg-card ring-1 ring-border rounded-lg space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 grid place-items-center rounded-md bg-brand text-brand-foreground shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{q.data.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {q.data.sizeKb} KB · uploaded {timeAgo(q.data.uploadedAt)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleViewResume()}
                  disabled={isDownloading}
                  title="View resume securely"
                  className="size-8 grid place-items-center rounded-md border border-input bg-surface text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors shrink-0"
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ExternalLink className="size-4" />
                  )}
                </button>
              </div>

              {q.data.status === "processing" ? (
                <div className="p-3 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <Sparkles className="size-4 shrink-0 text-amber-500 animate-pulse mt-0.5" />
                  <div>
                    <div className="font-semibold">AI Extraction in Progress</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Extracting technical skills, years of experience, and role preferences...
                    </div>
                  </div>
                </div>
              ) : q.data.status === "processed" ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="size-4" />
                  <span>Processing complete</span>
                </div>
              ) : null}

              <Field label="Status" value={q.data.status} />
              <Field label="Experience level" value={q.data.experienceLevel || "Pending"} />
              <Field label="Total years" value={q.data.yearsTotal ? `${q.data.yearsTotal} yrs` : "Pending"} />
              <Field
                label="Confidence"
                value={q.data.confidence ? `${Math.round(q.data.confidence * 100)}%` : "Pending"}
              />

              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Extracted skills
                </div>
                {q.data.extractedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {q.data.extractedSkills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 text-[11px] rounded bg-muted text-muted-foreground ring-1 ring-border"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {q.data.status === "processing"
                      ? "Skills will appear here automatically once extracted."
                      : "No skills extracted yet."}
                  </p>
                )}
              </div>

              <button
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md ring-1 ring-border text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
              >
                <Trash2 className="size-4" /> Remove resume
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
