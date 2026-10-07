/**
 * components/admin/TeacherCompliancePanel.tsx
 *
 * Data container for the "Kepatuhan Guru" tab of /admin/treatment-plans: loads
 * the per-teacher facts and the stored target, and saves a new target. All
 * presentation is in TeacherComplianceView.tsx.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  getTeacherTreatmentCompliance,
  setTreatmentFollowupWindow,
  type TeacherCompliance,
} from "@/app/actions/treatment-followups";
import { DEFAULT_TREATMENT_WINDOW_DAYS } from "@/lib/treatment-followup-rules";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { TeacherComplianceView, type SaveResult } from "@/components/admin/TeacherComplianceView";
import { setRequirementPause, setTeacherTargetExemption } from "@/app/actions/requirements";
import { NO_PAUSE, type DateKey, type PauseWindow } from "@/lib/requirement-rules";

/** Loads the data and wires saving; presentation lives in TeacherComplianceView. */
export function TeacherCompliancePanel({ onOverdueCount }: { onOverdueCount?: (count: number) => void }) {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const [teachers, setTeachers] = useState<TeacherCompliance[]>([]);
  const [savedDays, setSavedDays] = useState(DEFAULT_TREATMENT_WINDOW_DAYS);
  const [pause, setPause] = useState<PauseWindow>(NO_PAUSE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    setLoadError("");
    const result = await getTeacherTreatmentCompliance(activeOrganizationId);
    if (!result.success) {
      setLoadError(result.error);
    } else {
      setTeachers(result.teachers);
      setSavedDays(result.windowDays);
      setPause(result.pause);
    }
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const save = useCallback(
    async (days: number): Promise<SaveResult> => {
      if (!activeOrganizationId) return { success: false, error: "Organisasi belum dipilih." };
      return setTreatmentFollowupWindow(activeOrganizationId, days);
    },
    [activeOrganizationId],
  );

  const changePause = useCallback(
    async (from: DateKey | null, until: DateKey | null) => {
      if (!activeOrganizationId) return { success: false as const, error: "Organisasi belum dipilih." };
      return setRequirementPause(activeOrganizationId, "treatment", from, until);
    },
    [activeOrganizationId],
  );

  const changeExempt = useCallback(
    async (userId: string, exempt: boolean): Promise<string | null> => {
      if (!activeOrganizationId) return "Organisasi belum dipilih.";
      const result = await setTeacherTargetExemption(activeOrganizationId, userId, exempt);
      return result.success ? null : result.error;
    },
    [activeOrganizationId],
  );

  if (loading) {
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
        <p className="text-sm font-bold text-slate-600">{isEnglish ? "Could not load compliance data." : "Data kepatuhan belum bisa dimuat."}</p>
        <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto">{loadError}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold"
          style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}
        >
          {isEnglish ? "Try again" : "Coba lagi"}
        </button>
      </div>
    );
  }

  return (
    <TeacherComplianceView
      // Remount (fresh draft/filters) whenever data is reloaded from the server.
      key={`${reloadKey}-${teachers.length}`}
      teachers={teachers}
      savedDays={savedDays}
      onSave={save}
      onOverdueCount={onOverdueCount}
      pause={pause}
      onPauseChange={changePause}
      onExemptChange={changeExempt}
      labels={{ isEnglish, ustadz: t.ustadz, ustadzLower: t.ustadzLower, santriLower: t.santriLower }}
    />
  );
}
