import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CheckCircle2, Loader2, Plus, Save, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { resumeApi, userApi } from "@/lib/api";
import { searchSystemSkills, normalizeSystemSkill, type SkillItem } from "@/lib/data/skills";

export interface ResumeInsightsProps {
  userSkills: string[];
  className?: string;
}

export function ResumeInsights({ userSkills, className = "" }: ResumeInsightsProps) {
  const qc = useQueryClient();
  const resumeQ = useQuery({
    queryKey: ["resume"],
    queryFn: () => resumeApi.get(),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 3000 : false),
  });

  if (resumeQ.isLoading) {
    return (
      <section className={`bg-card border border-border rounded-xl shadow-card p-6 ${className}`}>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Resume insights
        </h2>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!resumeQ.data) {
    return (
      <section className={`bg-card border border-border rounded-xl shadow-card p-6 ${className}`}>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Resume insights
        </h2>
        <p className="text-xs text-muted-foreground">
          No resume uploaded yet.{" "}
          <a href="/app/resume" className="font-semibold text-accent hover:underline">
            Upload one
          </a>{" "}
          to auto-extract your skills and experience.
        </p>
      </section>
    );
  }

  if (resumeQ.data.status === "processing") {
    return (
      <section className={`bg-card border border-border rounded-xl shadow-card p-6 ${className}`}>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Resume insights
        </h2>
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
          <Sparkles className="size-4 shrink-0 text-amber-500 animate-pulse mt-0.5" />
          <span>AI is extracting your skills — check back shortly.</span>
        </div>
      </section>
    );
  }

  return (
    <div className={className}>
      <InsightsEditor
        resumeData={resumeQ.data}
        userSkills={userSkills}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["user"] })}
      />
    </div>
  );
}

export interface InsightsEditorProps {
  resumeData: {
    extractedSkills: string[];
    confidence: number;
    status: string;
  };
  userSkills: string[];
  onSaved: () => void;
}

export function InsightsEditor({ resumeData, userSkills, onSaved }: InsightsEditorProps) {
  const qc = useQueryClient();

  const seedSkills = userSkills.length > 0 ? userSkills : resumeData.extractedSkills;
  const [skills, setSkills] = useState<string[]>(seedSkills);
  const [isDirty, setIsDirty] = useState(false);

  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && (userSkills.length > 0 || resumeData.extractedSkills.length > 0)) {
      setSkills(userSkills.length > 0 ? userSkills : resumeData.extractedSkills);
      seededRef.current = true;
    }
  }, [userSkills, resumeData]);

  const save = useMutation({
    mutationFn: () => userApi.update({ skills }),
    onSuccess: () => {
      toast.success("Skills updated on your profile.");
      void qc.invalidateQueries({ queryKey: ["user"] });
      setIsDirty(false);
      onSaved();
    },
    onError: () => {
      toast.error("Failed to save skills. Please try again.");
    },
  });

  function handleAddSkill(skillName: string) {
    const canonical = normalizeSystemSkill(skillName);
    if (!canonical) {
      toast.error(`"${skillName}" is not in the system skill catalog.`);
      return;
    }
    const lower = new Set(skills.map((s) => s.toLowerCase()));
    if (!lower.has(canonical.toLowerCase())) {
      setSkills((prev) => [...prev, canonical]);
      setIsDirty(true);
    } else {
      toast.info(`"${canonical}" is already added.`);
    }
  }

  function removeSkill(idx: number) {
    setSkills((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  }

  const confidencePct = Math.round(resumeData.confidence * 100);

  return (
    <section className="bg-card border border-border rounded-xl shadow-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Resume insights
        </h2>
        {confidencePct > 0 && (
          <span
            title="AI extraction confidence"
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${
              confidencePct >= 80
                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 ring-emerald-500/20"
                : confidencePct >= 60
                  ? "text-amber-700 dark:text-amber-300 bg-amber-500/10 ring-amber-500/20"
                  : "text-muted-foreground bg-muted ring-border"
            }`}
          >
            {confidencePct}% confidence
          </span>
        )}
      </div>

      {/* System skill search bar combobox */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground block">Add skills from catalog</label>
        <SkillSearchBar existingSkills={skills} onSelectSkill={handleAddSkill} />
      </div>

      {/* Skills chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground block">
            Extracted & added skills
          </label>
          <span className="text-[11px] text-muted-foreground">{skills.length} selected</span>
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-12 p-2.5 rounded-lg bg-background border border-border/80">
          {skills.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] rounded-md bg-accent/10 text-accent ring-1 ring-accent/20 font-medium group transition-all"
            >
              {s}
              <button
                type="button"
                onClick={() => removeSkill(i)}
                title={`Remove ${s}`}
                className="size-3.5 rounded-sm flex items-center justify-center opacity-60 hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {skills.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-1 px-1">
              No skills selected yet — search above to add skills.
            </p>
          )}
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || !isDirty}
        className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md bg-brand text-brand-foreground text-sm font-medium ring-1 ring-brand hover:bg-brand/90 disabled:opacity-50 transition-opacity"
      >
        {save.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save skills
          </>
        )}
      </button>

      {save.isSuccess && !isDirty && (
        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
          <CheckCircle2 className="size-3.5" /> Saved to your profile
        </p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// SkillSearchBar — Autocomplete search bar for catalog skills
// ─────────────────────────────────────────────────────────────

interface SkillSearchBarProps {
  existingSkills: string[];
  onSelectSkill: (skillName: string) => void;
}

function SkillSearchBar({ existingSkills, onSelectSkill }: SkillSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results: SkillItem[] = searchSystemSkills(query, existingSkills);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(skill: SkillItem) {
    onSelectSkill(skill.name);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setActiveIndex((prev) => (prev + 1 < results.length ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && results.length > 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      } else if (query.trim()) {
        const canonical = normalizeSystemSkill(query.trim());
        if (canonical) {
          onSelectSkill(canonical);
          setQuery("");
          setIsOpen(false);
        } else {
          toast.error(`"${query.trim()}" is not in the system skill catalog.`);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search system skills (e.g. React, Python, Docker)..."
          className="w-full h-8.5 pl-8 pr-8 rounded-md bg-background ring-1 ring-border text-xs outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground/60 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
            title="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md bg-popover ring-1 ring-border shadow-lg p-1 space-y-0.5 text-xs animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex justify-between items-center border-b border-border/50 mb-1">
            <span>System Skills Catalog</span>
            <span>{results.length} results</span>
          </div>

          {results.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground space-y-1">
              <p className="text-xs font-medium text-foreground/80">No matching skill found</p>
              <p className="text-[11px]">Only verified system skills can be added.</p>
            </div>
          ) : (
            results.map((skill, index) => {
              const isSelected = index === activeIndex;
              return (
                <button
                  key={skill.name}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    handleSelect(skill);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-foreground hover:bg-surface"
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <Plus className="size-3 opacity-60 shrink-0" />
                    {skill.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 font-normal">
                    {skill.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
