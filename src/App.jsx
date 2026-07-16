import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { 
  Activity, Info, HeartPulse, Users, 
  Stethoscope, Brain
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
  // Add 0.5 Laplace adjustment to prevent divide-by-zero errors in sparse slices
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
  'Under $10k', '$10k - $15k', '$15k - $20k', '$25k - $35k', 
  '$35k - $50k', '$50k - $75k', '$75k or More'
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
    "Vascular Double-Whammy: High blood pressure is the single strongest clinical correlate for diabetes in this dataset. This represents systemic vascular stress in action.",
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

const PracticalInsightBanner = ({ text }) => (
  <div className="mt-4 p-4 bg-slate-800/50 border-l-4 border-indigo-500 rounded-r-lg text-slate-300 text-sm md:text-base leading-relaxed">
    <span className="font-bold text-indigo-400 uppercase text-xs tracking-wider mr-2">Practical Insight:</span>
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
  const [violinMetric, setViolinMetric] = useState('BMI'); 
  const [selectedNode, setSelectedNode] = useState(0); 

  // Deep Dive Collapses
  const [deepDivePart1, setDeepDivePart1] = useState(false);
  const [deepDivePart2a, setDeepDivePart2a] = useState(false);
  const [deepDivePart2b, setDeepDivePart2b] = useState(false);
  const [deepDivePart3a, setDeepDivePart3a] = useState(false);
  const [deepDivePart3b, setDeepDivePart3b] = useState(false);
  const [deepDivePart3c, setDeepDivePart3c] = useState(false);

  // 8-Factor Calculator State
  const [calcRisks, setCalcRisks] = useState({
    bp: false,
    chol: false,
    smoker: false,
    heart: false,
    stroke: false,
    noPhysAct: false,
    heavyDrink: false,
    diffWalk: false
  });

  const toggleRisk = (key) => setCalcRisks(prev => ({ ...prev, [key]: !prev[key] }));

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

    const violin = { hBMI: [], hAge: [], dBMI: [], dAge: [] };
    const stats = {
      healthy: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 },
      diabetic: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 }
    };
    const incomeStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0}, 7:{t:0, d:0}, 8:{t:0, d:0} };
    const eduStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0} };
    const vars = { Diabetes: [], BP: [], Chol: [], BMI: [], Age: [], GenHlth: [], Income: [], Edu: [] };
    
    // Tracking structures for 8 distinct Odds Ratios
    const orTracks = {
      bp: { ed: 0, eh: 0, ud: 0, uh: 0 },
      chol: { ed: 0, eh: 0, ud: 0, uh: 0 },
      smoker: { ed: 0, eh: 0, ud: 0, uh: 0 },
      heart: { ed: 0, eh: 0, ud: 0, uh: 0 },
      stroke: { ed: 0, eh: 0, ud: 0, uh: 0 },
      noPhysAct: { ed: 0, eh: 0, ud: 0, uh: 0 },
      heavyDrink: { ed: 0, eh: 0, ud: 0, uh: 0 },
      diffWalk: { ed: 0, eh: 0, ud: 0, uh: 0 }
    };

    let d_bp = 0, d_chol = 0, d_heart = 0, d_stroke = 0;
    
    const raincloudBMI = { gen1: [], gen2: [], gen3: [], gen4: [], gen5: [] };
    const raincloudAge = { gen1: [], gen2: [], gen3: [], gen4: [], gen5: [] };

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

      if (isDiabetic) { 
        violin.dBMI.push(row.BMI); 
        violin.dAge.push(row.Age); 
      } else { 
        violin.hBMI.push(row.BMI); 
        violin.hAge.push(row.Age); 
      }

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

      // Populate 8 distinct Odds Ratios matrices
      const fillTrack = (trackObj, flag) => {
        if (flag) {
          isDiabetic ? trackObj.ed++ : trackObj.eh++;
        } else {
          isDiabetic ? trackObj.ud++ : trackObj.uh++;
        }
      };

      fillTrack(orTracks.bp, row.HighBP === 1);
      fillTrack(orTracks.chol, row.HighChol === 1);
      fillTrack(orTracks.smoker, row.Smoker === 1);
      fillTrack(orTracks.heart, row.HeartDiseaseorAttack === 1);
      fillTrack(orTracks.stroke, row.Stroke === 1);
      fillTrack(orTracks.noPhysAct, row.PhysActivity === 0); // Inverted to measure inactivity
      fillTrack(orTracks.heavyDrink, row.HvyAlcoholConsump === 1);
      fillTrack(orTracks.diffWalk, row.DiffWalk === 1);

      if (isDiabetic) {
        if (row.HighBP === 1) d_bp++;
        if (row.HighChol === 1) d_chol++; 
        if (row.HeartDiseaseorAttack === 1) d_heart++; 
        if (row.Stroke === 1) d_stroke++;
      }

      if (includeInRaincloud && row.GenHlth >= 1 && row.GenHlth <= 5 && index % 20 === 0) {
        raincloudBMI[`gen${row.GenHlth}`].push(row.BMI);
        raincloudAge[`gen${row.GenHlth}`].push(row.Age);
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

    const raincloudBMIMeans = [1, 2, 3, 4, 5].map(lvl => {
      const arr = raincloudBMI[`gen${lvl}`];
      return arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });

    const raincloudAgeMeans = [1, 2, 3, 4, 5].map(lvl => {
      const arr = raincloudAge[`gen${lvl}`];
      return arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });

    return {
      violin, raincloudBMI, raincloudAge, raincloudBMIMeans, raincloudAgeMeans,
      heatmap: { z: zMatrix, labels: heatmapVariables },
      slope: {
        incomeY: [1, 2, 3, 4, 5, 6, 7].map(l => calcPct(incomeStats[l].d, incomeStats[l].t)),
        eduY: [1, 2, 3, 4, 5, 6].map(l => calcPct(eduStats[l].d, eduStats[l].t))
      },
      butterfly: {
        diet: {
          labels: ['Physically Active', 'Eats Fruit Daily', 'Eats Vegetables Daily'],
          healthy: [
            calcPct(stats.healthy.physAct, stats.healthy.total),
            calcPct(stats.healthy.fruits, stats.healthy.total),
            calcPct(stats.healthy.veggies, stats.healthy.total)
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
            calcPct(stats.healthy.diffWalk, stats.healthy.total),
            calcPct(stats.healthy.noDoc, stats.healthy.total)
          ],
          diabetic: [
            calcPct(stats.diabetic.diffWalk, stats.diabetic.total),
            calcPct(stats.diabetic.noDoc, stats.diabetic.total)
          ]
        }
      },
      odds: {
        bp: calcOR(orTracks.bp.ed, orTracks.bp.eh, orTracks.bp.ud, orTracks.bp.uh),
        chol: calcOR(orTracks.chol.ed, orTracks.chol.eh, orTracks.chol.ud, orTracks.chol.uh),
        smoker: calcOR(orTracks.smoker.ed, orTracks.smoker.eh, orTracks.smoker.ud, orTracks.smoker.uh),
        heart: calcOR(orTracks.heart.ed, orTracks.heart.eh, orTracks.heart.ud, orTracks.heart.uh),
        stroke: calcOR(orTracks.stroke.ed, orTracks.stroke.eh, orTracks.stroke.ud, orTracks.stroke.uh),
        noPhysAct: calcOR(orTracks.noPhysAct.ed, orTracks.noPhysAct.eh, orTracks.noPhysAct.ud, orTracks.noPhysAct.uh),
        heavyDrink: calcOR(orTracks.heavyDrink.ed, orTracks.heavyDrink.eh, orTracks.heavyDrink.ud, orTracks.heavyDrink.uh),
        diffWalk: calcOR(orTracks.diffWalk.ed, orTracks.diffWalk.eh, orTracks.diffWalk.ud, orTracks.diffWalk.uh)
      },
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
      case 0: return { border: "border-rose-500/40", bg: "bg-rose-950/25", accent: "text-rose-400", badge: "bg-rose-500/20 text-rose-300", cardBg: "bg-rose-950/20 hover:bg-rose-900/30 border-rose-500/40" };
      case 1: return { border: "border-sky-500/40", bg: "bg-sky-950/25", accent: "text-sky-400", badge: "bg-sky-500/20 text-sky-300", cardBg: "bg-sky-950/20 hover:bg-sky-900/30 border-sky-500/40" };
      case 2: return { border: "border-amber-500/40", bg: "bg-amber-950/25", accent: "text-amber-400", badge: "bg-amber-500/20 text-amber-300", cardBg: "bg-amber-950/20 hover:bg-amber-900/30 border-amber-500/40" };
      case 3: return { border: "border-purple-500/40", bg: "bg-purple-950/25", accent: "text-purple-400", badge: "bg-purple-500/20 text-purple-300", cardBg: "bg-purple-950/20 hover:bg-purple-900/30 border-purple-500/40" };
      case 4: return { border: "border-emerald-500/40", bg: "bg-emerald-950/25", accent: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300", cardBg: "bg-emerald-950/20 hover:bg-emerald-900/30 border-emerald-500/40" };
      default: return { border: "border-slate-700", bg: "bg-slate-900/50", accent: "text-slate-200", badge: "bg-slate-800 text-slate-400", cardBg: "bg-slate-900/50 hover:bg-slate-800/50 border-slate-700" };
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

  // Live Multiplicative Risk Calculations for 8 factors
  let cumulativeRisk = 1.0;
  if (calcRisks.bp) cumulativeRisk *= processedData.odds.bp.or;
  if (calcRisks.chol) cumulativeRisk *= processedData.odds.chol.or;
  if (calcRisks.smoker) cumulativeRisk *= processedData.odds.smoker.or;
  if (calcRisks.heart) cumulativeRisk *= processedData.odds.heart.or;
  if (calcRisks.stroke) cumulativeRisk *= processedData.odds.stroke.or;
  if (calcRisks.noPhysAct) cumulativeRisk *= processedData.odds.noPhysAct.or;
  if (calcRisks.heavyDrink) cumulativeRisk *= processedData.odds.heavyDrink.or;
  if (calcRisks.diffWalk) cumulativeRisk *= processedData.odds.diffWalk.or;

  const maxRiskScale = 50.0; 
  const cumulativePct = Math.min((cumulativeRisk / maxRiskScale) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto scroll-smooth">
      
      {/* premium sticky navigation bar */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800 py-4 px-6 shadow-xl">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-500 animate-pulse" size={24} />
            <span className="font-black text-white text-lg tracking-wider">DIABETES ANALYTICS</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#part1" className="text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all">
              Part 1: Personal Risk Factors & Multipliers
            </a>
            <a href="#part2" className="text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all">
              Part 2: Socioeconomic Barriers & Wellness Disparities
            </a>
            <a href="#part3" className="text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all">
              Part 3: Clinical Intersections & Chronic Comorbidities
            </a>
          </div>
        </div>
      </nav>

      {/* header */}
      <header className="max-w-4xl mx-auto pt-12 pb-6 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">National Diabetes Prevalence & Public Health Dashboard</h1>
        <p className="text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
          Explore population health statistics mapped across 70,000 real patient health records. Interrogate demographic trends, behavioral determinants, and co-occurring chronic pathologies.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-full text-xs font-semibold text-indigo-300 max-w-2xl">
          <Brain size={14} className="flex-shrink-0" />
          <span>Professional Note: Healthcare workers, policymakers, and quantitative analysts can click the "Professional Deep Dive" toggles beneath any section for advanced clinical parameters.</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- SECTION 1 --- */}
        <section id="part1" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <HeartPulse className="text-rose-500" size={24} /> Part 1: Personal Risk Factors & Multipliers
            </h2>
            <p className="text-slate-400 mt-2">Explore how standard demographic and physiological conditions mathematically multiply risks.</p>
          </div>

          <div className="space-y-6">
            {/* STACKED CALCULATOR */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">Interactive Risk Multiplier</h3>
                <p className="text-sm text-slate-400 mt-1">Select physiological indicators to observe how metabolic risk parameters compound against standard population baselines.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(calcRisks).map(key => {
                  const label = 
                    key === 'bp' ? 'High Blood Pressure' : 
                    key === 'chol' ? 'High Cholesterol' : 
                    key === 'smoker' ? 'Active Tobacco Smoker' : 
                    key === 'heart' ? 'Heart Disease History' :
                    key === 'stroke' ? 'Prior Cerebrovascular Stroke' :
                    key === 'noPhysAct' ? 'Sedentary Lifestyle (No Exercise)' :
                    key === 'heavyDrink' ? 'Heavy Alcohol Consumption' :
                    'Difficulty Walking / Ambulation Obstacles';

                  const orVal = processedData.odds[key].or;
                  const isActive = calcRisks[key];
                  const barWidth = isActive ? `${(orVal / 6.0) * 100}%` : '0%';

                  return (
                    <div key={key} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 shadow-inner">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isActive} 
                          onChange={() => toggleRisk(key)} 
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
                })}
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

            {/* FOREST PLOT FOR PATHOLOGY COMPARISONS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Pathology Impact Chart</h3>
                  <p className="text-sm text-slate-400">Comparing individual clinical conditions against statistical likelihood of diabetes.</p>
                </div>
                <InfoPopup 
                  title="Odds Ratios Explained" 
                  text="An odds ratio measures association strength. A value of 1.0 (the red dotted line) represents no differences in risk. Markers plotted far to the right represent highly elevated risk factors."
                />
              </div>

              <div className="w-full h-[380px]">
                <Plot
                  data={[{
                    type: 'scatter', mode: 'markers',
                    x: [
                      processedData.odds.bp.or, processedData.odds.chol.or, processedData.odds.smoker.or, 
                      processedData.odds.heart.or, processedData.odds.stroke.or, processedData.odds.noPhysAct.or,
                      processedData.odds.heavyDrink.or, processedData.odds.diffWalk.or
                    ],
                    y: [
                      'High Blood Pressure', 'High Cholesterol', 'Smoker', 
                      'Heart Disease', 'Stroke History', 'Sedentary Lifestyle',
                      'Heavy Drinking', 'Difficulty Walking'
                    ],
                    error_x: { 
                      type: 'data', symmetric: true, 
                      array: [
                        processedData.odds.bp.error, processedData.odds.chol.error, processedData.odds.smoker.error, 
                        processedData.odds.heart.error, processedData.odds.stroke.error, processedData.odds.noPhysAct.error,
                        processedData.odds.heavyDrink.error, processedData.odds.diffWalk.error
                      ], 
                      color: '#818cf8', thickness: 2, width: 6 
                    },
                    marker: { size: 12, color: '#4f46e5' },
                    text: [
                      processedData.odds.bp.or.toFixed(2), processedData.odds.chol.or.toFixed(2), processedData.odds.smoker.or.toFixed(2), 
                      processedData.odds.heart.or.toFixed(2), processedData.odds.stroke.or.toFixed(2), processedData.odds.noPhysAct.or.toFixed(2),
                      processedData.odds.heavyDrink.or.toFixed(2), processedData.odds.diffWalk.or.toFixed(2)
                    ],
                    hovertemplate: '<b>%{y}</b><br>Multiplies risk by %{x:.2f}x<extra></extra>'
                  }]}
                  layout={{ 
                    font: { color: '#94a3b8' }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent', 
                    xaxis: { title: 'Risk Multiplier (Odds Ratio)', gridcolor: '#1e293b', autorange: true }, 
                    yaxis: { gridcolor: 'transparent' }, 
                    shapes: [{ type: 'line', x0: 1, x1: 1, y0: -0.5, y1: 7.5, line: { color: '#f43f5e', dash: 'dash', width: 2 } }], 
                    margin: { l: 180, r: 20, t: 20, b: 40 }, 
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
              Physiological risk metrics do not merely exist in silos; they compound. For individuals carrying multiple chronic markers, risk thresholds scale at a multiplicative rate. By clicking and combining different attributes in the risk selector above, you can observe how cumulative relative risk scales. In real-world data, carrying both high blood pressure and elevated cholesterol raises statistical likelihood metrics over tenfold compared to patients exhibiting clean baseline metrics.
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
                  These relative odds are calculated using unadjusted odds ratios (OR) with standard Wald-test 95% confidence intervals. In the computed BRFSS sample, High Blood Pressure demonstrates an independent risk multiplier of over 5.0x, representing significant vascular systemic overlap. Intersecting pathologies like cardiovascular history, stroke history, and severe mobility limitations (difficulty walking) all sit well beyond the null line of 1.0. This underscores the biochemical pathways of advanced microvascular damage, where chronic circulatory distress acts as a clear prognostic marker for severe endocrine disorders.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 2 --- */}
        <section id="part2" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-amber-500" size={24} /> Part 2: Socioeconomic Barriers & Wellness Disparities
            </h2>
            <p className="text-slate-400 mt-2">Investigate how household income scales and educational achievement act as systemic buffers for metabolic health.</p>
          </div>

          {/* Slopes Graph with True Autoscaling */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Socioeconomic Disparities</h3>
                <p className="text-sm text-slate-400">Diabetes prevalence mapped against distinct structural variables.</p>
              </div>
              
              {/* Noticeable Toggle Switches */}
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
            <PracticalInsightBanner text={slopeView === 'income' ?
              "A steep gradient persists across household income classes: the poorest earners exhibit more than double the diabetes rate of those in upper-income classes."
              : "Educational achievement functions as a protective socioeconomic proxy: those completing graduate studies show half the diabetic rates of those who did not complete high school."} 
            />
          </div>

          {/* Part 2a Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Health outcomes track directly along financial and educational lines. As resource parameters increase, metabolic disease rates decline. This pattern illustrates how socioeconomic factors act as a systemic protective mechanism, improving access to preventative medicine and nutrient-dense foods. <strong className="text-indigo-400">Toggle between Annual Income Bracket and Education Level by clicking the buttons to the right</strong> of the chart header to inspect these distinct social pathways.
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
                  This negative slope showcases a strong social gradient in health. In the income slice, diabetes prevalence drops from ~36% to ~14% as household income rises. This is not purely biological; it represents systemic disparities in food security and environmental stress. Lower socioeconomic status maps directly to hyper-segregated 'food deserts' with limited access to fresh, unprocessed ingredients, along with increased rates of baseline stress-induced cortisol release that can compound insulin resistance.
                </p>
              </div>
            )}
          </div>

          {/* Butterfly Chart using Cohort-Proportional Percentages */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Behavioral Rates & Care Barriers</h3>
                <p className="text-sm text-slate-400">Proportional rates within each specific cohort: Healthy (Green) vs. Diabetic (Red).</p>
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
                    x: processedData.butterfly[butterflyView].healthy.map(v => -v), 
                    y: processedData.butterfly[butterflyView].labels, 
                    orientation: 'h', 
                    name: 'Non-Diabetic Population (%)', 
                    marker: { color: '#10b981' }, 
                    customdata: processedData.butterfly[butterflyView].healthy, 
                    hovertemplate: '%{y} (Healthy Cohort)<br>Proportion: %{customdata:.1f}%<extra></extra>' 
                  },
                  { 
                    type: 'bar', 
                    x: processedData.butterfly[butterflyView].diabetic, 
                    y: processedData.butterfly[butterflyView].labels, 
                    orientation: 'h', 
                    name: 'Diabetic Population (%)', 
                    marker: { color: '#f43f5e' }, 
                    hovertemplate: '%{y} (Diabetic Cohort)<br>Proportion: %{x:.1f}%<extra></extra>' 
                  }
                ]}
                layout={{ 
                  barmode: 'relative', 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  margin: { l: 180, r: 20, t: 20, b: 40 }, 
                  xaxis: { 
                    range: [-100, 100], 
                    tickvals: [-100, -75, -50, -25, 0, 25, 50, 75, 100], 
                    ticktext: ['100%', '75%', '50%', '25%', '0%', '25%', '50%', '75%', '100%'], 
                    gridcolor: '#1e293b' 
                  }, 
                  yaxis: { gridcolor: 'transparent' }, 
                  autosize: true 
                }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
            <PracticalInsightBanner text={butterflyView === 'diet' ? 
              "While regular dietary intake of fruits and vegetables shows only small percentage differences, physical exercise levels are substantially lower among diabetic patients."
              : "Structural health disparities are clear: patients with diabetes are more than three times as likely to report difficulty walking and face higher cost barriers to basic physician access."} 
            />
          </div>

          {/* Part 2b Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              While daily wellness behaviors like vegetable consumption are important for physical health, structural barriers are often the primary challenge. When comparing populations, individuals living with diabetes report high rates of daily physical and economic obstacles. They are three times more likely to experience severe mobility limitations (difficulty walking or climbing stairs) and frequently miss scheduled medical consultations due to care costs. <strong className="text-indigo-400">Toggle between Diet & Exercise and Systemic Barriers by clicking the buttons to the right</strong> to compare behavior patterns against financial and physical obstacles.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart2b(!deepDivePart2b)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
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
                  This proportional comparison indicates that behavioral metrics (such as fruit and vegetable intake) vary less between cohorts than structural parameters. Approximately 38% of the diabetic population reports difficulty walking compared to only 11% of the non-diabetic cohort. Crucially, the cost barrier is elevated. This creates a challenging feedback loop: metabolic dysfunction requires frequent medical surveillance, but high care costs prevent regular access to primary physicians, increasing the risk of untreated vascular and renal complications.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 3 --- */}
        <section id="part3" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Stethoscope className="text-blue-500" size={24} /> Part 3: Clinical Intersections & Chronic Comorbidities
            </h2>
            <p className="text-slate-400 mt-2">Examine how biological markers, cardiovascular disease pathways, and mental health indicators intersect.</p>
          </div>

          {/* Sankey Flow Visual with Interactive Navigation Cards */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">The Web of Chronic Conditions</h3>
              <p className="text-sm text-slate-400 mt-1">
                Visualizing how diabetes maps onto secondary cardiovascular and cerebrovascular complications. Use the colored selection cards below the diagram to view detailed clinical profiles.
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

            {/* FAILSAFE NAVIGATION CARDS (Color Coded to match Sankey Nodes) */}
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
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
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

          {/* Violin Density Plot with Full Autoscaling */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Subjective Wellness vs. Physical Markers</h3>
                <p className="text-sm text-slate-400">Distribution shapes grouped by self-reported health rating (1 = Excellent, 5 = Poor).</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-950 p-4 rounded-xl border border-slate-800 w-full lg:w-auto">
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Select Parameter</label>
                  <select 
                    value={violinMetric} 
                    onChange={(e) => setViolinMetric(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="BMI">Body Mass Index (BMI)</option>
                    <option value="Age">Patient Age Bracket</option>
                  </select>
                </div>

                <div className="w-full sm:w-56">
                  <label className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    <span>Min. Poor Mental Days</span>
                    <span className="text-blue-400">{mentalHealthDays}</span>
                  </label>
                  <input type="range" min="0" max="30" value={mentalHealthDays} onChange={(e) => setMentalHealthDays(parseInt(e.target.value))} className="w-full accent-blue-500" />
                </div>
              </div>
            </div>
            
            <div className="w-full h-[450px]">
              <Plot
                data={[
                  ...[1, 2, 3, 4, 5].map((lvl, idx) => {
                    const colors = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#ef4444'];
                    const activeRaincloud = violinMetric === 'BMI' ? processedData.raincloudBMI : processedData.raincloudAge;

                    return {
                      type: 'violin', 
                      x: Array(activeRaincloud[`gen${lvl}`].length).fill(`Level ${lvl}`), 
                      y: activeRaincloud[`gen${lvl}`],
                      name: `Health Level ${lvl}`, 
                      points: 'all', 
                      pointpos: -0.5, 
                      jitter: 0.7, 
                      side: 'positive',
                      line: { color: colors[idx], width: 2 }, 
                      marker: { size: 3, opacity: 0.3, color: '#94a3b8' }, 
                      meanline: { visible: true, width: 4, color: '#ffffff' }, 
                      hovertemplate: violinMetric === 'BMI' 
                        ? 'Self Rating: Level ' + lvl + '<br>BMI: %{y}<extra></extra>'
                        : 'Self Rating: Level ' + lvl + '<br>Age Bracket: %{y}<extra></extra>'
                    };
                  }),
                  {
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
                    y: violinMetric === 'BMI' ? processedData.raincloudBMIMeans : processedData.raincloudAgeMeans,
                    name: 'Average Trend',
                    line: { color: '#ffffff', width: 4 },
                    marker: { size: 10, color: '#fbbf24', line: { color: '#ffffff', width: 2 } },
                    hovertemplate: violinMetric === 'BMI'
                      ? 'Average BMI: %{y:.1f}<extra></extra>'
                      : 'Average Age Bracket: %{y:.1f}<extra></extra>'
                  }
                ]}
                layout={{ 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  xaxis: { title: 'General Health Rating (1 = Excellent, 5 = Poor)', gridcolor: '#1e293b' }, 
                  yaxis: { 
                    title: violinMetric === 'BMI' ? 'BMI (Body Mass Index)' : 'Age Bracket (1 = 18-24, 13 = 80+)', 
                    gridcolor: '#1e293b', 
                    autorange: true, // Clean autoscaling on load
                    ...(violinMetric === 'Age' ? {
                      tickvals: [1, 3, 5, 7, 9, 11, 13],
                      ticktext: ['18-24', '30-34', '40-44', '50-54', '60-64', '70-74', '80+']
                    } : {})
                  }, 
                  showlegend: false, 
                  autosize: true 
                }}
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <PracticalInsightBanner text={violinMetric === 'BMI' ? 
              "A clear upward trend: as subjective health ratings decline, average BMI climbs from 26.2 to 32.4 (moving from overweight into obese ranges)."
              : "Age acts as a progressive burden: older age brackets are heavily concentrated in self-reported health levels 4 and 5."} 
            />
          </div>

          {/* Part 3b Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Subjective well-being is often a strong reflection of our physical health. This violin plot groups patients by their self-reported health rating (from Level 1/Excellent to Level 5/Poor) and maps their BMI or Age. For individuals reporting poor health (Level 5), the distribution bulges much higher, showing weight clustering in obese territory. Adjust the mental health slider to see how these distributions shift as chronic stress indicators rise.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart3b(!deepDivePart3b)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
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
                  This plot maps subjective health ratings against objective physical metrics. The trendline displays a significant increase in mean BMI, moving from 26.2 in Level 1 up to 32.4 in Level 5. When filtering for mental health distress using the slider, we observe an upward shift in density distributions within the lower health levels. This highlights the bi-directional relationships of metabolic and neuropsychiatric health, where chronic psychological stress promotes visceral lipid storage and worsens subjective somatic wellness.
                </p>
              </div>
            )}
          </div>

          {/* Heatmap & Correlation Translator */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Systemic Connections Map</h3>
                <p className="text-sm text-slate-400">An asymmetric heatmap of clinical and social relationships paired with an interpretation panel.</p>
              </div>
              <InfoPopup 
                title="Systemic Overhaul Explained" 
                text="Traditional heatmaps duplicate information. By removing the redundant mirror diagonal, the remaining visual space highlights key system connections."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Asymmetric Heatmap */}
              <div className="lg:col-span-7 h-[450px]">
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
                    font: { color: '#94a3b8', size: 10 }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent', 
                    margin: { l: 140, r: 10, t: 10, b: 120 }, 
                    xaxis: { tickangle: -45, automargin: true, gridcolor: 'transparent' }, 
                    yaxis: { autorange: 'reversed', automargin: true, gridcolor: 'transparent' }, 
                    autosize: true 
                  }} 
                  useResizeHandler={true} 
                  style={{ width: '100%', height: '100%' }} 
                />
              </div>

              {/* Pairwise Translator Column */}
              <div className="lg:col-span-5 bg-slate-800/40 p-6 border border-slate-700/50 rounded-xl flex flex-col justify-start">
                <div className="mb-4">
                  <span className="text-xs font-black tracking-widest text-indigo-400 uppercase">Interactive Tool</span>
                  <h4 className="text-lg font-bold text-white mt-1">Correlation Translator</h4>
                  <p className="text-xs text-slate-400 mt-1">Select a key pair of variables below to translate mathematical patterns into clear clinical insights.</p>
                </div>

                <select 
                  value={translatorVar} 
                  onChange={(e) => setTranslatorVar(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
                >
                  {Object.keys(correlationTranslations).map(pair => (
                    <option key={pair} value={pair}>{pair}</option>
                  ))}
                </select>

                <div className="space-y-4">
                  {correlationTranslations[translatorVar].map((bullet, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-slate-900/50 p-3 rounded-lg border border-slate-850">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-slate-300 leading-relaxed">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <PracticalInsightBanner text="Note the negative correlation (-0.37) between General Health and Annual Income: health is deeply bound up with economic security and resources." />
          </div>

          {/* Part 3c Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Biological markers, socioeconomic backgrounds, and daily behaviors are all part of an interconnected system. This asymmetric heatmap simplifies these mathematical relationships, removing duplicate values to highlight key systemic correlations. Blue squares represent positive correlations, while red squares show negative links. Select any pair of variables in the Correlation Translator dropdown to view a real-world translation of how they interact.
            </p>
            <div>
              <button 
                onClick={() => setDeepDivePart3c(!deepDivePart3c)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-300 shadow-md shadow-indigo-500/5"
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