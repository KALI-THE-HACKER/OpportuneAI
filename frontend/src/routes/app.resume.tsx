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
  ArrowRight,
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
      toast.success("Resume uploaded! AI is extracting skills…");
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
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["resume"] });
      const previousResume = qc.getQueryData(["resume"]);
      qc.setQueryData(["resume"], null);
      return { previousResume };
    },
    onError: (err, _variables, context) => {
      if (context?.previousResume !== undefined) {
        qc.setQueryData(["resume"], context.previousResume);
      }
      toast.error(
        err instanceof Error ? err.message : "Failed to remove resume. Restored previous state.",
      );
    },
    onSuccess: () => {
      toast.info("Resume removed");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["resume"] });
      void qc.invalidateQueries({ queryKey: ["user"] });
    },
  });

  function handleFiles(files?: FileList | null) {
    const f = files?.[0];
    if (f) {
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
        title="Resume & extraction"
        description="Upload once. We extract skills, level, and experience to power every match."
      />

      {/* Onboarding step banner */}
      {search.onboarding === "true" && (
        <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-accent flex items-center gap-1.5">
              <Sparkles className="size-4 animate-pulse" />
              Step 2: Upload your resume
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload your resume to auto-extract skills and unlock personalized AI recommendations.
            </p>
          </div>
          <Link
            to="/app/dashboard"
            className="text-xs font-semibold text-foreground hover:text-accent whitespace-nowrap flex items-center gap-1 shrink-0"
          >
            Skip
            <ArrowRight className="size-3" />
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* Drop zone */}
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
          className={`
            p-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center
            bg-card transition-all duration-200 cursor-default
            ${
              dragOver
                ? "border-accent bg-accent/5 shadow-[0_0_0_4px_theme(colors.accent/10%)]"
                : "border-border hover:border-foreground/20"
            }
          `}
        >
          <div
            className={`
            size-14 grid place-items-center rounded-2xl mb-5 transition-all duration-200
            ${
              isProcessing
                ? "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : dragOver
                  ? "bg-accent/15 text-accent"
                  : "bg-surface border border-border text-muted-foreground"
            }
          `}
          >
            {isProcessing ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Upload className="size-6" />
            )}
          </div>

          <h3 className="font-semibold text-foreground text-lg">
            {isProcessing ? "AI is processing your resume…" : "Drop your resume here"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 mb-6">PDF format, up to 5MB</p>

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
            className="
              h-10 px-5 inline-flex items-center gap-2 rounded-lg
              bg-brand text-brand-foreground text-sm font-semibold
              border border-brand/80 hover:opacity-90
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-150 shadow-sm cursor-pointer
            "
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Choose file
              </>
            )}
          </button>

          {upload.isError && (
            <div className="mt-5 p-3 bg-destructive/8 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2 max-w-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                {upload.error instanceof Error
                  ? upload.error.message
                  : "Upload failed. Please try again."}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar — resume metadata */}
        <aside className="space-y-4">
          {q.isLoading ? (
            <LoadingState variant="resume" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : !q.data ? (
            <EmptyState
              icon={<FileText className="size-6" />}
              title="No resume on file"
              description="Upload a PDF to start extracting skills and getting matched."
            />
          ) : (
            <>
              {/* File metadata card */}
              <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 grid place-items-center rounded-xl bg-brand text-brand-foreground shrink-0 shadow-sm">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{q.data.fileName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {q.data.sizeKb} KB · {timeAgo(q.data.uploadedAt)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleViewResume()}
                    disabled={isDownloading}
                    title="View resume (expires in 5 min)"
                    className="
                      size-8 grid place-items-center rounded-lg
                      border border-border bg-surface
                      text-muted-foreground hover:text-foreground hover:bg-card
                      shadow-card hover:shadow-elevated
                      transition-all duration-150 shrink-0 cursor-pointer
                    "
                  >
                    {isDownloading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                  </button>
                </div>

                {/* Processing status */}
                {q.data.status === "processing" ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <Sparkles className="size-4 shrink-0 text-amber-500 animate-pulse mt-0.5" />
                    <div>
                      <div className="font-semibold">AI Extraction in Progress</div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        Extracting skills, experience, and role preferences…
                      </div>
                    </div>
                  </div>
                ) : q.data.status === "processed" ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold p-2.5 bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-200 dark:border-emerald-500/20 rounded-lg">
                    <CheckCircle2 className="size-4" />
                    <span>Processing complete</span>
                  </div>
                ) : null}

                <button
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="
                    w-full h-9 inline-flex items-center justify-center gap-2
                    rounded-lg border border-border bg-surface
                    text-sm font-medium text-destructive
                    hover:bg-destructive/5 hover:border-destructive/30
                    disabled:opacity-50 transition-all duration-150 cursor-pointer
                  "
                >
                  <Trash2 className="size-4" />
                  Remove resume
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
