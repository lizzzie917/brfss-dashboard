import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { 
  Activity, Info, HeartPulse, TrendingDown, Users, 
  Stethoscope, ShieldAlert, Brain
} from 'lucide-react';

// --- STATISTICAL MATH ENGINES ---
function getPearson(x, y) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  const n = x.length;
  if (n === 0) return 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i]; sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
  }
  const numerator = (n * sumXY) - (sumX * sumY);
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denom === 0 ? 0 : numerator / denom;
}

function calcOR(exposedDiabetic, exposedHealthy, unexposedDiabetic, unexposedHealthy) {
  const or = (exposedDiabetic * unexposedHealthy) / (exposedHealthy * unexposedDiabetic);
  const se = Math.sqrt((1/exposedDiabetic) + (1/exposedHealthy) + (1/unexposedDiabetic) + (1/unexposedHealthy));
  const lower = Math.exp(Math.log(or) - 1.96 * se);
  const upper = Math.exp(Math.log(or) + 1.96 * se);
  return { or, error: upper - or }; 
}

// --- REUSABLE ANNOTATIVE COMPONENTS ---
const InfoPopup = ({ title, text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 text-sm bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20"
      >
        <Info size={14} /> What does this mean?
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 w-72 p-4 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl text-sm text-slate-200">
          <strong className="block text-indigo-400 mb-1">{title}</strong>
          {text}
        </div>
      )}
    </div>
  );
};

const TakeawayBanner = ({ text }) => (
  <div className="mt-4 p-4 bg-slate-800/50 border-l-4 border-indigo-500 rounded-r-lg text-slate-300 text-sm md:text-base leading-relaxed">
    <span className="font-bold text-slate-100 uppercase text-xs tracking-wider mr-2">Key Takeaway:</span>
    {text}
  </div>
);

