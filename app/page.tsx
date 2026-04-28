import { Settings, Mic, BarChart3 } from 'lucide-react'; // Using Lucide for clean icons
import Link from 'next/link';

export default function HomePage() {
  const userName = "Ustaz Abdullah"; // This would come from your Auth/Context later

  return (
    <>
      {/* Top Bar */}
      <header className="flex justify-between items-center px-6 pt-10 pb-4">
        <div className="text-emerald-700 font-extrabold text-2xl tracking-tighter">CIA.</div>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <Settings className="w-6 h-6 text-slate-500" />
        </button>
      </header>

      <main className="flex-1 px-6 pt-6">
        {/* Welcome Section */}
        <section className="mb-10">
          <p className="text-slate-400 text-lg font-serif italic">Assalamualaikum,</p>
          <h1 className="text-4xl font-bold text-slate-800 leading-tight">
            {userName}
          </h1>
        </section>

        {/* Action Buttons Stack */}
        <div className="flex flex-col gap-6">
          
          {/* Create Student Report - Primary Action */}
          <Link href="/create-report">
           <button className="group relative w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-lg shadow-emerald-200">
            <div className="bg-white/20 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <span className="text-white text-2xl font-bold font-serif">
              Create Student Report
            </span>
          </button>
          </Link>
         
<Link href="/students">  
          <button className="w-full bg-slate-50 border-2 border-slate-100 hover:border-emerald-200 active:scale-[0.98] transition-all p-8 rounded-[2.5rem] flex flex-col items-center text-center">
            <div className="bg-white p-4 rounded-2xl mb-4 shadow-sm">
              <BarChart3 className="w-8 h-8 text-slate-600" />
            </div>
            <span className="text-slate-800 text-2xl font-bold font-serif">
              Student Reports & Analytics
            </span>
            {/* <span className="text-slate-400 text-xs mt-2 uppercase st font-medium">
              Data & Analytics
            </span> */}
          </button>
</Link>
        </div>
      </main>

      {/* Subtle Home Indicator Decor */}
      {/* <footer className="py-6 flex justify-center">
        <div className="w-32 h-1.5 bg-slate-200 rounded-full" />
      </footer> */}
    </>
  );
}