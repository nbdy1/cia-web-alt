"use server";

import { supabase } from "@/lib/supabase";

export async function getPerformanceData() {
  // 1. Total Student Count
  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });

  // 2. Recent Activity Feed
  const { data: recentReports } = await supabase
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
