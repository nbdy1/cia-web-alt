/**
 * lib/hooks/use-terminology.ts
 *
 * Client-side hook version of getTerminology() — resolves against the
 * current user's activeOrganizationId from AuthContext. See
 * lib/data/terminology.ts for the actual org → label lookup.
 */
"use client";

import { useAuth } from "@/lib/context/auth-context";
import { getTerminology, type Terminology } from "@/lib/data/terminology";

export function useTerminology(): Terminology {
  const { activeOrganizationId } = useAuth();
  return getTerminology(activeOrganizationId);
}
