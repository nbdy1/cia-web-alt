/**
 * lib/target-teachers.ts
 *
 * Which people the admin target screens (weekly report target, treatment
 * follow-up target) should judge. Pure so the rules are testable
 * (tests/target-teachers.test.ts).
 *
 *  - Everyone who is a teacher (role "ustadz") is judged, even with no plans yet.
 *  - Anyone else (admin/owner) is judged only if they actually own treatment plans.
 *  - Deactivated accounts ("Dinonaktifkan" in /admin/ustadz = profiles.is_removed)
 *    are never listed: their leftover pending plans would otherwise make them look
 *    overdue forever.
 *  - Exempt members are still returned but flagged, so admins can see and undo it.
 */
export type TargetMember = { user_id: string; role: string | null; targets_exempt?: boolean | null };
export type TargetProfile = { id: string; name: string | null; is_removed?: boolean | null };

export type TrackedTeacher = { userId: string; name: string; exempt: boolean };

export function selectTrackedTeachers(
  members: TargetMember[],
  profiles: TargetProfile[],
  /** user ids that own at least one treatment reminder */
  reminderOwnerIds: Iterable<string>,
): TrackedTeacher[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const exemptByUser = new Map(members.map((member) => [member.user_id, member.targets_exempt === true]));
  const candidates = new Set<string>();

  for (const member of members) if (member.role === "ustadz") candidates.add(member.user_id);
  for (const id of reminderOwnerIds) candidates.add(id);

  const result: TrackedTeacher[] = [];
  for (const userId of candidates) {
    const profile = profileById.get(userId);
    if (profile?.is_removed === true) continue;
    result.push({ userId, name: profile?.name?.trim() || "Tanpa nama", exempt: exemptByUser.get(userId) === true });
  }
  return result;
}
