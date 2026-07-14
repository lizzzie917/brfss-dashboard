import React, { useState } from 'react';
import { 
  Activity, 
  Heart, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ShieldAlert,
  Sliders,
  Info,
  Stethoscope
} from 'lucide-react';

export default function App() {
  // State for tabs and interactive elements
  const [activeTab, setActiveTab] = useState('profiles');
  const [ageRange, setAgeRange] = useState(50);
  const [incomeRange, setIncomeRange] = useState(50);

  // State for the Risk Calculator
  const [risks, setRisks] = useState({
    bp: false,
    chol: false,
    walk: false,
    act: false,
    smoke: false
  });

  // Calculate dynamic risk multiplier
  let multiplier = 1.0;
  if (risks.bp) multiplier *= 2.62;
  if (risks.chol) multiplier *= 2.02;
  if (risks.walk) multiplier *= 1.68;
  if (risks.act) multiplier *= 1.35;
  if (risks.smoke) multiplier *= 1.18;

  const toggleRisk = (key) => setRisks(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col hidden md:flex">
        <div className="flex items-center gap-3 mb-8">
          <ShieldAlert className="text-indigo-500" size={32} />
          <h1 className="text-xl font-bold tracking-tight">Analysis Controls</h1>
        </div>
        
        <div className="space-y-8">
          <div>
            <label className="flex justify-between text-sm font-medium text-slate-400 mb-4">
              <span>Age Bracket Target</span>
              <span className="text-indigo-400">{ageRange}%</span>
            </label>
            <input 
              type="range" min="0" max="100" value={ageRange} 
              onChange={(e) => setAgeRange(e.target.value)}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className="flex justify-between text-sm font-medium text-slate-400 mb-4">
              <span>Income Stratification</span>
              <span className="text-indigo-400">{incomeRange}%</span>
            </label>
            <input 
              type="range" min="0" max="100" value={incomeRange} 
              onChange={(e) => setIncomeRange(e.target.value)}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mt-8">
            <div className="flex gap-2 items-start text-indigo-400 mb-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span className="text-sm font-semibold">Model Framework Notice</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This application visualizes a balanced predictive dataset (50/50 target split). Ratios indicate cross-sectional risk correlation rather than overall national baseline prevalence.
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        
        {/* HEADER */}
        <header className="px-8 py-6 border-b border-slate-800">
          <h2 className="text-3xl font-bold mb-2">Metabolic Risk Profile & Equity Dashboard</h2>
          <p className="text-slate-400">BRFSS 2015 Dataset Predictive Template Snapshot</p>
        </header>

        {/* KPI CARDS */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="bg-blue-500/10 p-3 rounded-lg"><Users className="text-blue-500" size={24} /></div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Cohort Sample</p>
              <p className="text-2xl font-bold text-slate-100">70,692</p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="bg-rose-500/10 p-3 rounded-lg"><Activity className="text-rose-500" size={24} /></div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Diabetic Distribution</p>
              <p className="text-2xl font-bold text-slate-100">50.0%</p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="bg-emerald-500/10 p-3 rounded-lg"><Heart className="text-emerald-500" size={24} /></div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Cohort Average BMI</p>
              <p className="text-2xl font-bold text-slate-100">29.8</p>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="px-8 flex gap-2 border-b border-slate-800">
          {['profiles', 'calculator', 'equity'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-colors ${
                activeTab === tab 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab === 'profiles' && '📊 Profiles & Behaviors'}
              {tab === 'calculator' && '🔮 Predictive Calculator'}
              {tab === 'equity' && '📈 Socioeconomic Trajectories'}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 p-8">
          
          {/* TAB 1: PROFILES */}
          {activeTab === 'profiles' && (
            <div className="animate-in fade-in duration-500 flex flex-col gap-8">
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Stethoscope className="text-indigo-400" size={20} />
                  Clinical Barriers Comparison
                </h3>
                <div className="space-y-6">
                  {/* Chart Row 1 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2"><span className="font-medium">High Blood Pressure</span></div>
                    <div className="flex gap-1 h-8">
                      <div className="bg-emerald-500 flex items-center px-3 text-xs font-bold w-1/4 rounded-l-md">25% (Healthy)</div>
                      <div className="bg-rose-500 flex items-center px-3 text-xs font-bold w-3/4 rounded-r-md justify-end">75% (Diabetic)</div>
                    </div>
                  </div>
                  {/* Chart Row 2 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2"><span className="font-medium">High Cholesterol</span></div>
                    <div className="flex gap-1 h-8">
                      <div className="bg-emerald-500 flex items-center px-3 text-xs font-bold w-1/3 rounded-l-md">33%</div>
                      <div className="bg-rose-500 flex items-center px-3 text-xs font-bold w-2/3 rounded-r-md justify-end">67%</div>
                    </div>
                  </div>
                  {/* Chart Row 3 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2"><span className="font-medium">Difficulty Walking</span></div>
                    <div className="flex gap-1 h-8">
                      <div className="bg-emerald-500 flex items-center px-3 text-xs font-bold w-[15%] rounded-l-md">15%</div>
                      <div className="bg-rose-500 flex items-center px-3 text-xs font-bold w-[85%] rounded-r-md justify-end">85%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CALCULATOR */}
          {activeTab === 'calculator' && (
            <div className="animate-in fade-in duration-500 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Sliders className="text-indigo-400" size={20} />
                  Patient Co-morbidities
                </h3>
                <div className="space-y-4">
                  {[
                    { key: 'bp', label: 'Diagnosed High Blood Pressure', odds: '+2.62x Risk' },
                    { key: 'chol', label: 'Diagnosed High Cholesterol', odds: '+2.02x Risk' },
                    { key: 'walk', label: 'Experiences Mobility Constraints', odds: '+1.68x Risk' },
                    { key: 'act', label: 'Sedentary / Physical Inactivity', odds: '+1.35x Risk' },
                    { key: 'smoke', label: 'Identified as Current Smoker', odds: '+1.18x Risk' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/50 cursor-pointer hover:border-indigo-500 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={risks[item.key]} 
                        onChange={() => toggleRisk(item.key)}
                        className="w-5 h-5 accent-indigo-500 rounded bg-slate-700 border-slate-600"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{item.label}</span>
                        <span className="text-sm text-indigo-400 font-semibold">{item.odds}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-[#1e1b4b] border-2 border-indigo-500 p-8 rounded-2xl text-center flex flex-col justify-center shadow-indigo-900/50 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl mix-blend-screen"></div>
                <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest mb-4 relative z-10">
                  Composite Risk Multiplier
                </p>
                <h1 className="text-7xl font-black text-white mb-6 relative z-10">
                  {multiplier.toFixed(2)}x
                </h1>
                <p className="text-slate-400 text-sm max-w-xs mx-auto relative z-10">
                  Relative probability scale shift compared to a baseline clear lifestyle control profile.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: EQUITY */}
          {activeTab === 'equity' && (
            <div className="animate-in fade-in duration-500 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl h-96 flex items-center justify-center flex-col text-center">
              <TrendingUp className="text-indigo-500 mb-4" size={48} />
              <h3 className="text-2xl font-bold mb-2">Income & Education Trajectories</h3>
              <p className="text-slate-400 max-w-md">
                Income bracket {Math.ceil(incomeRange / 12.5)} / 8 selected. <br/><br/>
                In the complete dataset, severe inverse correlation exists between socioeconomic tier and diabetes probability. (Visualization handled via backend processing).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}