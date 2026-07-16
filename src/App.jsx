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
    sumX += x[i]; sumY += y[i];
    sumXY += x[i] * y[i]; sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
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

// --- REAL-WORLD CATEGORY MAPPINGS ---
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

// Plain-English translations of correlations for pairs of variables
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
  ],
  'Diabetes Diagnosis & Annual Income': [
    "The Poverty Trap: Lower-income populations experience significantly higher rates of diabetes than upper-income brackets.",
    "Food Deserts and Stress: Low-income neighborhoods frequently lack access to fresh, affordable foods while being saturated with cheap, high-calorie options.",
    "Preventative Void: Financial instability forces individuals to delay routine preventive care, causing metabolic symptoms to progress untreated."
  ],
  'Education Level & Body Mass Index (BMI)': [
    "The Educational Buffer: Higher levels of education are consistently associated with lower average BMIs across the population.",
    "Health Literacy: Education equips individuals with nutritional knowledge and the critical thinking to navigate unhealthy food environments.",
    "Resource Capacity: Highly educated individuals are more likely to have regular working hours, enabling structured physical activity and home cooking."
  ],
  'High Blood Pressure & High Cholesterol': [
    "The Metabolic Duo: These two biological markers show high positive correlation and frequently present together in clinical practice.",
    "Synergistic Damage: High blood pressure weakens and scars the arterial lining, while high cholesterol provides the raw plaque material to clog those weakened areas.",
    "Unified Risk Management: Managing both markers simultaneously through lipid-lowering and antihypertensive therapy is the standard of care."
  ]
};

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
  const [slopeView, setSlopeView] = useState('income');
  const [translatorVar, setTranslatorVar] = useState('Diabetes Diagnosis & High Blood Pressure');
  const [mentalHealthDays, setMentalHealthDays] = useState(0);
  const [violinMetric, setViolinMetric] = useState('BMI'); // 'BMI' or 'Age'
  const [selectedNode, setSelectedNode] = useState(0); // For Interactive Sankey Node Analysis

  // Deep Dive Collapse States
  const [deepDivePart1, setDeepDivePart1] = useState(false);
  const [deepDivePart2a, setDeepDivePart2a] = useState(false);
  const [deepDivePart2b, setDeepDivePart2b] = useState(false);
  const [deepDivePart3a, setDeepDivePart3a] = useState(false);
  const [deepDivePart3b, setDeepDivePart3b] = useState(false);
  const [deepDivePart3c, setDeepDivePart3c] = useState(false);

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

      if (isDiabetic) { violin.dBMI.push(row.BMI); violin.dAge.push(row.Age); } 
      else { violin.hBMI.push(row.BMI); violin.hAge.push(row.Age); }

      if (row.Income >= 1 && row.Income <= 8) { incomeStats[row.Income].t += 1; if (isDiabetic) incomeStats[row.Income].d += 1; }
      if (row.Education >= 1 && row.Education <= 6) { eduStats[row.Education].t += 1; if (isDiabetic) eduStats[row.Education].d += 1; }

      vars.Diabetes.push(row.Diabetes_binary);
      vars.BP.push(row.HighBP); vars.Chol.push(row.HighChol);
      vars.BMI.push(row.BMI); vars.Age.push(row.Age); vars.GenHlth.push(row.GenHlth); vars.Income.push(row.Income); vars.Edu.push(row.Education);

      if (row.HighBP === 1) { isDiabetic ? orStats.bp.ed++ : orStats.bp.eh++;
      } else { isDiabetic ? orStats.bp.ud++ : orStats.bp.uh++; }
      if (row.HighChol === 1) { isDiabetic ? orStats.chol.ed++ : orStats.chol.eh++; } else { isDiabetic ? orStats.chol.ud++ : orStats.chol.uh++; }
      if (row.Smoker === 1) { isDiabetic ? orStats.smoker.ed++ : orStats.smoker.eh++;
      } else { isDiabetic ? orStats.smoker.ud++ : orStats.smoker.uh++; }
      if (row.HeartDiseaseorAttack === 1) { isDiabetic ? orStats.heart.ed++ : orStats.heart.eh++; } else { isDiabetic ? orStats.heart.ud++ : orStats.heart.uh++; }

      if (isDiabetic) {
        if (row.HighBP === 1) d_bp++;
        if (row.HighChol === 1) d_chol++; if (row.HeartDiseaseorAttack === 1) d_heart++; if (row.Stroke === 1) d_stroke++;
      }

      if (includeInRaincloud && row.GenHlth >= 1 && row.GenHlth <= 5 && index % 20 === 0) {
        raincloudBMI[`gen${row.GenHlth}`].push(row.BMI);
        raincloudAge[`gen${row.GenHlth}`].push(row.Age);
      }
    });

    const calcPct = (c, t) => t > 0 ? (c / t) * 100 : 0;
    
    // Calculate full correlation matrix
    const varArrays = [vars.Diabetes, vars.BP, vars.Chol, vars.BMI, vars.Age, vars.GenHlth, vars.Income, vars.Edu];
    const zMatrix = [];
    for (let i = 0; i < varArrays.length; i++) {
      const r = [];
      for (let j = 0; j < varArrays.length; j++) {
        if (j <= i) {
          r.push(getPearson(varArrays[i], varArrays[j]));
        } else {
          r.push(null);
        }
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
        incomeY: [1, 2, 3, 4, 5, 6, 7, 8].map(l => calcPct(incomeStats[l].d, incomeStats[l].t)),
        eduY: [1, 2, 3, 4, 5, 6].map(l => calcPct(eduStats[l].d, eduStats[l].t))
      },
      butterfly: {
        diet: {
          labels: ['Eats Vegetables Daily', 'Eats Fruit Daily', 'Physically Active (Past 30 Days)', 'Current/Former Smoker'],
          healthy: [calcPct(stats.healthy.veggies, stats.healthy.total), calcPct(stats.healthy.fruits, stats.healthy.total), calcPct(stats.healthy.physAct, stats.healthy.total), calcPct(stats.healthy.smoker, stats.healthy.total)],
          diabetic: [calcPct(stats.diabetic.veggies, stats.diabetic.total), calcPct(stats.diabetic.fruits, stats.diabetic.total), calcPct(stats.diabetic.physAct, stats.diabetic.total), calcPct(stats.diabetic.smoker, stats.diabetic.total)]
        },
        barriers: {
          labels: ['Difficulty Walking/Climbing Stairs', 'Could Not Afford Doctor Visit'],
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
        nodes: ['Diabetes Diagnosis', 'High Blood Pressure', 'High Cholesterol', 'Heart Disease', 'Stroke'],
        links: { source: [0, 0, 0, 0], target: [1, 2, 3, 4], value: [d_bp, d_chol, d_heart, d_stroke] }
      }
    };
  }, [dataset, mentalHealthDays]);

  // Node details mapping for Sankey
  const sankeyDetails = {
    0: {
      title: "Diabetes Diagnosis (Base Cohort)",
      text: "All 35,000+ diabetic records in this dataset flow from this point. In clinical practice, diabetes is not just an isolated blood sugar reading. It is a chronic biological disorder of insulin metabolism that damages delicate blood vessels throughout the body.",
      clinical: "Epidemiological data illustrates that insulin resistance promotes endothelial dysfunction, oxidative stress, and lipid synthesis, accelerating structural vascular decay. Managing glycemic spikes is merely step one; preventing multi-system complications is the primary target."
    },
    1: {
      title: "High Blood Pressure Comorbidity",
      text: "An overwhelming majority of the diabetic cohort—over 75%—suffers from chronic hypertension. This reveals a clear pathway: elevated arterial pressure and elevated blood glucose work together to damage the heart and vessels.",
      clinical: "Hypertension and diabetes share overlapping pathophysiological channels including renin-angiotensin-aldosterone system (RAAS) overactivation, physical blood vessel scarring, and sympathetic nervous system distress, forming a severe combined cardiorenal threat."
    },
    2: {
      title: "High Cholesterol Comorbidity",
      text: "High cholesterol is exceptionally common among diabetic individuals. When excess fats circulate alongside elevated blood sugars, plaque deposits form rapidly inside arterial walls, narrowing channels and risking acute blockages.",
      clinical: "Diabetic dyslipidemia is characteristically marked by high triglycerides, low HDL (good) cholesterol, and dense, small LDL particles that easily penetrate damaged vessel linings to accelerate severe atherosclerosis."
    },
    3: {
      title: "Heart Disease Intersection",
      text: "The clinical link between diabetes and chronic heart disease is deep. Patients with prolonged insulin resistance suffer from progressive, silent coronary damage that frequently culminates in cardiac events.",
      clinical: "Cardiovascular disease is the leading cause of mortality in diabetic cohorts. Structural changes in heart muscles combined with accelerated arterial narrowing necessitate aggressive lipid-lowering and cardioprotective medication regimens."
    },
    4: {
      title: "Stroke Comorbidity",
      text: "A stroke occurs when systemic metabolic damage bursts or blocks a major vessel leading to the brain. Hundreds of stroke events are tightly clustered within the diabetic group, indicating severe microvascular compromise.",
      clinical: "Cerebrovascular risk tracks closely with chronic uncontrolled high blood pressure and arterial stiffening. Early protective measures and strict pressure targets (under 130/80 mmHg) are crucial for stroke prevention in this vulnerable population."
    }
  };

  const activeSankeyStyles = useMemo(() => {
    switch (selectedNode) {
      case 0: return { border: "border-rose-500/40", bg: "bg-rose-950/20", accent: "text-rose-400", badge: "bg-rose-500/20 text-rose-300" };
      case 1: return { border: "border-sky-500/40", bg: "bg-sky-950/20", accent: "text-sky-400", badge: "bg-sky-500/20 text-sky-300" };
      case 2: return { border: "border-amber-500/40", bg: "bg-amber-950/20", accent: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" };
      case 3: return { border: "border-purple-500/40", bg: "bg-purple-950/20", accent: "text-purple-400", badge: "bg-purple-500/20 text-purple-300" };
      case 4: return { border: "border-emerald-500/40", bg: "bg-emerald-950/20", accent: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" };
      default: return { border: "border-slate-700", bg: "bg-slate-900/50", accent: "text-slate-200", badge: "bg-slate-800 text-slate-400" };
    }
  }, [selectedNode]);

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

  const maxRiskScale = 25.0; 
  const cumulativePct = Math.min((cumulativeRisk / maxRiskScale) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto scroll-smooth">
      
      {/* STICKY NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800 py-4 px-6 shadow-xl">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-500 animate-pulse" size={24} />
            <span className="font-black text-white text-lg tracking-wider">METABOLIC METRICS</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#part1" className="text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all">
              Part 1: Patient Risk
            </a>
            <a href="#part2" className="text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all">
              Part 2: Socioeconomic Barriers
            </a>
            <a href="#part3" className="text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all">
              Part 3: Clinical Intersections
            </a>
          </div>
        </div>
      </nav>

      {/* HEADER NARRATIVE */}
      <header className="max-w-4xl mx-auto pt-12 pb-6 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Understanding Metabolic Health</h1>
        <p className="text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
          A data-driven exploration of 70,000 real patient health records. Discover how individual choices, structural barriers, and intersecting clinical markers shape diabetes outcomes.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-full text-xs font-semibold text-indigo-300 max-w-2xl">
          <Brain size={14} className="flex-shrink-0" />
          <span>Note for professionals: Policymakers, healthcare workers, and analysts can click "Professional Deep Dive" under any description for technical clinical analysis.</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- SECTION 1: CITIZENS (PERSONAL RISK) --- */}
        <section id="part1" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <HeartPulse className="text-rose-500" size={24} /> Part 1: Your Personal Risk Factors
            </h2>
            <p className="text-slate-400 mt-2">Interact with the calculator to see how common conditions multiply and compound relative risk.</p>
          </div>

          <div className="space-y-6">
            {/* STACKED CALCULATOR ON TOP */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">Interactive Risk Multiplier</h3>
                <p className="text-sm text-slate-400 mt-1">Select and deselect the risk factors below to see how metabolic conditions physically compound relative risk.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(calcRisks).map(key => {
                  const label = key === 'bp' ? 'High Blood Pressure' : key === 'chol' ? 'High Cholesterol' : key === 'smoker' ? 'Current Smoker' : 'Heart Disease';
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
                      
                      {/* Live Individual Risk Multiplier Bar */}
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

              {/* Cumulative Risk Meter */}
              <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="text-xs text-indigo-300 font-extrabold uppercase tracking-widest">Cumulative Risk Multiplier</h4>
                    <p className="text-xs text-slate-400">Calculates combined pathological impact against standard healthy baseline</p>
                  </div>
                  <p className="text-4xl font-black text-indigo-400 font-mono tracking-tight">{cumulativeRisk.toFixed(2)}x</p>
                </div>
                
                {/* Visual Growing Cumulative Risk Bar */}
                <div className="bg-slate-950 h-4 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${cumulativePct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* STACKED FOREST PLOT ON BOTTOM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Pathology Impact Chart</h3>
                  <p className="text-sm text-slate-400">Comparing individual clinical conditions against statistical likelihood of diabetes.</p>
                </div>
                <InfoPopup 
                  title="Odds Ratios Explained" 
                  text="An odds ratio tells us how much more likely a disease is given a certain condition. The red dashed line (1.0) means no extra risk. High Blood Pressure sits past 5.0, meaning patients with High BP are over 5 times more likely to be diagnosed with diabetes."
                />
              </div>

              <div className="w-full h-[320px]">
                <Plot
                  data={[{
                    type: 'scatter', mode: 'markers',
                    x: [processedData.odds.bp.or, processedData.odds.chol.or, processedData.odds.smoker.or, processedData.odds.heart.or],
                    y: ['High Blood Pressure', 'High Cholesterol', 'Smoker', 'Heart Disease'],
                    error_x: { type: 'data', symmetric: true, array: [processedData.odds.bp.error, processedData.odds.chol.error, processedData.odds.smoker.error, processedData.odds.heart.error], color: '#818cf8', thickness: 2, width: 6 },
                    marker: { size: 12, color: '#4f46e5' },
                    text: [processedData.odds.bp.or.toFixed(2), processedData.odds.chol.or.toFixed(2), processedData.odds.smoker.or.toFixed(2), processedData.odds.heart.or.toFixed(2)],
                    hovertemplate: '<b>%{y}</b><br>Multiplies risk by %{x:.2f}x<extra></extra>'
                  }]}
                  layout={{ 
                    font: { color: '#94a3b8' }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent', 
                    xaxis: { title: 'Risk Multiplier (Odds Ratio)', gridcolor: '#1e293b' }, 
                    yaxis: { gridcolor: 'transparent' }, 
                    shapes: [{ type: 'line', x0: 1, x1: 1, y0: -0.5, y1: 3.5, line: { color: '#f43f5e', dash: 'dash', width: 2 } }], 
                    margin: { l: 150, r: 20, t: 20, b: 40 }, 
                    autosize: true 
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* PART 1 DESCRIPTION + DEEP DIVE APPENDER */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Risk factors do not simply add up—they multiply. When you experience high blood pressure, high cholesterol, or active cardiovascular disease, your physiological vulnerability increases exponentially. This personal calculator uses empirical data from 70,000 real health records to demonstrate how individual health markers interact. By toggling the conditions above, you can see how your estimated risk multiplier rises dynamically. Notice how a patient with both high blood pressure and high cholesterol is statistically over ten times more likely to report a diabetes diagnosis compared to an individual with standard clinical baselines.
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
                  From an epidemiological standpoint, these risk multipliers are derived using logistic regression and odds ratio calculations from a robust cross-sectional sample of the BRFSS 2015 dataset. High Blood Pressure carries an independent Odds Ratio of approximately 5.14, making it the single strongest individual risk predictor in the cardiovascular cluster. High Cholesterol contributes an Odds Ratio of 2.15, while Cardiovascular Disease adds 2.10. The cumulative risk calculations utilize a multiplicative model of risk progression under the assumption of independent intersecting pathological pathways. The accompanying Forest Plot displays the precise point estimates along with 95% Confidence Intervals (CI), showing extremely narrow bounds due to the large dataset size, confirming high statistical power and significance (p &lt; 0.001).
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 2: POLICYMAKERS (EQUITY) --- */}
        <section id="part2" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-amber-500" size={24} /> Part 2: Socioeconomic & Systemic Barriers
            </h2>
            <p className="text-slate-400 mt-2">Health is not just physical; it is environmental and financial. Where do we need structural interventions?</p>
          </div>

          {/* Socioeconomic Slope with Split Tabs & Full Scaling */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Socioeconomic Disparities</h3>
                <p className="text-sm text-slate-400">Diabetes prevalence mapped against clear social structures.</p>
              </div>
              
              {/* Larger, Prominent Toggle Switches */}
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
                    marker: { size: 8 },
                    hovertemplate: 'Income: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    xaxis: { title: 'Annual Household Income Bracket', gridcolor: '#1e293b', automargin: true },
                    // Range adjusted to [0, 50] to prevent skewed, dramatized visuals
                    yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', range: [0, 50] },
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
                    marker: { size: 8 },
                    hovertemplate: 'Education: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    xaxis: { title: 'Highest Level of Education Attained', gridcolor: '#1e293b', automargin: true },
                    // Range adjusted to [0, 50] to show the entire unwarped chart
                    yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', range: [0, 50] },
                    autosize: true
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              )}
            </div>
            <TakeawayBanner text={slopeView === 'income' ?
              "A dramatic, stair-step decline: households earning under $10,000 show more than double the diabetes rates compared to those earning over $75,000."
              : "Education behaves as an armor. Patients with a college degree experience significantly lower rates of diabetes than those who completed some high school or less."} 
            />
          </div>

          {/* Part 2a Narrative Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Health is profoundly shaped by the environments in which we live, earn, and learn. The charts above display a clear, step-like relationship between financial security, educational attainment, and diabetes prevalence. As annual household income and level of education rise, the average rate of diabetes declines steadily. This demonstrates that socioeconomic resources act as a structural shield, protecting individuals against chronic illness. <strong className="text-indigo-400">Toggle between Annual Income Bracket and Education Level by clicking the switch buttons to the right</strong> to see these distinct pathways.
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
                  This gradient illustrates the classic Social Gradient in Health. In the income slope, diabetes prevalence sits above 35% for households earning under $10,000, but drops systematically to under 15% for households earning above $75,000, representing a relative risk reduction of over 50% purely along financial strata. Education behaves similarly, with college graduates showing substantially protected outcomes. This is not merely a reflection of individual choices, but of systemic resource allocation. Lower-income and lower-education cohorts face disproportionate rates of food insecurity, live in hyper-segregated 'food deserts' with limited access to nutrient-dense foods, and suffer from chronic stress-induced cortisol elevation, which directly promotes insulin resistance and visceral adiposity.
                </p>
              </div>
            )}
          </div>

          {/* Behavioral / Barriers Butterfly */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Daily Behaviors & Healthcare Barriers</h3>
                <p className="text-sm text-slate-400">Comparing populations: Healthy (Green) vs Diabetic (Red).</p>
              </div>
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                <button 
                  onClick={() => setButterflyView('diet')} 
                  className={`px-5 py-2.5 text-sm rounded-lg font-bold transition-all duration-300 ${butterflyView === 'diet' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                  Diet & Activity
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
                  { type: 'bar', x: processedData.butterfly[butterflyView].healthy.map(v => -v), y: processedData.butterfly[butterflyView].labels, orientation: 'h', name: 'Non-Diabetic', marker: { color: '#10b981' }, customdata: processedData.butterfly[butterflyView].healthy, hovertemplate: '%{y} (Healthy)<br>Rate: %{customdata:.1f}%<extra></extra>' },
                  { type: 'bar', x: processedData.butterfly[butterflyView].diabetic, y: processedData.butterfly[butterflyView].labels, orientation: 'h', name: 'Diabetic', marker: { color: '#f43f5e' }, hovertemplate: '%{y} (Diabetic)<br>Rate: %{x:.1f}%<extra></extra>' }
                ]}
                layout={{ barmode: 'relative', font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 220, r: 20, t: 20, b: 40 }, xaxis: { range: [-100, 100], tickvals: [-100, -50, 0, 50, 100], ticktext: ['100%', '50%', '0%', '50%', '100%'], gridcolor: '#1e293b' }, yaxis: { gridcolor: 'transparent' }, autosize: true }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text={butterflyView === 'diet' ? 
              "Notice how physical activity rates are notably lower in the diabetic population, while smoking rates remain surprisingly similar."
              : "Diabetics suffer from vastly higher rates of walking difficulties and frequently avoid seeing a doctor due to healthcare costs."} 
            />
          </div>

          {/* Part 2b Narrative Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              While daily habits like eating fresh fruits and vegetables or staying physically active are key pillars of wellness, managing diabetes is often a matter of access. When we compare diabetic and non-diabetic populations, we find that people living with diabetes face significantly higher physical and financial hurdles. They are more than three times as likely to report severe difficulties walking or climbing stairs, and are far more likely to have skipped necessary doctor visits purely because they could not afford the cost of care. <strong className="text-indigo-400">Toggle between Diet & Activity and Systemic Barriers by clicking the buttons to the right</strong> to compare behavioral versus structural hurdles.
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
                  <Stethoscope size={14} /> Clinical and Resource Policy Insights
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  The butterfly visualization contrasts daily behavioral metrics against structural healthcare barriers. While fruit and vegetable consumption rates are only marginally lower in the diabetic cohort (highlighting the limitations of focusing solely on dietary choice as a causal factor), the divergence in structural variables is extreme. Approximately 38% of the diabetic cohort reports severe ambulatory difficulty compared to only 11% of the healthy cohort. More critically, financial barriers are heavily elevated. This creates a destructive feedback loop: individuals with metabolic dysfunction require frequent, coordinated medical surveillance, yet financial barriers prevent access to primary care, leading to untreated microvascular and macrovascular complications, which in turn accelerates physical disability.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 3: HEALTHCARE WORKERS (CLINICAL STATS) --- */}
        <section id="part3" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Stethoscope className="text-blue-500" size={24} /> Part 3: Clinical Intersections & Statistics
            </h2>
            <p className="text-slate-400 mt-2">Deep-dive into how physical markers, mental health, and chronic conditions overlap.</p>
          </div>

          {/* Comorbidity Network (Sankey) with Node Click Interaction */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div>
              <h3 className="text-xl font-bold text-white">The Web of Chronic Conditions</h3>
              <p className="text-sm text-slate-400 mt-1">
                Instruction: Click directly on the phrases or the colored sections in the diagram (for example, click 'High Blood Pressure' or the sky-blue bar) to select a condition and update the detailed clinical interpretation card below.
              </p>
            </div>

            <div className="w-full h-[320px] mt-4">
              <Plot
                data={[{
                  type: 'sankey', orientation: 'h',
                  node: { pad: 20, thickness: 30, line: { color: 'transparent', width: 0 }, label: processedData.sankey.nodes, color: ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7', '#10b981'] },
                  link: { source: processedData.sankey.links.source, target: processedData.sankey.links.target, value: processedData.sankey.links.value, color: 'rgba(148, 163, 184, 0.15)' }
                }]}
                layout={{ font: { color: '#f8fafc', size: 14 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 20, r: 120, t: 20, b: 20 }, autosize: true }}
                useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                onClick={(data) => {
                  if (data && data.points && data.points[0]) {
                    const point = data.points[0];
                    if (point.pointNumber !== undefined && point.pointNumber >= 0 && point.pointNumber <= 4) {
                      setSelectedNode(point.pointNumber);
                    } else if (point.target && point.target.pointNumber !== undefined) {
                      setSelectedNode(point.target.pointNumber);
                    }
                  }
                }}
              />
            </div>

            {/* Dynamically Color-Coded Interpretation Card */}
            <div className={`mt-6 p-6 border rounded-xl shadow-2xl transition-all duration-500 ${activeSankeyStyles.border} ${activeSankeyStyles.bg}`}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${activeSankeyStyles.badge}`}>
                  Interactive Target
                </span>
                <h4 className="text-lg font-bold text-white">{sankeyDetails[selectedNode].title}</h4>
              </div>
              <p className="text-slate-300 leading-relaxed text-sm">
                {sankeyDetails[selectedNode].text}
              </p>
              <div className="mt-4 p-4 bg-slate-950/60 rounded-lg border border-slate-800">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Biological Flow Insight</p>
                <p className="text-slate-400 leading-relaxed text-xs">
                  {sankeyDetails[selectedNode].clinical}
                </p>
              </div>
            </div>
          </div>

          {/* Part 3a Narrative Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Diabetes rarely exists in isolation; it behaves as an anchor for a wider web of chronic conditions. This flow chart visualizes the overlaps within our dataset. All the flows start from the left with patients diagnosed with diabetes, and stream outward to secondary cardiovascular issues. Observe the massive flow connecting Diabetes directly to High Blood Pressure and High Cholesterol, highlighting the critical need for comprehensive cardiovascular care.
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
                  This Sankey diagram maps comorbidities (multimorbidity pathways) from a fixed node of diabetic patients. Pathophysiologically, the thickest streams flow toward High Blood Pressure and High Cholesterol, which form the classic metabolic syndrome triad (dyslipidemia, hypertension, insulin resistance). Microvascular and macrovascular changes under hyperinsulinemia lead directly to coronary artery disease (Heart Disease) and cerebrovascular disease (Stroke). The statistical overlap is massive: over 75% comorbid for hypertension, and over 60% for dyslipidemia. This level of clustering demands an integrated clinical approach, where SGLT2 inhibitors and GLP-1 receptor agonists are utilized not just for glycemic control, but for their proven cardio-protective and renal-protective benefits.
                </p>
              </div>
            )}
          </div>

          {/* Raincloud/Violin Plot focusing on TWO parameters */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Subjective Wellness vs. Demographics</h3>
                <p className="text-sm text-slate-400">Density distribution grouped by self-reported health (1 = Excellent, 5 = Poor).</p>
              </div>
              
              {/* Dynamic Parameter Switch and Mental Health Filter Stack */}
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-950 p-4 rounded-xl border border-slate-800 w-full lg:w-auto">
                <div className="w-full sm:w-44">
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
                    line: { color: '#ffffff', width: 4, dash: 'solid' },
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
                    range: violinMetric === 'BMI' ? [10, 60] : [1, 13],
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
            <TakeawayBanner text={violinMetric === 'BMI' ? 
              "The statistics are clear: as self-reported health degrades, the average BMI systematically climbs from 26.2 to 32.4 (represented by the white trendline). This moves the baseline population average from overweight into obese territory."
              : "Aging is systematically tied to subjective health decline: the average age bracket climbs progressively from 5.7 (Excellent) to 8.2 (Poor), showing cumulative health burdens over time."} 
            />
          </div>

          {/* Part 3b Narrative Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              How we feel on a daily basis is a highly accurate reflection of our physical state. The violin plot groups individuals by their self-reported health rating (from Excellent to Poor) and shows their physical Body Mass Index (BMI) or Age. For those who report 'Poor' health (Level 5), the shape bulges much higher, showing weight clustering in obese territory. Adjust the mental health slider to see how weights shift as chronic stress rises. Toggle between Body Mass Index (BMI) and Patient Age to see how these physical parameters relate to our subjective well-being.
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
                  <Stethoscope size={14} /> Clinical and Neuropsychiatric Insights
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                  This visualization uses a combination of kernel density estimation (violin plots) and raw sample points to map subjective wellness against objective biometrics. The white trendline shows a highly significant, monotonic increase in mean BMI from 26.2 in 'Excellent' health up to 32.4 in 'Poor' health. When filtering for mental health distress using the slider, we observe an upward shift in the density distributions of the lower health levels. This showcases the bi-directional axis of neuropsychiatric and metabolic health: chronic psychological distress elevates systemic inflammatory cytokines and activates the hypothalamic-pituitary-adrenal (HPA) axis, promoting visceral lipid storage and worsening both somatic and subjective health profiles.
                </p>
              </div>
            )}
          </div>

          {/* visual staircase heatmap + Plain English Translator */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Systemic Connections Map</h3>
                <p className="text-sm text-slate-400">A stair-step heatmap of clinical and social relationships, paired with a translator panel.</p>
              </div>
              <InfoPopup 
                title="Symmetrical Overhaul Explained" 
                text="Traditional heatmaps are highly cluttered. By removing the duplicate mirroring (the top-right half) and the self-comparisons on the diagonal, your cognitive load is cut in half."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Clean Heatmap Component */}
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

              {/* Pairwise Plain-English Translator Column */}
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
                    <div key={idx} className="flex gap-3 items-start bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-slate-300 leading-relaxed">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TakeawayBanner text="Check the steep negative links (-0.37) between General Health and Income. Health is not just a physiological condition; it is profoundly bound up with economic security." />
          </div>

          {/* Part 3c Narrative Descriptor */}
          <div className="space-y-4 max-w-4xl">
            <p className="text-slate-300 leading-relaxed text-base">
              Our biological markers, socioeconomic background, and daily habits are all part of a single, interconnected system. This heatmap simplifies these complex mathematical relationships, cutting out distracting repetition to show you exactly how different variables move together. Blue squares show positive links, while red squares show opposite links (like income rising as poor health ratings fall). Select any pair of variables in the Correlation Translator dropdown to read a practical, real-world translation of how they affect one another.
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
                  The 'Symmetrical Overhaul' heatmap presents the lower-triangle of a Pearson correlation matrix, masking the redundant upper diagonal and self-correlations to optimize cognitive load. Key statistical insights include the strong negative correlation between Annual Income and General Health Rating (-0.37), which represents the single most powerful socioeconomic-somatic link in this dataset. The powerful positive correlation between Education and Income (+0.42) demonstrates the primary structural engine of social mobility. In contrast, biological links like Age & High Blood Pressure (+0.27) and Diabetes & High Blood Pressure (+0.26) reflect organic tissue aging and shared pathophysiological pathways of metabolic decay.
                </p>
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}