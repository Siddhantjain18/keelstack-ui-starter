import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { useAuth } from "../lib/auth-context";
import { tasksApi, extractApiError, type TaskType, type KSTask } from "../lib/api-client";
import clsx from "clsx";

type TrackedJob = {
  jobId: string;
  type: TaskType;
  submittedAt: string;
  pollUrl: string;
  status: KSTask["status"];
  result?: unknown;
  error?: string;
  polls: number;
};

const TASK_TYPES: { type: TaskType; label: string; desc: string }[] = [
  { type: "report", label: "report", desc: "Generate a structured report document." },
  { type: "export", label: "export", desc: "Export dataset to file format." },
  { type: "ai_analysis", label: "ai_analysis", desc: "Run LLM analysis over a payload." },
];

const STATUS_STYLES: Record<KSTask["status"], string> = {
  queued: "bg-muted/20 text-fg-muted border-muted/30",
  processing: "bg-warning/10 text-warning border-warning/30",
  done: "bg-success/10 text-success border-success/30",
  failed: "bg-danger/10 text-danger border-danger/30",
};

const STATUS_DOT: Record<KSTask["status"], string> = {
  queued: "bg-muted",
  processing: "bg-warning animate-pulse2",
  done: "bg-success",
  failed: "bg-danger",
};

