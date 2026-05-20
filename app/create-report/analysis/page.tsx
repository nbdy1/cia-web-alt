"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { runFullAnalysis } from '@/app/actions/ai-analysis';

export default function AnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Initializing CIA...");

  useEffect(() => {
    async function performAnalysis() {
      const narrative = searchParams.get('narrative');
      const studentId = searchParams.get('id');
      
      console.log("🔍 Client: Starting analysis for student ID:", studentId);

      if (!narrative) {
        console.error("🔍 Client: No narrative found in URL!");
        setStatus("Error: No narrative found.");
        return;
      }

      setStatus("Consulting the 33 Pillars...");
      const result = await runFullAnalysis(narrative);

      if (result?.error) {
        console.error("🔍 Client: AI Analysis failed:", result.error);
        setStatus(`Error: ${result.error}`);
        return;
      }

      if (result) {
        console.log("🔍 Client: Analysis received! Redirecting...");
        
        sessionStorage.setItem('current_analysis', JSON.stringify(result));
        sessionStorage.setItem('current_narrative', narrative);
        
        const params = new URLSearchParams({
          id: studentId || "",
          name: searchParams.get('name') || ""
        });
        
        router.push(`/create-report/results?${params.toString()}`);
      } else {
        console.error("🔍 Client: Received empty result from server.");
        setStatus("Error: Empty response from AI.");
      }
    }

    performAnalysis();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-emerald-950 text-white p-10 text-center">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-bold tracking-tight">{status}</h2>
      <p className="text-emerald-400/60 text-sm mt-4 animate-pulse">
        Please do not close this page
      </p>
    </div>
  );
}