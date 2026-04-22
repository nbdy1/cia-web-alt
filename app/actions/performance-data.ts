"use server";

import { supabase } from "@/lib/supabase";

export async function getPerformanceData() {
  // 1. Total Student Count
  const { count: studentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });

  // 2. Aggregate Category Averages
  const { data: categoryData } = await supabase
    .from('report_scores')
    .select('category, score');

  const calcAvg = (cat: string) => {
    const filtered = categoryData?.filter(d => d.category === cat) || [];
    if (filtered.length === 0) return "0.0";
    const average = filtered.reduce((acc, curr) => acc + curr.score, 0) / filtered.length;
    return average.toFixed(1);
  };

  // Return raw data only
  const stats = [
    { name: "Karakter", avg: calcAvg("Karakter") },
    { name: "Mental", avg: calcAvg("Mental") },
    { name: "Soft Skill", avg: calcAvg("Soft Skill") },
  ];

  // 3. Dynamic "Needs Attention"
  const { data: lowScores } = await supabase
    .from('report_scores')
    .select('score, pillar_id, reports(student_id, students(name))')
    .lte('score', 2)
    .order('created_at', { ascending: false })
    .limit(4);

  // 4. Recent Activity Feed
  const { data: recentReports } = await supabase
    .from('reports')
    .select(`
      id,
      created_at,
      students (name),
      report_scores (score, category)
    `)
    .order('created_at', { ascending: false })
    .limit(8);

  return { 
    studentCount: studentCount || 0, 
    stats, 
    lowScores: lowScores || [], 
    recentReports: recentReports || [] 
  };
}