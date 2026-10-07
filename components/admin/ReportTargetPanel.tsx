/**
 * components/admin/ReportTargetPanel.tsx
 *
 * Data container for the "Target Laporan" tab of /admin/monitoring. The report
 * data itself is already loaded by the page; this loads the stored target + pause
 * and saves changes. All presentation is in ReportTargetView.tsx.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getReportRequirementSettings, saveReportRequirement, setRequirementPause } from "@/app/actions/requirements";
import { DEFAULT_REPORT_REQUIREMENT, type ReportRequirement } from "@/lib/report-requirement-rules";
import { NO_PAUSE, type DateKey, type PauseWindow } from "@/lib/requirement-rules";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { ReportTargetView, type ReportTargetTeacher } from "@/components/admin/ReportTargetView";

/** Shape the monitoring page builds: teacher → students → reports. */
export type MonitoringTeacher = {
  id: string;
  name: string | null;
  students: Array<{
    id: string;
    name: string;
    isCrossAssignment?: boolean;
    reports: Array<{ created_at: string; created_by?: string | null }>;
  }>;
};

export function ReportTargetPanel({ data, dataLoading }: { data: MonitoringTeacher[]; dataLoading: boolean }) {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const [requirement, setRequirement] = useState<ReportRequirement>(DEFAULT_REPORT_REQUIREMENT);
  const [pause, setPause] = useState<PauseWindow>(NO_PAUSE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeOrganizationId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      const result = await getReportRequirementSettings(activeOrganizationId);
      if (cancelled) return;
      if (result.success) {
        setRequirement(result.requirement);
        setPause(result.pause);
      } else {
        setLoadError(result.error);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, reloadKey]);

  const teachers: ReportTargetTeacher[] = useMemo(
    () =>
      data.map((teacher) => ({
        id: teacher.id,
        name: teacher.name ?? "Tanpa nama",
        students: teacher.students.map((student) => ({
          id: student.id,
          name: student.name,
          isCross: !!student.isCrossAssignment,
          reports: student.reports.map((report) => ({ created_at: report.created_at, created_by: report.created_by ?? null })),
        })),
      })),
    [data],
  );

  const save = useCallback(
    async (next: ReportRequirement) => {
      if (!activeOrganizationId) return { success: false as const, error: "Organisasi belum dipilih." };
      return saveReportRequirement(activeOrganizationId, next);
    },
    [activeOrganizationId],
  );

  const changePause = useCallback(
    async (from: DateKey | null, until: DateKey | null) => {
      if (!activeOrganizationId) return { success: false as const, error: "Organisasi belum dipilih." };
      return setRequirementPause(activeOrganizationId, "report", from, until);
    },
    [activeOrganizationId],
  );

  if (loading || dataLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-14 bg-white rounded-[1.5rem] border-2 border-dashed border-rose-200 space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-rose-300" />
        <p className="text-sm font-bold text-slate-600">{isEnglish ? "Could not load the report target." : "Target laporan belum bisa dimuat."}</p>
        <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto">{loadError}</p>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold" style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}>
          {isEnglish ? "Try again" : "Coba lagi"}
        </button>
      </div>
    );
  }

  return (
    <ReportTargetView
      key={reloadKey}
      teachers={teachers}
      requirement={requirement}
      pause={pause}
      onSave={save}
      onPauseChange={changePause}
      labels={{ isEnglish, ustadz: t.ustadz, ustadzLower: t.ustadzLower, santri: t.santri, santriLower: t.santriLower }}
    />
  );
}