export default function JobsPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const [selectedType, setSelectedType] = useState<TaskType>("report");
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [error, setError] = useState("");
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach(clearInterval);
    };
  }, []);

  function startPolling(jobId: string) {
    if (pollingRefs.current.has(jobId)) return;

    const interval = setInterval(async () => {
      try {
        const res = await tasksApi.poll(jobId);
        const task = res.data;
        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === jobId
              ? { ...j, status: task.status, result: task.result, error: task.error, polls: j.polls + 1 }
              : j
          )
        );
        // Stop polling once terminal
        if (task.status === "done" || task.status === "failed") {
          clearInterval(interval);
          pollingRefs.current.delete(jobId);
        }
      } catch {
        clearInterval(interval);
        pollingRefs.current.delete(jobId);
      }
    }, 1500);

    pollingRefs.current.set(jobId, interval);
  }

  const submitMut = useMutation({
    mutationFn: () =>
      tasksApi.submit(
        selectedType,
        { demoKey: "demoValue", submittedFrom: "keelstack-ui-starter" },
      ),
    onSuccess: (data) => {
      const job: TrackedJob = {
        jobId: data.jobId,
        type: selectedType,
        submittedAt: new Date().toISOString(),
        pollUrl: data.pollUrl,
        status: "queued",
        polls: 0,
      };
      setJobs((prev) => [job, ...prev]);
      setError("");
      startPolling(data.jobId);
    },
    onError: (err) => setError(extractApiError(err).message),
  });

  if (isLoading) return null;

  return (
    <Layout>
      <Head>
        <title>Jobs | KeelStack Demo</title>
      </Head>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <p className="font-mono text-xs text-warning mb-1">tasks module</p>
          <h1 className="font-display font-bold text-2xl text-fg">Background Jobs</h1>
          <p className="text-sm text-fg-muted mt-1">
            202 Accepted + poll pattern. KeelStack&apos;s canonical async request lifecycle.
          </p>
          {!isAuthenticated && (
            <p className="mt-3 text-xs text-fg-muted">
              You can submit background jobs without signing in. If you want the full secured auth
              flow around account actions, open the{" "}
              <Link href="/auth-demo" className="text-accent hover:underline">
                Auth Demo
              </Link>
              .
            </p>
          )}
        </div>

        {/* Pattern explainer */}
        <div
          className="rounded-xl border border-warning/20 bg-warning/5 p-5"
        >
          <p className="font-mono text-xs text-warning mb-3 uppercase tracking-wider">
            Why 202 + poll, not 200?
          </p>
          <p className="text-xs text-fg-muted leading-relaxed">
            LLM calls, data exports, and report generation can take 5–60 seconds. Doing them
            synchronously blocks Node&apos;s HTTP thread and causes client timeouts. KeelStack&apos;s
            pattern: <span className="text-warning font-mono">POST /tasks</span> returns immediately
            with a <span className="text-warning font-mono">jobId</span> and{" "}
            <span className="text-warning font-mono">pollUrl</span>. The{" "}
            <span className="text-warning font-mono">RetryableJobRunner</span> processes the task in
            background, persists state, and handles retries automatically. The client polls{" "}
            <span className="text-warning font-mono">GET /tasks/:jobId</span> until terminal status.
          </p>
        </div>

        {/* Submit form */}
        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-fg mb-4">
            Submit Task
          </h2>

          <div className="flex flex-wrap gap-2 mb-5">
            {TASK_TYPES.map(({ type, label, desc }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={clsx(
                  "text-left rounded-lg border px-4 py-3 text-sm transition-all",
                  selectedType === type
                    ? "border-warning/50 bg-warning/10"
                    : "border-border hover:border-muted"
                )}
              >
                <span className={clsx("font-mono text-xs block mb-0.5", selectedType === type ? "text-warning" : "text-fg-muted")}>
                  {label}
                </span>
                <span className="text-xs text-fg-muted">{desc}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            className="bg-warning/90 hover:bg-warning text-bg font-medium px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {submitMut.isPending ? "Submitting…" : `POST /api/v1/tasks → ${selectedType}`}
          </button>
        </div>

        {/* Job list */}
        {jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-fg">
              Job Tracker
            </h2>

            {jobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        )}

        {/* State machine explainer */}
        <div className="rounded-xl border border-border p-6" style={{ background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono px-2 py-0.5 rounded border bg-warning/10 text-warning border-warning/20">
              KeelStack Pattern
            </span>
            <h3 className="font-display font-semibold text-sm text-fg">Job State Machine</h3>
          </div>
          <p className="text-xs text-fg-muted mb-5 leading-relaxed">
            Every task moves through a deterministic state machine managed by{" "}
            <code className="font-mono text-warning text-xs">PersistentJobStore</code>. States are
            written atomically — a crashed worker cannot leave a job permanently stuck in{" "}
            <code className="font-mono text-warning text-xs">processing</code>. The{" "}
            <code className="font-mono text-warning text-xs">RetryableJobRunner</code> re-enqueues
            on failure with exponential backoff.
          </p>

          {/* State machine diagram */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["queued", "processing", "done", "failed"] as KSTask["status"][]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <span className={clsx(
                  "font-mono text-xs px-3 py-1.5 rounded-full border",
                  STATUS_STYLES[s]
                )}>
                  {s}
                </span>
                {i < arr.length - 2 && (
                  <span className="text-muted text-xs">→</span>
                )}
                {i === arr.length - 3 && (
                  <>
                    <span className="text-muted text-xs">or</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3 font-mono">
            queued → processing → done | failed (→ requeue after backoff)
          </p>
        </div>
      </div>
    </Layout>
  );
}

function JobCard({ job }: { job: TrackedJob }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border border-border overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={clsx("w-2 h-2 rounded-full shrink-0", STATUS_DOT[job.status])} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-0.5">
            <span className="font-mono text-xs text-fg">{job.jobId}</span>
            <span className={clsx("font-mono text-xs px-2 py-0.5 rounded-full border", STATUS_STYLES[job.status])}>
              {job.status}
            </span>
            <span className="font-mono text-xs text-fg-muted">{job.type}</span>
          </div>
          <p className="text-xs text-muted font-mono">
            submitted {new Date(job.submittedAt).toLocaleTimeString()} · polls: {job.polls}
          </p>
        </div>

        <span className="text-fg-muted text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-4">
          {/* 202 response anatomy */}
          <div>
            <p className="text-xs font-mono text-fg-muted mb-2 uppercase tracking-wider">
              Initial 202 Response
            </p>
            <pre className="font-mono text-xs text-fg-muted bg-bg rounded-lg p-4 border border-border leading-relaxed overflow-x-auto">
{`{
  "status": "accepted",         // ← NOT 200 OK
  "jobId": "${job.jobId}",
  "pollUrl": "${job.pollUrl}",  // ← client should poll this
  "message": "Task queued. Poll pollUrl for status."
}`}
            </pre>
          </div>

          {/* Poll URL call */}
          <div>
            <p className="text-xs font-mono text-fg-muted mb-2 uppercase tracking-wider">
              Poll Endpoint
            </p>
            <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-4 py-2.5">
              <span className="font-mono text-xs text-warning">GET</span>
              <span className="font-mono text-xs text-fg">{job.pollUrl}</span>
              <span className="ml-auto font-mono text-xs text-fg-muted">
                every 1.5s until terminal
              </span>
            </div>
          </div>

          {/* Result / error */}
          {Boolean(job.result) && (
            <div>
              <p className="text-xs font-mono text-fg-muted mb-2 uppercase tracking-wider">
                Result
              </p>
              <pre className="font-mono text-xs text-success bg-bg rounded-lg p-4 border border-success/20 leading-relaxed overflow-x-auto">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </div>
          )}
          {job.error && (
            <div>
              <p className="text-xs font-mono text-fg-muted mb-2 uppercase tracking-wider">
                Error
              </p>
              <p className="font-mono text-xs text-danger bg-bg rounded-lg p-4 border border-danger/20">
                {job.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
