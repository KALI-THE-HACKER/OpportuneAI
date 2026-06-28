import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { FileText, Upload, Trash2, Sparkles } from "lucide-react";
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

  const q = useQuery({ queryKey: ["resume"], queryFn: () => resumeApi.get() });
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = useMutation({
    mutationFn: (f: File) => resumeApi.upload({ name: f.name, sizeKb: Math.round(f.size / 1024) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resume"] });
      if (search.onboarding === "true") {
        void navigate({ to: "/app/dashboard" });
      }
    },
  });
  const remove = useMutation({
    mutationFn: () => resumeApi.remove(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resume"] }),
  });

  function handleFiles(files?: FileList | null) {
    const f = files?.[0];
    if (f) upload.mutate(f);
  }

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
              Upload your resume to automatically extract your skills, experience, and unlock personalized AI recommendations.
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
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium">Drop your resume here</h3>
          <p className="text-sm text-muted-foreground mt-1">PDF or DOCX, up to 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="mt-4 h-9 px-4 rounded-md bg-brand text-brand-foreground text-sm font-medium ring-1 ring-brand hover:bg-brand/90 disabled:opacity-60"
          >
            {upload.isPending ? "Processing…" : "Choose file"}
          </button>
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
              <div className="flex items-center gap-3">
                <div className="size-10 grid place-items-center rounded-md bg-brand text-brand-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{q.data.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.data.sizeKb} KB · uploaded {timeAgo(q.data.uploadedAt)}
                  </div>
                </div>
              </div>

              <Field label="Status" value={q.data.status} />
              <Field label="Experience level" value={q.data.experienceLevel} />
              <Field label="Total years" value={`${q.data.yearsTotal} yrs`} />
              <Field label="Confidence" value={`${Math.round(q.data.confidence * 100)}%`} />

              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Extracted skills
                </div>
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
              </div>

              <button
                onClick={() => remove.mutate()}
                className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md ring-1 ring-border text-sm text-destructive hover:bg-destructive/5"
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
