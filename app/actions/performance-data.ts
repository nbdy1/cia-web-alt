/**
 * app/actions/performance-data.ts
 *
 * Server action that aggregates summary statistics for the admin dashboard.
 * Returns:
 *   - studentCount   → total number of students in the DB
 *   - recentReports  → last 8 reports (with student names) for the activity feed
 *   - stats          → placeholder (was intended for category-level averages)
 *   - lowScores      → placeholder (was intended for at-risk student list)
 *
 * The admin dashboard (app/admin/page.tsx) performs most of its own data
 * aggregation inline via direct Supabase queries. This action is currently
 * used only for the student count and recent-activity widgets.
 */
"use server";

import { getServerSupabase } from "@/lib/supabase-server";

export async function getPerformanceData() {
  const db = await getServerSupabase();

  // 1. Total Student Count
  const { count: studentCount } = await db
    .from('students')
    .select('*', { count: 'exact', head: true })
    .or('is_removed.is.null,is_removed.eq.false');

  // 2. Recent Activity Feed
  const { data: recentReports } = await db
    .from('reports')
    .select(`
      id,
      title,
      created_at,
      students (name)
    `)
    .order('created_at', { ascending: false })
    .limit(8);

  return { 
    studentCount: studentCount || 0, 
    stats: [], 
    lowScores: [], 
    recentReports: recentReports || [] 
  };
}