export default function App() {
  const [dataset, setDataset] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Specific Chart Controls
  const [butterflyView, setButterflyView] = useState('diet'); 
  const [mentalHealthDays, setMentalHealthDays] = useState(0);

  // Calculator State
  const [calcRisks, setCalcRisks] = useState({
    bp: false, chol: false, smoker: false, heart: false
  });
  const toggleRisk = (key) => setCalcRisks(prev => ({ ...prev, [key]: !prev[key] }));

  // 1. Ingestion Engine
  useEffect(() => {
    Papa.parse("/diabetes_binary_5050split_health_indicators_BRFSS2015.csv", {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        setDataset(results.data);
        setIsLoading(false);
      }
    });
  }, []);

  // 2. High-Performance Math Engine
  const processedData = useMemo(() => {
    if (dataset.length === 0) return null;

    const violin = { hBMI: [], hAge: [], dBMI: [], dAge: [] };
    const stats = {
      healthy: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 },
      diabetic: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 }
    };
    const incomeStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0}, 7:{t:0, d:0}, 8:{t:0, d:0} };
    const eduStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0} };
    const vars = { Diabetes: [], BP: [], Chol: [], BMI: [], Age: [], GenHlth: [], Income: [], Edu: [] };
    
    const orStats = { bp: { ed: 0, eh: 0, ud: 0, uh: 0 }, chol: { ed: 0, eh: 0, ud: 0, uh: 0 }, smoker: { ed: 0, eh: 0, ud: 0, uh: 0 }, heart: { ed: 0, eh: 0, ud: 0, uh: 0 } };
    let d_bp = 0, d_chol = 0, d_heart = 0, d_stroke = 0;
    const raincloud = { gen1: [], gen2: [], gen3: [], gen4: [], gen5: [] };

    dataset.forEach((row, index) => {
      const includeInRaincloud = row.MentHlth >= mentalHealthDays;
      const isDiabetic = row.Diabetes_binary === 1;
      const target = isDiabetic ? stats.diabetic : stats.healthy;

      target.total += 1;
      if (row.Smoker === 1) target.smoker += 1;
      if (row.PhysActivity === 1) target.physAct += 1;
      if (row.Fruits === 1) target.fruits += 1;
      if (row.Veggies === 1) target.veggies += 1;
      if (row.NoDocbcCost === 1) target.noDoc += 1;
      if (row.DiffWalk === 1) target.diffWalk += 1;

      if (isDiabetic) { violin.dBMI.push(row.BMI); violin.dAge.push(row.Age); } 
      else { violin.hBMI.push(row.BMI); violin.hAge.push(row.Age); }

      if (row.Income >= 1 && row.Income <= 8) { incomeStats[row.Income].t += 1; if (isDiabetic) incomeStats[row.Income].d += 1; }
      if (row.Education >= 1 && row.Education <= 6) { eduStats[row.Education].t += 1; if (isDiabetic) eduStats[row.Education].d += 1; }

      vars.Diabetes.push(row.Diabetes_binary); vars.BP.push(row.HighBP); vars.Chol.push(row.HighChol);
      vars.BMI.push(row.BMI); vars.Age.push(row.Age); vars.GenHlth.push(row.GenHlth); vars.Income.push(row.Income); vars.Edu.push(row.Education);

      if (row.HighBP === 1) { isDiabetic ? orStats.bp.ed++ : orStats.bp.eh++; } else { isDiabetic ? orStats.bp.ud++ : orStats.bp.uh++; }
      if (row.HighChol === 1) { isDiabetic ? orStats.chol.ed++ : orStats.chol.eh++; } else { isDiabetic ? orStats.chol.ud++ : orStats.chol.uh++; }
      if (row.Smoker === 1) { isDiabetic ? orStats.smoker.ed++ : orStats.smoker.eh++; } else { isDiabetic ? orStats.smoker.ud++ : orStats.smoker.uh++; }
      if (row.HeartDiseaseorAttack === 1) { isDiabetic ? orStats.heart.ed++ : orStats.heart.eh++; } else { isDiabetic ? orStats.heart.ud++ : orStats.heart.uh++; }

      if (isDiabetic) {
        if (row.HighBP === 1) d_bp++; if (row.HighChol === 1) d_chol++; if (row.HeartDiseaseorAttack === 1) d_heart++; if (row.Stroke === 1) d_stroke++;
      }

      // Subsampling 1-out-of-20 rows keeps the web client smooth during live state rerenders
      if (includeInRaincloud && row.GenHlth >= 1 && row.GenHlth <= 5 && index % 20 === 0) {
        raincloud[`gen${row.GenHlth}`].push(row.BMI);
      }
    });

    const calcPct = (c, t) => t > 0 ? (c / t) * 100 : 0;
    
    const varArrays = [vars.Diabetes, vars.BP, vars.Chol, vars.BMI, vars.Age, vars.GenHlth, vars.Income, vars.Edu];
    const zMatrix = [];
    for (let i = 0; i < varArrays.length; i++) {
      const r = [];
      for (let j = 0; j < varArrays.length; j++) r.push(getPearson(varArrays[i], varArrays[j]));
      zMatrix.push(r);
    }

    // Precise math computation for the visual trend line
    const raincloudMeans = [1, 2, 3, 4, 5].map(lvl => {
      const arr = raincloud[`gen${lvl}`];
      return arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });
    
    return {
      violin, raincloud, raincloudMeans,
      heatmap: { z: zMatrix, labels: ['Diabetes', 'High BP', 'High Chol', 'BMI', 'Age', 'Poor GenHlth', 'Income', 'Edu'] },
      slope: {
        incomeX: [1, 2, 3, 4, 5, 6, 7, 8], incomeY: [1, 2, 3, 4, 5, 6, 7, 8].map(l => calcPct(incomeStats[l].d, incomeStats[l].t)),
        eduX: [1, 2, 3, 4, 5, 6], eduY: [1, 2, 3, 4, 5, 6].map(l => calcPct(eduStats[l].d, eduStats[l].t))
      },
      butterfly: {
        diet: {
          labels: ['Daily Veggies', 'Daily Fruits', 'Phys. Activity', 'Smoker'],
          healthy: [calcPct(stats.healthy.veggies, stats.healthy.total), calcPct(stats.healthy.fruits, stats.healthy.total), calcPct(stats.healthy.physAct, stats.healthy.total), calcPct(stats.healthy.smoker, stats.healthy.total)],
          diabetic: [calcPct(stats.diabetic.veggies, stats.diabetic.total), calcPct(stats.diabetic.fruits, stats.diabetic.total), calcPct(stats.diabetic.physAct, stats.diabetic.total), calcPct(stats.diabetic.smoker, stats.diabetic.total)]
        },
        barriers: {
          labels: ['Diff. Walking', 'No Doc due to Cost'],
          healthy: [calcPct(stats.healthy.diffWalk, stats.healthy.total), calcPct(stats.healthy.noDoc, stats.healthy.total)],
          diabetic: [calcPct(stats.diabetic.diffWalk, stats.diabetic.total), calcPct(stats.diabetic.noDoc, stats.diabetic.total)]
        }
      },
      odds: {
        bp: calcOR(orStats.bp.ed, orStats.bp.eh, orStats.bp.ud, orStats.bp.uh),
        chol: calcOR(orStats.chol.ed, orStats.chol.eh, orStats.chol.ud, orStats.chol.uh),
        smoker: calcOR(orStats.smoker.ed, orStats.smoker.eh, orStats.smoker.ud, orStats.smoker.uh),
        heart: calcOR(orStats.heart.ed, orStats.heart.eh, orStats.heart.ud, orStats.heart.uh)
      },
      sankey: {
        nodes: ['Diabetes', 'High BP', 'High Chol', 'Heart Disease', 'Stroke'],
        links: { source: [0, 0, 0, 0], target: [1, 2, 3, 4], value: [d_bp, d_chol, d_heart, d_stroke] }
      }
    };
  }, [dataset, mentalHealthDays]);

  if (isLoading || !processedData) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center flex-col gap-6">
        <Activity className="animate-spin text-indigo-500" size={64} />
        <h2 className="text-2xl font-bold mb-2">Ingesting 70,000 Health Records...</h2>
      </div>
    );
  }

  // Calculate live cumulative relative risk 
  let cumulativeRisk = 1.0;
  if (calcRisks.bp) cumulativeRisk *= processedData.odds.bp.or;
  if (calcRisks.chol) cumulativeRisk *= processedData.odds.chol.or;
  if (calcRisks.smoker) cumulativeRisk *= processedData.odds.smoker.or;
  if (calcRisks.heart) cumulativeRisk *= processedData.odds.heart.or;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto">
      
      {/* HEADER NARRATIVE */}
      <header className="max-w-4xl mx-auto pt-16 pb-8 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6">Understanding Metabolic Health</h1>
        <p className="text-xl text-slate-400 leading-relaxed">
          A data-driven exploration of 70,000 real health records. Discover how personal choices, socioeconomic barriers, and intersecting clinical conditions shape our risk for diabetes.
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- SECTION 1: CITIZENS (PERSONAL RISK) --- */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <HeartPulse className="text-rose-500" /> Part 1: Your Personal Risk Factors
            </h2>
            <p className="text-slate-400 mt-2">Interact with the calculator to see how common conditions compound relative risk.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
            {/* Calculator Panel */}
            <div className="w-full md:w-1/3 bg-slate-800/50 p-6 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-slate-700">
              <h3 className="text-xl font-bold text-white">Risk Calculator</h3>
              <div className="space-y-4">
                {Object.keys(calcRisks).map(key => (
                  <label key={key} className="flex items-center gap-3 p-3 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition bg-slate-900">
                    <input type="checkbox" checked={calcRisks[key]} onChange={() => toggleRisk(key)} className="w-5 h-5 checked:bg-indigo-500 rounded accent-indigo-500" />
                    <span className="font-medium text-slate-200 text-sm md:text-base">
                      {key === 'bp' ? 'High Blood Pressure' : key === 'chol' ? 'High Cholesterol' : key === 'smoker' ? 'Current Smoker' : 'Heart Disease'}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-auto p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Estimated Relative Risk</p>
                <p className="text-5xl font-black text-indigo-400 mt-2">{cumulativeRisk.toFixed(2)}x</p>
                <p className="text-xs text-slate-400 mt-2">compared to standard baseline</p>
              </div>
            </div>

            {/* Forest Plot */}
            <div className="w-full md:w-2/3 p-6 h-[400px]">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-white">How Much Do Conditions Increase Risk?</h3>
                <InfoPopup 
                  title="Odds Ratios Explained" 
                  text="An odds ratio tells us how much more likely a disease is given a certain condition. The red dashed line (1.0) means no extra risk. High Blood Pressure sits past 5.0, meaning patients with High BP are over 5 times more likely to have diabetes."
                />
              </div>
              <Plot
                data={[{
                  type: 'scatter', mode: 'markers',
                  x: [processedData.odds.bp.or, processedData.odds.chol.or, processedData.odds.smoker.or, processedData.odds.heart.or],
                  y: ['High BP', 'High Chol', 'Smoker', 'Heart Disease'],
                  error_x: { type: 'data', symmetric: true, array: [processedData.odds.bp.error, processedData.odds.chol.error, processedData.odds.smoker.error, processedData.odds.heart.error], color: '#818cf8', thickness: 2, width: 6 },
                  marker: { size: 12, color: '#4f46e5' },
                  text: [processedData.odds.bp.or.toFixed(2), processedData.odds.chol.or.toFixed(2), processedData.odds.smoker.or.toFixed(2), processedData.odds.heart.or.toFixed(2)],
                  hovertemplate: '<b>%{y}</b><br>Multiplies risk by %{x:.2f}x<extra></extra>'
                }]}
                layout={{ font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', xaxis: { title: 'Risk Multiplier (Odds Ratio)', gridcolor: '#1e293b' }, yaxis: { gridcolor: 'transparent' }, shapes: [{ type: 'line', x0: 1, x1: 1, y0: -0.5, y1: 3.5, line: { color: '#f43f5e', dash: 'dash', width: 2 } }], margin: { l: 100, r: 20, t: 20, b: 40 }, autosize: true }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </section>

        {/* --- SECTION 2: POLICYMAKERS (EQUITY) --- */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-amber-500" /> Part 2: Socioeconomic & Systemic Barriers
            </h2>
            <p className="text-slate-400 mt-2">Health is not just physical; it is environmental and financial. Where do we need structural interventions?</p>
          </div>

          {/* Socioeconomic Slope */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <h3 className="text-xl font-bold text-white mb-2">How Income and Education Impact Risk</h3>
            <p className="text-sm text-slate-400 mb-4">Tracking diabetes prevalence across ascending socioeconomic brackets (1 = Lowest, Max = Highest).</p>
            <div className="w-full h-[400px]">
              <Plot
                data={[
                  { type: 'scatter', mode: 'lines+markers', x: processedData.slope.incomeX, y: processedData.slope.incomeY, name: 'Income Level', line: { color: '#fbbf24', width: 3 }, hovertemplate: 'Income Bracket %{x}<br>Diabetic: %{y:.1f}%<extra></extra>' },
                  { type: 'scatter', mode: 'lines+markers', x: processedData.slope.eduX, y: processedData.slope.eduY, name: 'Education Level', line: { color: '#22d3ee', width: 3 }, hovertemplate: 'Education Bracket %{x}<br>Diabetic: %{y:.1f}%<extra></extra>' }
                ]}
                layout={{ font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', xaxis: { title: 'Socioeconomic Bracket (Lowest to Highest)', gridcolor: '#1e293b' }, yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b' }, autosize: true }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text="There is a stark, undeniable downward slope: as education and income levels increase, the prevalence of diabetes drops dramatically. Systemic poverty is a massive risk factor." />
          </div>

          {/* Behavioral / Barriers Butterfly */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Daily Behaviors & Healthcare Barriers</h3>
                <p className="text-sm text-slate-400">Comparing populations: Healthy (Green) vs Diabetic (Red).</p>
              </div>
              <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button onClick={() => setButterflyView('diet')} className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${butterflyView === 'diet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Diet & Activity</button>
                <button onClick={() => setButterflyView('barriers')} className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${butterflyView === 'barriers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Systemic Barriers</button>
              </div>
            </div>
            <div className="w-full h-[350px]">
              <Plot
                data={[
                  { type: 'bar', x: processedData.butterfly[butterflyView].healthy.map(v => -v), y: processedData.butterfly[butterflyView].labels, orientation: 'h', name: 'Non-Diabetic', marker: { color: '#10b981' }, customdata: processedData.butterfly[butterflyView].healthy, hovertemplate: '%{y} (Healthy)<br>Rate: %{customdata:.1f}%<extra></extra>' },
                  { type: 'bar', x: processedData.butterfly[butterflyView].diabetic, y: processedData.butterfly[butterflyView].labels, orientation: 'h', name: 'Diabetic', marker: { color: '#f43f5e' }, hovertemplate: '%{y} (Diabetic)<br>Rate: %{x:.1f}%<extra></extra>' }
                ]}
                layout={{ barmode: 'relative', font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 140, r: 20, t: 20, b: 40 }, xaxis: { range: [-100, 100], tickvals: [-100, -50, 0, 50, 100], ticktext: ['100%', '50%', '0%', '50%', '100%'], gridcolor: '#1e293b' }, yaxis: { gridcolor: 'transparent' }, autosize: true }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text={butterflyView === 'diet' ? "Notice how physical activity rates are notably lower in the diabetic population, while smoking rates remain surprisingly similar." : "Diabetics suffer from vastly higher rates of walking difficulties and frequently avoid seeing a doctor due to healthcare costs."} />
          </div>
        </section>

        {/* --- SECTION 3: HEALTHCARE WORKERS (CLINICAL STATS) --- */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Stethoscope className="text-blue-500" /> Part 3: Clinical Intersections & Statistics
            </h2>
            <p className="text-slate-400 mt-2">Deep-dive into how physical markers, mental health, and chronic conditions overlap.</p>
          </div>

          {/* Comorbidity Network */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
             <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-white">The Web of Chronic Conditions</h3>
                <InfoPopup title="Sankey Diagram" text="This flow chart visualizes overlap. The thick red block on the left represents all diabetics in the dataset. The bands flowing to the right show how many of those specific patients also suffer from secondary conditions." />
              </div>
            <div className="w-full h-[400px] mt-4">
              <Plot
                data={[{
                  type: 'sankey', orientation: 'h',
                  node: { pad: 20, thickness: 30, line: { color: 'transparent', width: 0 }, label: processedData.sankey.nodes, color: ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7', '#10b981'] },
                  link: { source: processedData.sankey.links.source, target: processedData.sankey.links.target, value: processedData.sankey.links.value, color: 'rgba(148, 163, 184, 0.15)' }
                }]}
                layout={{ font: { color: '#f8fafc', size: 14 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 20, r: 120, t: 20, b: 20 }, autosize: true }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
             <TakeawayBanner text="Diabetes rarely exists in isolation. Observe the massive flow connecting Diabetes directly to High Blood Pressure and High Cholesterol, highlighting the critical need for comprehensive cardiovascular care." />
          </div>

          {/* Raincloud Plot with Integrated Control */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Physical BMI vs. Subjective General Health</h3>
                <p className="text-sm text-slate-400">Showing the density of BMI distribution grouped by self-reported health (1 = Excellent, 5 = Poor).</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 w-full lg:w-72">
                <label className="flex justify-between text-sm text-slate-300 font-medium mb-3">
                  <span>Filter: Min. Bad Mental Health Days</span>
                  <span className="text-blue-400">{mentalHealthDays}</span>
                </label>
                <input type="range" min="0" max="30" value={mentalHealthDays} onChange={(e) => setMentalHealthDays(parseInt(e.target.value))} className="w-full accent-blue-500" />
              </div>
            </div>
            
            <div className="w-full h-[500px]">
              <Plot
                data={[
                  // 1. Dynamic Gradient Violin Clouds (Emerald -> Warning Red)
                  ...[1, 2, 3, 4, 5].map((lvl, idx) => {
                    const colors = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#ef4444'];
                    return {
                      type: 'violin', 
                      x: Array(processedData.raincloud[`gen${lvl}`].length).fill(`Level ${lvl}`), 
                      y: processedData.raincloud[`gen${lvl}`],
                      name: `Health Level ${lvl}`, 
                      points: 'all', 
                      pointpos: -0.5, 
                      jitter: 0.7, 
                      side: 'positive',
                      line: { color: colors[idx], width: 2 }, 
                      marker: { size: 3, opacity: 0.3, color: '#94a3b8' }, 
                      meanline: { visible: true, width: 4, color: '#ffffff' }, // Thick indicator for category mean
                      hovertemplate: 'Self Rating: Level ' + lvl + '<br>BMI: %{y}<extra></extra>'
                    };
                  }),
                  // 2. High-Contrast Trend Line Overlay
                  {
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
                    y: processedData.raincloudMeans,
                    name: 'Average BMI Trend',
                    line: { color: '#ffffff', width: 4, dash: 'solid' },
                    marker: { size: 10, color: '#fbbf24', line: { color: '#ffffff', width: 2 } },
                    hovertemplate: 'Average BMI: %{y:.1f}<extra></extra>'
                  }
                ]}
                layout={{ 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  xaxis: { title: 'General Health Rating (1 = Excellent, 5 = Poor)', gridcolor: '#1e293b' }, 
                  yaxis: { title: 'BMI (Body Mass Index)', gridcolor: '#1e293b', range: [10, 60] }, 
                  showlegend: false, 
                  autosize: true 
                }}
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text="The statistics are clear: as self-reported health degrades, the average BMI systematically climbs from 26.2 to 32.4 (represented by the white trendline). This moves the baseline population average from overweight into obese territory." />
          </div>

          {/* Statistical Correlation Matrix */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Clinical Pearson Correlation Matrix</h3>
                <p className="text-sm text-slate-400">Mathematical relationships across 2 million parsed data points.</p>
              </div>
              <InfoPopup 
                title="How to read this" 
                text="Scores range from -1 to 1. Dark Blue means a strong positive correlation (as one goes up, the other goes up). Orange/Red means a negative correlation. Because we measure Income from Lowest to Highest, Income is negatively correlated with Diabetes."
              />
            </div>
            <div className="w-full h-[600px]">
              <Plot 
                data={[{ 
                  type: 'heatmap', z: processedData.heatmap.z, x: processedData.heatmap.labels, y: processedData.heatmap.labels, 
                  colorscale: 'RdBu', zmin: -1, zmax: 1, reversescale: true,
                  hovertemplate: 'Var 1: %{x}<br>Var 2: %{y}<br>Correlation: %{z:.2f}<extra></extra>'
                }]} 
                layout={{ font: { color: '#94a3b8', size: 14 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 120, r: 20, t: 20, b: 120 }, xaxis: { tickangle: -45 }, yaxis: { autorange: 'reversed' }, autosize: true }} 
                useResizeHandler={true} style={{ width: '100%', height: '100%' }} 
              />
            </div>
            <TakeawayBanner text="Look at the dark blue square intersecting Age, BMI, High BP, and Diabetes. These form a tightly correlated clinical cluster that dominates the dataset's risk profile." />
          </div>

        </section>
      </div>
    </div>
  );
}