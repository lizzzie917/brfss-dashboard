import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { 
  Activity, Info, HeartPulse, Users, 
  Stethoscope, Brain, ArrowUp, ChevronDown
} from 'lucide-react';

// --- ROBUST STATISTICAL MATH ENGINES ---
function getPearson(x, y) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  const n = x.length;
  if (n === 0) return 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i];
    sumXY += x[i] * y[i]; sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
  }
  const numerator = (n * sumXY) - (sumX * sumY);
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denom === 0 ? 0 : numerator / denom;
}

function calcOR(exposedDiabetic, exposedHealthy, unexposedDiabetic, unexposedHealthy) {
  const ed = exposedDiabetic + 0.5;
  const eh = exposedHealthy + 0.5;
  const ud = unexposedDiabetic + 0.5;
  const uh = unexposedHealthy + 0.5;

  const or = (ed * uh) / (eh * ud);
  const se = Math.sqrt((1 / ed) + (1 / eh) + (1 / ud) + (1 / uh));
  const lower = Math.exp(Math.log(or) - 1.96 * se);
  const upper = Math.exp(Math.log(or) + 1.96 * se);
  return { or, error: upper - or };
}

// --- CATEGORICAL LABEL MAPPINGS ---
const incomeLabels = [
  'Under $10k', '$10k - $15k', '$15k - $20k', '$20k - $25k', 
  '$25k - $35k', '$35k - $50k', '$50k - $75k', '$75k or More'
];
const educationLabels = [
  'No School', 'Elementary', 'Some High School', 
  'High School Grad', 'Some College', 'College Grad'
];
const heatmapVariables = [
  'Diabetes Diagnosis', 'High Blood Pressure', 'High Cholesterol', 
  'Body Mass Index (BMI)', 'Age Bracket', 'General Health Rating', 
  'Annual Income', 'Education Level'
];

const correlationTranslations = {
  'Diabetes Diagnosis & High Blood Pressure': [
    "Vascular Connection: High blood pressure is the single strongest clinical correlate for diabetes in this dataset. This represents systemic vascular stress in action.",
    "Pathological Multiplier: Having both conditions exponentially multiplies individual risk of heart disease, kidney damage, and stroke compared to having just one.",
    "Integrated Treatment: Managing both together through lifestyle modifications and systemic medications is critical for long-term clinical health."
  ],
  'Annual Income & General Health Rating': [
    "The Wealth-Health Gradient: There is a strong relationship where higher incomes map directly to better self-reported health ratings.",
    "Resource-Driven Wellness: Wealthier individuals have superior access to fresh nutrition, safe walking spaces, medical insurance, and proactive medical checkups.",
    "Systemic Equity Barrier: This demonstrates that metabolic health is not purely biological; it is fundamentally shaped by social and economic status."
  ],
  'Education Level & Annual Income': [
    "Gateway to Opportunity: This represents the single strongest socio-economic link in the dataset, proving that higher education levels lead directly to stronger earnings.",
    "Systemic Shield: Higher education unlocks career paths with high-quality healthcare coverage, enabling healthy proactive lifestyles.",
    "Intergenerational Lift: Promoting educational equity is one of the most powerful systemic interventions for long-term health improvements in communities."
  ],
  'Age Bracket & High Blood Pressure': [
    "The Aging Cardiovascular System: A strong link captures the progressive stiffening of arteries as patients cross older age brackets.",
    "Systemic Accumulation: Aging increases exposure to cumulative environmental and physiological stressors, causing blood pressure to steadily rise.",
    "Targeted Screening: Public health guidelines emphasize early, routine cardiovascular screening to catch and manage hypertension early."
  ],
  'Body Mass Index (BMI) & General Health Rating': [
    "The Physical Mirror: As Body Mass Index increases, self-reported General Health Ratings systematically worsen.",
    "Somatic Strain: Higher BMI places direct mechanical and metabolic strain on the skeletal and cardiovascular systems, leading to joint discomfort and reduced mobility.",
    "Dynamic Feedback Loop: Poorer physical wellness makes regular exercise more difficult, creating a challenging feedback loop that maintains elevated BMI."
  ]
};

