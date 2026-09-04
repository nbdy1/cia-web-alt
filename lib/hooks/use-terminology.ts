/**
 * lib/hooks/use-terminology.ts
 *
 * Client-side hook version of getTerminology() — resolves against the
 * current user's activeOrganizationId from AuthContext. See
 * lib/data/terminology.ts for the actual org → label lookup.
 */
"use client";

import { useAuth } from "@/lib/context/auth-context";
import { getLocalizedTerminology, type Terminology } from "@/lib/data/terminology";
import { useSettings } from "@/lib/context/settings-context";
import type { AppLanguage } from "@/lib/data/language";

export function useTerminology(): Terminology & { language: AppLanguage; ustadzLabel: string; ustadzLowerLabel: string; santriLabel: string; santriLowerLabel: string } {
  const { activeOrganizationId } = useAuth();
  const { language } = useSettings();
  const terminology = getLocalizedTerminology(activeOrganizationId, language);
  const { ustadz, ustadzLower, santri, santriLower } = terminology;

  return {
    ...terminology,
    language,
    ustadz,
    ustadzLower,
    santri,
    santriLower,
    ustadzLabel: ustadz,
    ustadzLowerLabel: ustadzLower,
    santriLabel: santri,
    santriLowerLabel: santriLower,
  };
}