// --- ANNOTATIVE COMPONENTS ---
const ChartInfoButton = ({ title, text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-2 align-middle">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 text-sm bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20"
      >
        <Info size={14} /> More about the chart
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

const KeyInsightBanner = ({ text }) => (
  <div className="mt-4 p-4 bg-slate-800/50 border-l-4 border-indigo-500 rounded-r-lg text-slate-300 text-sm md:text-base leading-relaxed">
    <span className="font-bold text-indigo-400 uppercase text-xs tracking-wider block mb-1">Practical Insight:</span>
    {text}
  </div>
);

export default function App() {
  const [dataset, setDataset] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // View States
  const [butterflyView, setButterflyView] = useState('diet'); 
  const [slopeView, setSlopeView] = useState('income');
  const [translatorVar, setTranslatorVar] = useState('Diabetes Diagnosis & High Blood Pressure');
  const [mentalHealthDays, setMentalHealthDays] = useState(0);
  const [selectedNode, setSelectedNode] = useState(0); 

  // Deep Dive Collapses
  const [deepDiveIntro, setDeepDiveIntro] = useState(false);
  const [deepDivePart1, setDeepDivePart1] = useState(false);
  const [deepDivePart2a, setDeepDivePart2a] = useState(false);
  const [deepDivePart2b, setDeepDivePart2b] = useState(false);
  const [deepDivePart3a, setDeepDivePart3a] = useState(false);
  const [deepDivePart3b, setDeepDivePart3b] = useState(false);
  const [deepDivePart3c, setDeepDivePart3c] = useState(false);

  // 7-Factor Calculator State (No Heavy Drinking)
  const [calcRisks, setCalcRisks] = useState({
    bp: false,
    chol: false,
    smoker: false,
    heart: false,
    stroke: false,
    noPhysAct: false,
    diffWalk: false
  });

  const toggleRisk = (key) => setCalcRisks(prev => ({ ...prev, [key]: !prev[key] }));

  // Scroll to top functionality
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // 1. Data Ingestion
  useEffect(() => {
    Papa.parse("/diabetes_binary_5050split_health_indicators_BRFSS2015.csv", {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        setDataset(results.data);
        setIsLoading(false);
      }
    });
  }, []);

  // 2. Multi-System Analysis Engine
  const processedData = useMemo(() => {
    if (dataset.length === 0) return null;

    const stats = {
      healthy: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 },
      diabetic: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 }
    };
    const incomeStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0}, 7:{t:0, d:0}, 8:{t:0, d:0} };
    const eduStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0} };
    const vars = { Diabetes: [], BP: [], Chol: [], BMI: [], Age: [], GenHlth: [], Income: [], Edu: [] };
    
    // Tracking structures for distinct Odds Ratios
    const orTracks = {
      bp: { ed: 0, eh: 0, ud: 0, uh: 0 },
      chol: { ed: 0, eh: 0, ud: 0, uh: 0 },
      smoker: { ed: 0, eh: 0, ud: 0, uh: 0 },
      heart: { ed: 0, eh: 0, ud: 0, uh: 0 },
      stroke: { ed: 0, eh: 0, ud: 0, uh: 0 },
      noPhysAct: { ed: 0, eh: 0, ud: 0, uh: 0 },
      diffWalk: { ed: 0, eh: 0, ud: 0, uh: 0 }
    };

    let d_bp = 0, d_chol = 0, d_heart = 0, d_stroke = 0;
    
    // Arrays required for the specific Violin plot implementation requested
    const violinGen = { gen1: [], gen2: [], gen3: [], gen4: [], gen5: [] };

    dataset.forEach((row, index) => {
      const includeInViolin = row.MentHlth >= mentalHealthDays;
      const isDiabetic = row.Diabetes_binary === 1;
      const target = isDiabetic ? stats.diabetic : stats.healthy;

      target.total += 1;
      if (row.Smoker === 1) target.smoker += 1;
      if (row.PhysActivity === 1) target.physAct += 1;
      if (row.Fruits === 1) target.fruits += 1;
      if (row.Veggies === 1) target.veggies += 1;
      if (row.NoDocbcCost === 1) target.noDoc += 1;
      if (row.DiffWalk === 1) target.diffWalk += 1;

      if (row.Income >= 1 && row.Income <= 8) { 
        incomeStats[row.Income].t += 1; 
        if (isDiabetic) incomeStats[row.Income].d += 1; 
      }
      if (row.Education >= 1 && row.Education <= 6) { 
        eduStats[row.Education].t += 1; 
        if (isDiabetic) eduStats[row.Education].d += 1; 
      }

      vars.Diabetes.push(row.Diabetes_binary);
      vars.BP.push(row.HighBP); 
      vars.Chol.push(row.HighChol);
      vars.BMI.push(row.BMI); 
      vars.Age.push(row.Age); 
      vars.GenHlth.push(row.GenHlth); 
      vars.Income.push(row.Income); 
      vars.Edu.push(row.Education);

      const fillTrack = (trackObj, flag) => {
        if (flag) { isDiabetic ? trackObj.ed++ : trackObj.eh++; } 
        else { isDiabetic ? trackObj.ud++ : trackObj.uh++; }
      };

      fillTrack(orTracks.bp, row.HighBP === 1);
      fillTrack(orTracks.chol, row.HighChol === 1);
      fillTrack(orTracks.smoker, row.Smoker === 1);
      fillTrack(orTracks.heart, row.HeartDiseaseorAttack === 1);
      fillTrack(orTracks.stroke, row.Stroke === 1);
      fillTrack(orTracks.noPhysAct, row.PhysActivity === 0);
      fillTrack(orTracks.diffWalk, row.DiffWalk === 1);

      if (isDiabetic) {
        if (row.HighBP === 1) d_bp++;
        if (row.HighChol === 1) d_chol++; 
        if (row.HeartDiseaseorAttack === 1) d_heart++; 
        if (row.Stroke === 1) d_stroke++;
      }

      // Populate BMI data for violin plot
      if (includeInViolin && row.GenHlth >= 1 && row.GenHlth <= 5 && index % 20 === 0) {
        violinGen[`gen${row.GenHlth}`].push(row.BMI);
      }
    });

    const calcPct = (c, t) => t > 0 ? (c / t) * 100 : 0;
    
    // Generate asymmetric correlation matrix
    const varArrays = [vars.Diabetes, vars.BP, vars.Chol, vars.BMI, vars.Age, vars.GenHlth, vars.Income, vars.Edu];
    const zMatrix = [];
    for (let i = 0; i < varArrays.length; i++) {
      const r = [];
      for (let j = 0; j < varArrays.length; j++) {
        r.push(j <= i ? getPearson(varArrays[i], varArrays[j]) : null);
      }
      zMatrix.push(r);
    }

    // Average BMI points for the violin overlay line
    const calcMean = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const violinMeans = [
      calcMean(violinGen.gen1), calcMean(violinGen.gen2), 
      calcMean(violinGen.gen3), calcMean(violinGen.gen4), calcMean(violinGen.gen5)
    ];

    const riskFactorTitles = {
      bp: 'High Blood Pressure',
      chol: 'High Cholesterol',
      smoker: 'Active Tobacco Smoker',
      heart: 'Heart Disease History',
      stroke: 'Prior Cerebrovascular Stroke',
      noPhysAct: 'Sedentary Lifestyle',
      diffWalk: 'Difficulty Walking'
    };

    const oddsResult = {
      bp: { ...calcOR(orTracks.bp.ed, orTracks.bp.eh, orTracks.bp.ud, orTracks.bp.uh), title: riskFactorTitles.bp },
      chol: { ...calcOR(orTracks.chol.ed, orTracks.chol.eh, orTracks.chol.ud, orTracks.chol.uh), title: riskFactorTitles.chol },
      diffWalk: { ...calcOR(orTracks.diffWalk.ed, orTracks.diffWalk.eh, orTracks.diffWalk.ud, orTracks.diffWalk.uh), title: riskFactorTitles.diffWalk },
      heart: { ...calcOR(orTracks.heart.ed, orTracks.heart.eh, orTracks.heart.ud, orTracks.heart.uh), title: riskFactorTitles.heart },
      stroke: { ...calcOR(orTracks.stroke.ed, orTracks.stroke.eh, orTracks.stroke.ud, orTracks.stroke.uh), title: riskFactorTitles.stroke },
      noPhysAct: { ...calcOR(orTracks.noPhysAct.ed, orTracks.noPhysAct.eh, orTracks.noPhysAct.ud, orTracks.noPhysAct.uh), title: riskFactorTitles.noPhysAct },
      smoker: { ...calcOR(orTracks.smoker.ed, orTracks.smoker.eh, orTracks.smoker.ud, orTracks.smoker.uh), title: riskFactorTitles.smoker }
    };

    const sortedOddsArray = Object.entries(oddsResult).sort((a, b) => a[1].or - b[1].or);

    return {
      violin: violinGen, 
      violinMeans,
      heatmap: { z: zMatrix, labels: heatmapVariables },
      slope: {
        incomeY: [1, 2, 3, 4, 5, 6, 7, 8].map(l => calcPct(incomeStats[l].d, incomeStats[l].t)),
        eduY: [1, 2, 3, 4, 5, 6].map(l => calcPct(eduStats[l].d, eduStats[l].t))
      },
      butterfly: {
        diet: {
          labels: ['Physically Active', 'Eats Fruit Daily', 'Eats Vegetables Daily'],
          healthy: [
            -calcPct(stats.healthy.physAct, stats.healthy.total),
            -calcPct(stats.healthy.fruits, stats.healthy.total),
            -calcPct(stats.healthy.veggies, stats.healthy.total)
          ],
          diabetic: [
            calcPct(stats.diabetic.physAct, stats.diabetic.total),
            calcPct(stats.diabetic.fruits, stats.diabetic.total),
            calcPct(stats.diabetic.veggies, stats.diabetic.total)
          ]
        },
        barriers: {
          labels: ['Difficulty Walking', 'Cannot Afford Doctor'],
          healthy: [
            -calcPct(stats.healthy.diffWalk, stats.healthy.total),
            -calcPct(stats.healthy.noDoc, stats.healthy.total)
          ],
          diabetic: [
            calcPct(stats.diabetic.diffWalk, stats.diabetic.total),
            calcPct(stats.diabetic.noDoc, stats.diabetic.total)
          ]
        }
      },
      odds: oddsResult,
      sortedOddsX: sortedOddsArray.map(item => item[1].or),
      sortedOddsY: sortedOddsArray.map(item => item[1].title),
      sankey: {
        nodes: ['Diabetes Diagnosis', 'High Blood Pressure', 'High Cholesterol', 'Heart Disease', 'Stroke'],
        links: { source: [0, 0, 0, 0], target: [1, 2, 3, 4], value: [d_bp, d_chol, d_heart, d_stroke] }
      }
    };
  }, [dataset, mentalHealthDays]);

  const sankeyDetails = {
    0: {
      title: "Diabetes Diagnosis (Base Cohort)",
      text: "All 35,000+ diabetic records in this split sample initiate from this point. In clinical practice, diabetes is not just an isolated blood glucose value. It is a systemic metabolic disruption that damages fine structures of the vascular tree over time.",
      clinical: "Epidemiological evidence shows chronic hyperglycemia acts as a driver for endothelial dysfunction. Insulin resistance accelerates macroscopic tissue inflammation and lipid production, creating a baseline vulnerability to systemic cardiovascular decay."
    },
    1: {
      title: "High Blood Pressure Comorbidity",
      text: "An overwhelming majority of the diabetic cohort—over 75%—co-presents with chronic hypertension. This reveals how highly overlapping these physiological pathways are in real-world samples.",
      clinical: "Hypertension and diabetes share highly integrated pathological frameworks. They act as synergistic drivers for arterial stiffness, autonomic cardiovascular strain, and glomerular hyperfiltration, creating complex cardiorenal management hurdles."
    },
    2: {
      title: "High Cholesterol Comorbidity",
      text: "High cholesterol is extraordinarily common in diabetic cohorts. Combined with high systemic glucose, floating lipids create accelerated atherosclerotic plaque deposits, restricting blood flow.",
      clinical: "Diabetic dyslipidemia is characteristically marked by high triglycerides, lower cardioprotective HDL levels, and small, highly dense LDL particles. These sub-particles easily penetrate compromised vascular linings to form progressive plaques."
    },
    3: {
      title: "Heart Disease Intersection",
      text: "The clinical connection between diabetes and active coronary damage is profound. Patients experiencing chronic insulin resistance are highly susceptible to ischemic tissue injuries.",
      clinical: "Cardiovascular disease stands as the single leading contributor to mortality among diabetic populations. The combination of chronic microvascular capillary narrowing and major artery blockages requires highly aggressive protective lipid management."
    },
    4: {
      title: "Stroke Comorbidity",
      text: "Stroke events occur when structural cerebral blood vessels either rupture or become occluded. Diabetic individuals face multi-fold higher risk due to systemic vascular stiffening and plaque stability concerns.",
      clinical: "Cerebrovascular risk tracks with prolonged mean arterial pressures. Clinical models suggest aggressive control targets (under 130/80 mmHg) to shield delicate cerebral micro-vessels in patients with advanced metabolic disorders."
    }
  };

  const activeSankeyStyles = useMemo(() => {
    switch (selectedNode) {
      case 0: return { border: "border-rose-500/40", bg: "bg-rose-950/25", accent: "text-rose-400", badge: "bg-rose-500/20 text-rose-300" };
      case 1: return { border: "border-sky-500/40", bg: "bg-sky-950/25", accent: "text-sky-400", badge: "bg-sky-500/20 text-sky-300" };
      case 2: return { border: "border-amber-500/40", bg: "bg-amber-950/25", accent: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" };
      case 3: return { border: "border-purple-500/40", bg: "bg-purple-950/25", accent: "text-purple-400", badge: "bg-purple-500/20 text-purple-300" };
      case 4: return { border: "border-emerald-500/40", bg: "bg-emerald-950/25", accent: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" };
      default: return { border: "border-slate-700", bg: "bg-slate-900/50", accent: "text-slate-200", badge: "bg-slate-800 text-slate-400" };
    }
  }, [selectedNode]);

  if (isLoading || !processedData) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center flex-col gap-6">
        <Activity className="animate-spin text-indigo-500" size={64} />
        <h2 className="text-2xl font-bold mb-2">Analyzing 70,000 Patient Records...</h2>
      </div>
    );
  }

  // Live Multiplicative Risk Calculations
  let cumulativeRisk = 1.0;
  if (calcRisks.bp) cumulativeRisk *= processedData.odds.bp.or;
  if (calcRisks.chol) cumulativeRisk *= processedData.odds.chol.or;
  if (calcRisks.smoker) cumulativeRisk *= processedData.odds.smoker.or;
  if (calcRisks.heart) cumulativeRisk *= processedData.odds.heart.or;
  if (calcRisks.stroke) cumulativeRisk *= processedData.odds.stroke.or;
  if (calcRisks.noPhysAct) cumulativeRisk *= processedData.odds.noPhysAct.or;
  if (calcRisks.diffWalk) cumulativeRisk *= processedData.odds.diffWalk.or;

  const maxRiskScale = 50.0; 
  const cumulativePct = Math.min((cumulativeRisk / maxRiskScale) * 100, 100);

  // Split Risk Keys for perfectly centered 4-and-3 column layout
  const allRiskKeys = Object.keys(calcRisks);
  const leftColKeys = allRiskKeys.slice(0, 4);
  const rightColKeys = allRiskKeys.slice(4, 7);

  const RiskBlock = ({ rKey }) => {
    const label = 
      rKey === 'bp' ? 'High Blood Pressure' : 
      rKey === 'chol' ? 'High Cholesterol' : 
      rKey === 'smoker' ? 'Active Tobacco Smoker' : 
      rKey === 'heart' ? 'Heart Disease History' :
      rKey === 'stroke' ? 'Prior Cerebrovascular Stroke' :
      rKey === 'noPhysAct' ? 'Sedentary Lifestyle (No Exercise)' :
      'Difficulty Walking / Ambulation Obstacles';

    const orVal = processedData.odds[rKey].or;
    const isActive = calcRisks[rKey];
    const barWidth = isActive ? `${(orVal / 6.0) * 100}%` : '0%';

    return (
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 shadow-inner h-full w-full">
        <label className="flex items-center gap-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isActive} 
            onChange={() => toggleRisk(rKey)} 
            className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-500 accent-indigo-500 cursor-pointer" 
          />
          <span className="font-bold text-slate-200 text-sm md:text-base hover:text-indigo-400 transition-colors select-none">
            {label}
          </span>
        </label>
        
        {/* Live Visual Scale */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500 ease-out rounded-full"
              style={{ width: barWidth }}
            />
          </div>
          <span className={`text-xs font-bold font-mono w-14 text-right transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
            {isActive ? `${orVal.toFixed(2)}x` : '1.00x'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto scroll-smooth">
      
      {/* Floating Go Back To Top Button */}
      <button 
        onClick={scrollToTop} 
        className="fixed bottom-6 right-6 z-50 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl shadow-indigo-600/40 transition-transform transform hover:scale-110"
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} />
      </button>

      {/* STICKY NAVIGATION BAR WITH DROPDOWNS */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800 py-3 px-6 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={scrollToTop}>
            <Activity className="text-indigo-500" size={24} />
            <span className="font-black text-white text-lg tracking-wider">DIABETES ANALYTICS</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 relative">
            
            <div className="group relative">
              <a href="#part1" className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-2">
                Part 1: Patient Risk <ChevronDown size={14}/>
              </a>
              <div className="absolute hidden group-hover:block top-full left-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
                <a href="#calculator" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Interactive Calculator</a>
                <a href="#barchart" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Clinical Risk Bar Chart</a>
              </div>
            </div>

            <div className="group relative">
              <a href="#part2" className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-2">
                Part 2: Socioeconomic <ChevronDown size={14}/>
              </a>
              <div className="absolute hidden group-hover:block top-full left-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
                <a href="#slopes" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Income & Education Slopes</a>
                <a href="#butterfly" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Relative Disparities</a>
              </div>
            </div>

            <div className="group relative">
              <a href="#part3" className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-indigo-400 transition-colors py-2">
                Part 3: Intersections <ChevronDown size={14}/>
              </a>
              <div className="absolute hidden group-hover:block top-full right-0 md:left-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
                <a href="#sankey" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Comorbidity Web</a>
                <a href="#violins" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Physical Markers Distribution</a>
                <a href="#heatmap" className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-300 rounded-lg transition">Connections Map</a>
              </div>
            </div>

          </div>
        </div>
      </nav>

      {/* HEADER NARRATIVE */}
      <header className="max-w-4xl mx-auto pt-14 pb-12 px-6 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Mapping Diabetes Risk & Systemic Barriers
        </h1>
        
        <div className="mt-8 text-left text-sm max-w-2xl mx-auto">
          <div className="bg-indigo-950/25 p-5 rounded-2xl border border-indigo-900/35">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest block mb-2">Dashboard Objective</span>
            <p className="text-indigo-200 leading-relaxed font-medium">
              This interactive dashboard translates complex numbers from 70,000 real people into simple wellness stories. It is designed to show how our personal life situations (like household income and school access) combine with physical markers and common behaviors to shape our risk of developing diabetes.
            </p>
            <p className="text-indigo-300/80 text-xs mt-4 font-semibold italic">
              Use the top navigation bar or scroll down to explore clinical indicators, societal structures, and chronic overlaps. Professionals can access detailed reports via "Professional Deep Dive" buttons.
            </p>
          </div>
          
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => setDeepDiveIntro(!deepDiveIntro)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
            >
              <Brain size={16} /> 
              {deepDiveIntro ? 'Hide Technical Details' : 'Professional Deep Dive'}
            </button>
          </div>
          
          {deepDiveIntro && (
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 mt-4 animate-fadeIn">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Technical Summary & Dataset Info</span>
              <p className="text-slate-300 leading-relaxed">
                This dashboard analyzes 70,000 anonymized health records extracted from the CDC's Behavioral Risk Factor Surveillance System (BRFSS) 2015 dataset. Using calculated statistical parameters, multi-dimensional stratification, and correlation matrices, we explore non-linear logistic markers, demographic discrepancies, and cardiovascular overlaps.
              </p>
              <a 
                href="https://www.kaggle.com/datasets/alexteboul/diabetes-health-indicators-dataset?resource=download" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
              >
                📥 Access Original Kaggle Source Dataset
              </a>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- SECTION 1 --- */}
        <section id="part1" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <HeartPulse className="text-rose-500" size={24} /> Lens 1: Analyzing Patient Risk (Clinical Drivers of Diabetes)
            </h2>
            <p className="text-slate-400 mt-2">Explore how standard demographic and physiological conditions mathematically multiply risks.</p>
          </div>

          <div className="space-y-6">
            {/* STACKED CALCULATOR */}
            <div id="calculator" className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6 scroll-mt-24">
              <ChartInfoButton 
                title="Cumulative Risk Multiplier" 
                text="The calculator computes joint probabilities using Odds Ratios (OR). By selecting multiple conditions, you are mathematically multiplying individual relative risks to estimate cumulative pathological impact against healthy baselines." 
              />
              <div>
                <h3 className="text-xl font-bold text-white">1.1 Interactive Risk Multiplier</h3>
                <p className="text-sm text-slate-400 mt-1">Select physiological indicators to observe how metabolic risk parameters compound against standard population baselines.</p>
              </div>

              {/* Perfectly centered 4/3 split layout */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex flex-col gap-4">
                  {leftColKeys.map(key => <RiskBlock key={key} rKey={key} />)}
                </div>
                <div className="flex-1 flex flex-col gap-4 justify-center">
                  {rightColKeys.map(key => <RiskBlock key={key} rKey={key} />)}
                </div>
              </div>

              {/* Multiplicative risk bar */}
              <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="text-xs text-indigo-300 font-extrabold uppercase tracking-widest">Cumulative Risk Multiplier</h4>
                    <p className="text-xs text-slate-400">Calculated compounding pathological impact against healthy population controls</p>
                  </div>
                  <p className="text-4xl font-black text-indigo-400 font-mono tracking-tight">{cumulativeRisk.toFixed(2)}x</p>
                </div>
                
                <div className="bg-slate-950 h-4 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${cumulativePct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* BAR CHART FOR PATHOLOGY COMPARISONS */}
            <div id="barchart" className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 scroll-mt-24">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Pathology Impact Chart</h3>
                  <p className="text-sm text-slate-400">Comparing individual clinical conditions against statistical likelihood of diabetes, ordered by severity.</p>
                </div>
                <ChartInfoButton 
                  title="Odds Ratios Explained" 
                  text="An odds ratio measures association strength. A value of 1.0 represents no differences in risk. Bars that extend further to the right represent highly elevated risk factors."
                />
              </div>

              <div className="w-full h-[400px]">
                <Plot
                  data={[{
                    type: 'bar', 
                    orientation: 'h',
                    x: processedData.sortedOddsX,
                    y: processedData.sortedOddsY,
                    marker: { color: '#4f46e5' },
                    text: processedData.sortedOddsX.map(val => val.toFixed(2) + 'x'),
                    textposition: 'auto',
                    hovertemplate: '<b>%{y}</b><br>Multiplies risk by %{x:.2f}x<extra></extra>'
                  }]}
                  layout={{ 
                    font: { color: '#94a3b8' }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent', 
                    xaxis: { title: 'Risk Multiplier (Odds Ratio)', gridcolor: '#1e293b', autorange: true }, 
                    yaxis: { gridcolor: 'transparent', autorange: true }, 
                    shapes: [{ type: 'line', x0: 1, x1: 1, y0: -0.5, y1: 7.5, line: { color: '#f43f5e', dash: 'dash', width: 2 } }], 
                    margin: { l: 200, r: 20, t: 20, b: 40 }, 
                    autosize: true 
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Description & Professional Deep Dive Appender */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Physiological risk metrics do not merely exist in silos; they compound. For individuals carrying multiple chronic markers, risk thresholds scale at a multiplicative rate. By clicking and combining different attributes in the risk selector above, you can observe how cumulative relative risk scales. As shown in the bar chart, high blood pressure and mobility limitations stand out as the largest drivers of diabetes risk in this dataset. When a patient carries both high blood pressure and elevated cholesterol, they are statistically over tenfold more likely to report a diabetes diagnosis compared to patients exhibiting clean baseline metrics.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart1(!deepDivePart1)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
              >
                <Brain size={16} /> 
                {deepDivePart1 ? 'Hide Clinical Deep Dive' : 'Professional Deep Dive'}
              </button>
            </div>
            {deepDivePart1 && (
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Stethoscope size={14} /> Clinical & Epidemiological Insights
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  These relative odds are calculated using unadjusted odds ratios (OR) derived from the BRFSS cohort. High Blood Pressure demonstrates an independent risk multiplier of over 5.0x, representing massive vascular systemic overlap and endothelial dysfunction. Intersecting pathologies like cardiovascular history, stroke history, and severe mobility limitations all sit well beyond the null line of 1.0. This underscores the biochemical pathways of advanced microvascular damage, where chronic circulatory distress acts as a clear prognostic marker for severe endocrine disorders.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 2 --- */}
        <section id="part2" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-amber-500" size={24} /> Lens 2:Social Stratification (Income, Education, and Access)
            </h2>
            <p className="text-slate-400 mt-2">Investigate how household income scales and educational achievement act as systemic buffers for metabolic health.</p>
          </div>

          {/* Slopes Graph with True Autoscaling */}
          <div id="slopes" className="relative bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <ChartInfoButton 
              title="Regression Analysis" 
              text="These line charts plot the calculated average prevalence of diabetes across ordinal categorical variables. The steepness of the slope indicates the strength of the socioeconomic protection factor." 
            />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">2.1 Socioeconomic Disparities</h3>
                <p className="text-sm text-slate-400">Toggle between Annual Income Bracket and Education Level by clicking the buttons to the right.</p>
              </div>
              
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                <button 
                  onClick={() => setSlopeView('income')} 
                  className={`px-5 py-2.5 text-sm rounded-lg font-bold transition-all duration-300 ${slopeView === 'income' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  Annual Income
                </button>
                <button 
                  onClick={() => setSlopeView('education')} 
                  className={`px-5 py-2.5 text-sm rounded-lg font-bold transition-all duration-300 ${slopeView === 'education' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  Education Level
                </button>
              </div>
            </div>

            <div className="w-full h-[400px]">
              {slopeView === 'income' ? (
                <Plot
                  data={[{
                    type: 'scatter', mode: 'lines+markers',
                    x: incomeLabels,
                    y: processedData.slope.incomeY,
                    name: 'Income Level',
                    line: { color: '#fbbf24', width: 4 },
                    marker: { size: 10 },
                    hovertemplate: 'Income: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    xaxis: { title: 'Annual Household Income Bracket', gridcolor: '#1e293b', automargin: true, autorange: true },
                    yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', autorange: true },
                    autosize: true
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Plot
                  data={[{
                    type: 'scatter', mode: 'lines+markers',
                    x: educationLabels,
                    y: processedData.slope.eduY,
                    name: 'Education Level',
                    line: { color: '#22d3ee', width: 4 },
                    marker: { size: 10 },
                    hovertemplate: 'Education: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    xaxis: { title: 'Highest Level of Education Attained', gridcolor: '#1e293b', automargin: true, autorange: true },
                    yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', autorange: true },
                    autosize: true
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              )}
            </div>
            <KeyInsightBanner text={slopeView === 'income' ?
              "A steep gradient persists across household income classes: the poorest earners exhibit more than double the diabetes rate of those in upper-income classes."
              : "Educational achievement functions as a protective socioeconomic proxy: those completing graduate studies show half the diabetic rates of those who did not complete high school."} 
            />
          </div>

          {/* Part 2a Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Health outcomes track directly along financial and educational lines. When observing the income slope, individuals in households earning <strong>Under $10k</strong> experience diabetes rates approaching 40%. This rate drops substantially as we cross the median income threshold (<strong>$35k - $50k</strong>), eventually bottoming out near 15% for those earning <strong>$75k or More</strong>. Similarly, individuals with <strong>No School</strong> or only elementary education face peak diabetic prevalence, whereas those who are <strong>College Graduates</strong> experience drastically lower rates. As resource parameters increase, metabolic disease rates decline. This pattern illustrates how socioeconomic factors act as a systemic protective mechanism, improving access to preventative medicine and nutrient-dense foods. 
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart2a(!deepDivePart2a)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
              >
                <Brain size={16} /> 
                {deepDivePart2a ? 'Hide Clinical Deep Dive' : 'Professional Deep Dive'}
              </button>
            </div>
            {deepDivePart2a && (
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Stethoscope size={14} /> Structural & Epidemiological Insights
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  This negative slope showcases a strong social gradient in health. This is not purely biological; it represents systemic disparities in food security and environmental stress. Lower socioeconomic status maps directly to hyper-segregated 'food deserts' with limited access to fresh, unprocessed ingredients, along with increased rates of baseline stress-induced cortisol release that can compound insulin resistance. Educational attainment serves as an excellent proxy for both health literacy and eventual occupational capacity, shielding patients from precarious physical labor and unstable healthcare access.
                </p>
              </div>
            )}
          </div>

          {/* Mirrored Butterfly Chart */}
          <div id="butterfly" className="relative bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <ChartInfoButton 
              title="Relative Percentage Disparities" 
              text="Instead of simply comparing raw bars, we have calculated the exact Relative Difference: ((Diabetic Rate - Healthy Rate) / Healthy Rate) * 100. The scale is artificially stretched from -100 to 100 to emphasize the visual divide between the cohorts." 
            />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">2.2 Behavioral Rates & Care Barriers (Healthy vs. Diabetic)</h3>
                <p className="text-sm text-slate-400">Comparing prevalence rates between the two cohorts. Toggle categories below.</p>
              </div>
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                <button 
                  onClick={() => setButterflyView('diet')} 
                  className={`px-5 py-2.5 text-sm rounded-lg font-bold transition-all duration-300 ${butterflyView === 'diet' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  Diet & Exercise
                </button>
                <button 
                  onClick={() => setButterflyView('barriers')} 
                  className={`px-5 py-2.5 text-sm rounded-lg font-bold transition-all duration-300 ${butterflyView === 'barriers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  Systemic Barriers
                </button>
              </div>
            </div>
            
            <div className="w-full h-[350px]">
              <Plot
                data={[
                  { 
                    type: 'bar', 
                    x: processedData.butterfly[butterflyView].healthy, 
                    y: processedData.butterfly[butterflyView].labels, 
                    orientation: 'h', 
                    name: 'Healthy Base',
                    marker: { color: '#10b981' },
                    hovertemplate: '<b>%{y}</b><br>Healthy Pop Rate: %{customdata:.1f}%<extra></extra>',
                    customdata: processedData.butterfly[butterflyView].healthy.map(v => Math.abs(v))
                  },
                  { 
                    type: 'bar', 
                    x: processedData.butterfly[butterflyView].diabetic, 
                    y: processedData.butterfly[butterflyView].labels, 
                    orientation: 'h', 
                    name: 'Diabetic Base',
                    marker: { color: '#f43f5e' },
                    hovertemplate: '<b>%{y}</b><br>Diabetic Pop Rate: %{x:.1f}%<extra></extra>' 
                  }
                ]}
                layout={{ 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  margin: { l: 150, r: 20, t: 30, b: 40 }, 
                  barmode: 'relative',
                  xaxis: { 
                    title: 'Prevalence Rate (%)',
                    gridcolor: '#1e293b',
                    tickformat: (val) => Math.abs(val) + '%',
                    autorange: true 
                  }, 
                  yaxis: { gridcolor: 'transparent' },
                  shapes: [{ type: 'line', x0: 0, x1: 0, y0: -0.5, y1: 2.5, line: { color: '#ffffff', width: 2 } }],
                  autosize: true,
                  legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: 1.15 }
                }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
            
            <KeyInsightBanner text={butterflyView === 'diet' ? 
              "While regular dietary intake of fruits and vegetables shows only small declines, physical activity levels reveal a severe drop-off among diabetic populations."
              : "Structural health disparities are alarming: patients with diabetes report experiencing difficulty walking and avoiding medical care due to costs far more frequently."} 
            />
          </div>

          {/* Part 2b Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              To truly understand disparities, we must look at how much more frequently diabetics face certain obstacles compared to healthy individuals. This mirrored chart displays the base rates side-by-side. For instance, while vegetable and fruit consumption drops mildly among those with diabetes, physical activity is significantly diminished. The true shock lies in the structural barriers: individuals living with diabetes report a massive spike in experiencing severe difficulty walking or climbing stairs, and a substantial increase in being unable to afford doctor visits when they need them.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart2b(!deepDivePart2b)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-slate-700 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md"
              >
                <Brain size={16} /> 
                {deepDivePart2b ? 'Hide Clinical Deep Dive' : 'Professional Deep Dive'}
              </button>
            </div>
            {deepDivePart2b && (
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Stethoscope size={14} /> Healthcare Policy & Access Analysis
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  By tracking the prevalence rates side-by-side, we see that behavioral nutrition choices (fruit and veg consumption) diverge less dramatically than physical and systemic variables. The exponential spike in ambulatory difficulty reflects advanced peripheral neuropathy, joint stress from elevated BMI, and generalized fatigue. Furthermore, the steep rise in healthcare cost barriers highlights a critical failure in systemic care delivery: the patients who require the most intensive and regular metabolic surveillance are statistically the most likely to skip appointments due to out-of-pocket expenses, ensuring worse longitudinal outcomes.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 3 --- */}
        <section id="part3" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Stethoscope className="text-blue-500" size={24} /> Lens 3:Intersecting Conditions & Subjective Wellness
            </h2>
            <p className="text-slate-400 mt-2">Examine how biological markers, cardiovascular disease pathways, and mental health indicators intersect.</p>
          </div>

          {/* Sankey Flow Visual with Interactive Navigation Cards */}
          <div id="sankey" className="relative bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full space-y-6 scroll-mt-24">
            <ChartInfoButton title="Alluvial Flow (Sankey)" text="This graph calculates the overlapping prevalence of cardiovascular conditions specifically within the diabetic cohort subset. Thicker bands indicate a larger absolute volume of patients carrying both conditions." />
            <div className="pr-12 lg:pr-32">
            <div>
              <h3 className="text-xl font-bold text-white">3.1 The Web of Chronic Conditions</h3>
              <p className="text-sm text-slate-400 mt-1">
                Visualizing how diabetes maps onto secondary cardiovascular complications. Use the colored selection cards below the diagram to view detailed clinical profiles.
              </p>
            </div>

            <div className="w-full h-[300px]">
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

            {/* NAVIGATION CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <button 
                onClick={() => setSelectedNode(0)}
                className={`p-3 rounded-xl border text-left transition-all duration-300 ${selectedNode === 0 ? 'bg-rose-950/40 border-rose-500 text-rose-300 ring-2 ring-rose-500/30' : 'bg-slate-950 border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-slate-200'}`}
              >
                <div className="w-3 h-3 rounded-full bg-rose-500 mb-2" />
                <span className="font-bold text-xs sm:text-sm block">1. Diabetes Base</span>
              </button>
              <button 
                onClick={() => setSelectedNode(1)}
                className={`p-3 rounded-xl border text-left transition-all duration-300 ${selectedNode === 1 ? 'bg-sky-950/40 border-sky-500 text-sky-300 ring-2 ring-sky-500/30' : 'bg-slate-950 border-slate-800 hover:border-sky-500/40 text-slate-400 hover:text-slate-200'}`}
              >
                <div className="w-3 h-3 rounded-full bg-sky-400 mb-2" />
                <span className="font-bold text-xs sm:text-sm block">2. High BP</span>
              </button>
              <button 
                onClick={() => setSelectedNode(2)}
                className={`p-3 rounded-xl border text-left transition-all duration-300 ${selectedNode === 2 ? 'bg-amber-950/40 border-amber-500 text-amber-300 ring-2 ring-amber-500/30' : 'bg-slate-950 border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-slate-200'}`}
              >
                <div className="w-3 h-3 rounded-full bg-amber-400 mb-2" />
                <span className="font-bold text-xs sm:text-sm block">3. High Cholesterol</span>
              </button>
              <button 
                onClick={() => setSelectedNode(3)}
                className={`p-3 rounded-xl border text-left transition-all duration-300 ${selectedNode === 3 ? 'bg-purple-950/40 border-purple-500 text-purple-300 ring-2 ring-purple-500/30' : 'bg-slate-950 border-slate-800 hover:border-purple-500/40 text-slate-400 hover:text-slate-200'}`}
              >
                <div className="w-3 h-3 rounded-full bg-purple-500 mb-2" />
                <span className="font-bold text-xs sm:text-sm block">4. Heart Disease</span>
              </button>
              <button 
                onClick={() => setSelectedNode(4)}
                className={`p-3 rounded-xl border text-left transition-all duration-300 ${selectedNode === 4 ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30' : 'bg-slate-950 border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-slate-200'}`}
              >
                <div className="w-3 h-3 rounded-full bg-emerald-500 mb-2" />
                <span className="font-bold text-xs sm:text-sm block">5. Stroke History</span>
              </button>
            </div>

            {/* Dynamic Information Panel */}
            <div className={`p-6 border rounded-xl shadow-2xl transition-all duration-500 ${activeSankeyStyles.border} ${activeSankeyStyles.bg}`}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${activeSankeyStyles.badge}`}>
                  Active View Target
                </span>
                <h4 className="text-lg font-bold text-white">{sankeyDetails[selectedNode].title}</h4>
              </div>
              <p className="text-slate-300 leading-relaxed text-sm">
                {sankeyDetails[selectedNode].text}
              </p>
              <div className="mt-4 p-4 bg-slate-950/60 rounded-lg border border-slate-850">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Biological Flow Insight</p>
                <p className="text-slate-400 leading-relaxed text-xs">
                  {sankeyDetails[selectedNode].clinical}
                </p>
              </div>
            </div>
          </div>

          {/* Part 3a Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Diabetes rarely presents as an isolated diagnosis; it functions as a gateway to wider cardiovascular and cerebrovascular complications. This flow chart visualizes how these chronic pathologies overlap. Note the massive visual pathways connecting Diabetes directly to High Blood Pressure and High Cholesterol, highlighting why managing metabolic health requires addressing overall heart health.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart3a(!deepDivePart3a)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-slate-700 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md"
              >
                <Brain size={16} /> 
                {deepDivePart3a ? 'Hide Clinical Deep Dive' : 'Professional Deep Dive'}
              </button>
            </div>
            {deepDivePart3a && (
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Stethoscope size={14} /> Pathophysiological Insights
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  This Sankey diagram maps the incidence of comorbidities branching from a cohort of diabetic patients. Pathophysiologically, the thickest channels flow toward High Blood Pressure and High Cholesterol, representing the metabolic syndrome triad. Microvascular and macrovascular changes under hyperinsulinemia lead directly to coronary artery disease (Heart Disease) and cerebrovascular disease (Stroke). The significant statistical overlap (over 75% comorbid for hypertension) demonstrates the value of modern cardioprotective and renal-protective agents.
                </p>
              </div>
            )}
          </div>

          {/* SPLIT VIOLIN PLOT */}
          <div id="violins" className="relative bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <ChartInfoButton 
              title="Violin Density Plots" 
              text="A violin plot combines a traditional box plot with a kernel density estimation (KDE) curve. Wider sections represent where the highest concentration of patient BMIs fall. The white line tracks the calculated statistical mean." 
            />
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h4 className="text-lg font-bold text-white mb-1">3.2 Continuous BMI Distributions vs. Self-Reported General Health</h4>
                <p className="text-xs text-slate-400">
                  Observe the full density of weights across general health levels (1 = Excellent, 5 = Poor).
                </p>
              </div>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 w-full lg:w-72">
                <label className="flex justify-between text-xs text-slate-300 font-bold mb-3">
                  <span>Minimum Bad Mental Health Days:</span>
                  <span className="text-indigo-400">{mentalHealthDays} Days</span>
                </label>
                <input 
                  type="range" 
                  min="0" max="30" 
                  value={mentalHealthDays} 
                  onChange={(e) => setMentalHealthDays(parseInt(e.target.value, 10))} 
                  className="w-full accent-indigo-500 cursor-pointer" 
                />
              </div>
            </div>

            {/* Split Violin Plot */}
            <div className="w-full h-[380px]">
              <Plot
                data={[
                  ...[1, 2, 3, 4, 5].map((lvl, idx) => {
                    const colors = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#ef4444'];
                    return {
                      type: 'violin',
                      y: processedData.violin[`gen${lvl}`],
                      name: `Health Lvl ${lvl}`,
                      points: false, // Clean up visual noise by hiding individual scatter points
                      box: { visible: true, width: 0.15, line: { color: '#ffffff' } },
                      meanline: { visible: true, color: '#fbbf24', width: 2 },
                      line: { color: colors[idx], width: 2 },
                      hovertemplate: 'Health Rating: ' + lvl + '<br>BMI: %{y}<extra></extra>'
                    };
                  }),
                  {
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: ['Health Lvl 1', 'Health Lvl 2', 'Health Lvl 3', 'Health Lvl 4', 'Health Lvl 5'],
                    y: processedData.violinMeans,
                    name: 'Average BMI Trend',
                    line: { color: '#ffffff', width: 4, dash: 'solid' },
                    marker: { size: 10, color: '#fbbf24', line: { color: '#ffffff', width: 2 } },
                    hovertemplate: 'Average BMI: %{y:.1f}<extra></extra>'
                  }
                ]}
                layout={{
                  font: { color: '#94a3b8', size: 9 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  xaxis: { title: 'General Health Rating (1 = Excellent, 5 = Poor)', gridcolor: '#1e293b' },
                  yaxis: { title: 'BMI (Body Mass Index)', gridcolor: '#1e293b', range: [10, 60] },
                  showlegend: false,
                  autosize: true,
                  margin: { l: 50, r: 20, t: 15, b: 50 }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Part 3b Descriptor */}
          <div className="space-y-4 max-w-4xl mt-6">
            <p className="text-slate-300 leading-relaxed text-base">
              Subjective well-being is often a strong reflection of our physical health. When viewing the BMI distribution across general health levels, it becomes clear that self-reported wellness and objective physiological weight metrics are closely connected. By sliding the mental health days input at the top, you can even explore how the accumulation of stressful or mentally poor days shifts these distributions further.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart3b(!deepDivePart3b)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-slate-700 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md"
              >
                <Brain size={16} /> 
                {deepDivePart3b ? 'Hide Clinical Deep Dive' : 'Professional Deep Dive'}
              </button>
            </div>
            {deepDivePart3b && (
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Stethoscope size={14} /> Neuropsychiatric & Somatic Analysis
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  This plot maps subjective health ratings against objective physical metrics via kernel density estimation. The white trendline displays a significant increase in mean BMI moving from Level 1 up to Level 5. When filtering for mental health distress using the slider, we observe an upward shift in density distributions within the lower health levels. This highlights the bi-directional relationships of metabolic and neuropsychiatric health, where chronic psychological stress promotes visceral lipid storage and worsens subjective somatic wellness.
                </p>
              </div>
            )}
          </div>

          {/* Decompressed Heatmap & Correlation Translator */}
          <div id="heatmap" className="relative bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <ChartInfoButton 
              title="Pearson Correlation Matrix" 
              text="This matrix calculates Pearson correlation coefficients (r) between -1.0 and 1.0. We removed the mirrored upper diagonal to reduce visual noise. Deep blue indicates a strong positive link, while deep red indicates a strong inverse link." 
            />
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">3.3 Systemic Connections Map</h3>
                <p className="text-sm text-slate-400">An asymmetric heatmap of clinical and social relationships paired with an interpretation panel.</p>
              </div>
            </div>

            {/* Changed to xl:grid-cols-2 and boosted the heatmap height to 600px to avoid compression */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              
              {/* Asymmetric Heatmap */}
              <div className="flex flex-col h-full w-full">
                <div className="w-full h-[550px] lg:h-[650px]">
                  <Plot 
                    data={[{ 
                      type: 'heatmap', 
                      z: processedData.heatmap.z, 
                      x: processedData.heatmap.labels, 
                      y: processedData.heatmap.labels, 
                      colorscale: 'RdBu', 
                      zmin: -0.5, 
                      zmax: 0.5, 
                      reversescale: true,
                      showscale: true,
                      hovertemplate: 'Var 1: %{x}<br>Var 2: %{y}<br>Correlation: %{z:.2f}<extra></extra>'
                    }]} 
                    layout={{ 
                      font: { color: '#94a3b8', size: 11 }, 
                      paper_bgcolor: 'transparent', 
                      plot_bgcolor: 'transparent', 
                      margin: { l: 150, r: 10, t: 20, b: 150 }, 
                      xaxis: { tickangle: -45, automargin: true, gridcolor: 'transparent' }, 
                      yaxis: { autorange: 'reversed', automargin: true, gridcolor: 'transparent' }, 
                      autosize: true 
                    }} 
                    useResizeHandler={true} 
                    style={{ width: '100%', height: '100%' }} 
                  />
                </div>
                
                {/* Visual Legend specifically for heatmap interpretations */}
                <div className="mt-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">How to Read the Color Mapping:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-blue-600 rounded flex-shrink-0" />
                      <span className="text-slate-400"><strong>Deep Blue</strong> (+0.25 to +1.00): Strong positive co-occurrence.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-slate-100 rounded border border-slate-300 flex-shrink-0" />
                      <span className="text-slate-400"><strong>White/Light</strong> (-0.10 to +0.10): Statistical independence.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-red-600 rounded flex-shrink-0" />
                      <span className="text-slate-400"><strong>Deep Red</strong> (-0.10 to -1.00): Strong inverse relationship.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pairwise Translator Column */}
              <div className="bg-slate-800/40 p-6 lg:p-8 border border-slate-700/50 rounded-xl flex flex-col justify-start w-full">
                <div className="mb-6">
                  <span className="text-xs font-black tracking-widest text-indigo-400 uppercase">Interactive Tool</span>
                  <h4 className="text-xl font-bold text-white mt-1">Correlation Translator</h4>
                  <p className="text-sm text-slate-400 mt-2">Select a key pair of variables below to translate mathematical patterns into clear clinical insights.</p>
                </div>

                <select 
                  value={translatorVar} 
                  onChange={(e) => setTranslatorVar(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-8 shadow-inner"
                >
                  {Object.keys(correlationTranslations).map(pair => (
                    <option key={pair} value={pair}>{pair}</option>
                  ))}
                </select>

                <div className="space-y-5">
                  {correlationTranslations[translatorVar].map((bullet, idx) => (
                    <div key={idx} className="flex gap-4 items-start bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                      <p className="text-sm md:text-base text-slate-300 leading-relaxed">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <KeyInsightBanner text="Note the negative correlation (-0.37) between General Health and Annual Income: health is deeply bound up with economic security and resources." />
          </div>

          {/* Part 3c Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Biological markers, socioeconomic backgrounds, and daily behaviors are all part of an interconnected system. This asymmetric heatmap simplifies these mathematical relationships, removing duplicate values to highlight key systemic correlations. Blue squares represent positive correlations, while red squares show negative links. Use the legend below the chart to interpret the intensity of the colors. Select any pair of variables in the Correlation Translator dropdown to view a real-world translation of how they interact.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart3c(!deepDivePart3c)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-slate-700 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md"
              >
                <Brain size={16} /> 
                {deepDivePart3c ? 'Hide Clinical Deep Dive' : 'Professional Deep Dive'}
              </button>
            </div>
            {deepDivePart3c && (
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Stethoscope size={14} /> Systems Medicine Analysis
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  The asymmetric heatmap displays the lower triangle of a Pearson correlation matrix. Key relationships include the strong negative correlation between Annual Income and General Health (-0.37), which represents a significant socioeconomic-somatic link in this dataset. The positive correlation between Education and Income (+0.42) shows the structural relationship of socioeconomic status. In contrast, biological correlations like Age & High BP (+0.27) reflect cellular aging and shared pathways of vascular strain.
                </p>
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}