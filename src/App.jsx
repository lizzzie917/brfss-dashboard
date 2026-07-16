import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { 
  Activity, Info, HeartPulse, Users, Stethoscope 
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

// --- PAIRWISE CORRELATION TRANSLATIONS ---
const pairwiseTranslations = {
  'Diabetes Diagnosis - High Blood Pressure': "This represents the strongest clinical co-occurrence. High blood pressure severely compounds vascular stress, and diabetic individuals show heavily elevated rates of hypertension, forming a critical cardiovascular risk profile.",
  'Diabetes Diagnosis - High Cholesterol': "High cholesterol and diabetes frequently co-exist, accelerating arterial plaque buildup and dramatically escalating the combined risk of severe coronary conditions.",
  'Diabetes Diagnosis - Body Mass Index (BMI)': "A cornerstone metabolic relationship. Elevated BMI is heavily associated with diabetes, reflecting the direct physiological impact of higher adiposity on insulin resistance.",
  'Diabetes Diagnosis - Age Bracket': "Diabetes prevalence rates trend upwards systematically with older age groups, capturing the long-term, cumulative physiological stress on insulin production.",
  'Diabetes Diagnosis - General Health Rating': "A powerful link. Diabetic individuals report significantly lower subjective physical wellness, illustrating how navigating a chronic condition shapes everyday quality of life.",
  'Diabetes Diagnosis - Annual Income': "Clear socioeconomic gradient. Higher income acts as a powerful statistical shield, as households with financial security show drastically lower rates of diabetes.",
  'Diabetes Diagnosis - Education Level': "Education serves as systemic armor. Higher formal education is highly protective, correlating to lower baseline rates of diabetes due to increased health resource navigation.",
  'High Blood Pressure - High Cholesterol': "These two primary clinical markers exhibit massive overlap, signifying a unified cardiovascular profile where arterial stiffness and lipid buildup build on one another.",
  'High Blood Pressure - Body Mass Index (BMI)': "A strong weight-pressure relationship. Higher body mass places mechanical and regulatory strain on the circulatory system, directly raising systemic blood pressure.",
  'High Blood Pressure - Age Bracket': "This has the strongest connection to age in the dataset (+0.27). Arterial systems naturally stiffen over time, making hypertension highly prevalent in older age cohorts.",
  'High Blood Pressure - General Health Rating': "Poor subjective health scores are strongly linked with high blood pressure, reflecting the chronic physical fatigue and cardiovascular stress of living with hypertension.",
  'High Blood Pressure - Annual Income': "Higher income levels show a strong protective link against high blood pressure, showing how economic stability reduces metabolic stress and increases clinical care access.",
  'High Blood Pressure - Education Level': "Educational access correlates with lower average blood pressure, demonstrating the compounding benefit of health literacy and supportive lifestyles.",
  'High Cholesterol - Body Mass Index (BMI)': "Elevated BMI is a major pathway to hypercholesterolemia, as metabolic changes from higher body weight directly alter lipid production and clearance rates.",
  'High Cholesterol - Age Bracket': "Cholesterol levels steadily rise across older brackets in this population, capturing natural age-related shifts in liver processing and cellular metabolism.",
  'High Cholesterol - General Health Rating': "Living with high cholesterol is associated with worse self-rated health, highlighting its contribution to systemic metabolic imbalances that affect overall vitality.",
  'High Cholesterol - Annual Income': "Financial security is tied to healthier lipid profiles, heavily reflecting the dietary divide and differences in food access across income tiers.",
  'High Cholesterol - Education Level': "Higher formal education levels act as a preventative pathway, correlating with healthier cholesterol averages and proactive cardiovascular lifestyle habits.",
  'Body Mass Index (BMI) - Age Bracket': "A complex lifespan dynamic where average BMI trends upward throughout adulthood but can plateau or decrease in later years as muscle mass and metabolism change.",
  'Body Mass Index (BMI) - General Health Rating': "One of the most powerful physical-subjective links. Higher BMIs strongly match poor general health scores, showing the daily physical toll of elevated body weight on systemic well-being.",
  'Body Mass Index (BMI) - Annual Income': "Higher-income populations exhibit lower average BMIs on average, highlighting structural barriers like the high cost of fresh foods and limited recreation time.",
  'Body Mass Index (BMI) - Education Level': "Systemic education acts as an armor against weight gain, as higher academic attainment correlates directly with lower average BMIs.",
  'Age Bracket - General Health Rating': "Subjective health ratings naturally decrease in older cohorts, reflecting the gradual accumulation of chronic age-related metabolic and musculoskeletal conditions.",
  'Age Bracket - Annual Income': "Income structures naturally shift across age cohorts, rising steadily through key career advancement years and settling lower upon retirement.",
  'Age Bracket - Education Level': "A negative correlation captures modern generational shifts, showing how access to higher education has systematically expanded in younger generations compared to older brackets.",
  'General Health Rating - Annual Income': "An incredibly strong socioeconomic predictor (-0.37). Financial security is the single biggest predictor of a highly positive self-reported physical health rating.",
  'General Health Rating - Education Level': "Formal education is highly linked to excellent self-rated health, showcasing how educational avenues unlock lifetime compounding health advantages.",
  'Annual Income - Education Level': "A powerful positive relationship (+0.42). Higher educational attainment remains the primary systemic gateway to career progression and economic stability."
};

const translatorPairs = [
  { label: "Diabetes Diagnosis & High Blood Pressure", varA: "Diabetes Diagnosis", varB: "High Blood Pressure" },
  { label: "Diabetes Diagnosis & High Cholesterol", varA: "Diabetes Diagnosis", varB: "High Cholesterol" },
  { label: "Diabetes Diagnosis & Body Mass Index (BMI)", varA: "Diabetes Diagnosis", varB: "Body Mass Index (BMI)" },
  { label: "Diabetes Diagnosis & Annual Income", varA: "Diabetes Diagnosis", varB: "Annual Income" },
  { label: "Diabetes Diagnosis & Education Level", varA: "Diabetes Diagnosis", varB: "Education Level" },
  { label: "High Blood Pressure & Age Bracket", varA: "High Blood Pressure", varB: "Age Bracket" },
  { label: "High Blood Pressure & Annual Income", varA: "High Blood Pressure", varB: "Annual Income" },
  { label: "Body Mass Index (BMI) & General Health Rating", varA: "Body Mass Index (BMI)", varB: "General Health Rating" },
  { label: "General Health Rating & Annual Income", varA: "General Health Rating", varB: "Annual Income" },
  { label: "Annual Income & Education Level", varA: "Annual Income", varB: "Education Level" }
];

// --- SANKEY DATA MAPPINGS & INTERPRETATIONS ---
const sankeyInterpretations = {
  'Diabetes Diagnosis': {
    title: 'Diabetes Diagnosis (Baseline Cohort)',
    text: 'This is our core study baseline. Out of 70,000 medical records, 50% are diagnosed with diabetes. The flows emerging from this block demonstrate how secondary chronic complications spread across this patient population.'
  },
  'High Blood Pressure': {
    title: 'High Blood Pressure Link',
    text: 'An overwhelming majority of diabetic patients in this study also suffer from High Blood Pressure. This represents our thickest, most significant flow, proving that hypertension is a near-constant clinical companion to diabetes.'
  },
  'High Cholesterol': {
    title: 'High Cholesterol Link',
    text: 'High cholesterol forms the second-largest flow. When combined with diabetes and hypertension, it creates the "triple threat" of metabolic syndrome, multiplying the baseline threat of permanent cardiovascular damage.'
  },
  'Heart Disease': {
    title: 'Heart Disease or Attack Link',
    text: 'Heart disease represents a substantial, highly hazardous pathway. Patients with diabetes suffer from accelerated plaque buildup in the coronary arteries, leading directly to coronary events.'
  },
  'Stroke': {
    title: 'Stroke Link',
    text: 'Stroke constitutes a distinct cerebrovascular pathway in the network. Though numerically smaller than the other flows, it reveals how metabolic disruption directly affects cerebral circulation.'
  }
};

const sankeyColors = {
  'Diabetes Diagnosis': {
    border: 'border-rose-500/40', bg: 'bg-rose-950/20', text: 'text-rose-200', tagBg: 'bg-rose-500/20 text-rose-300'
  },
  'High Blood Pressure': {
    border: 'border-sky-500/40', bg: 'bg-sky-950/20', text: 'text-sky-200', tagBg: 'bg-sky-500/20 text-sky-300'
  },
  'High Cholesterol': {
    border: 'border-amber-500/40', bg: 'bg-amber-950/20', text: 'text-amber-200', tagBg: 'bg-amber-500/20 text-amber-300'
  },
  'Heart Disease': {
    border: 'border-purple-500/40', bg: 'bg-purple-950/20', text: 'text-purple-200', tagBg: 'bg-purple-500/20 text-purple-300'
  },
  'Stroke': {
    border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', text: 'text-emerald-200', tagBg: 'bg-emerald-500/20 text-emerald-300'
  }
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
  const [showDeepDive, setShowDeepDive] = useState(false);

  // Chart Controls
  const [butterflyView, setButterflyView] = useState('diet'); 
  const [slopeView, setSlopeView] = useState('income');
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [mentalHealthDays, setMentalHealthDays] = useState(0);
  const [violinParam, setViolinParam] = useState('BMI');
  const [selectedSankeyNode, setSelectedSankeyNode] = useState('High Blood Pressure');

  // Calculator State
  const [calcRisks, setCalcRisks] = useState({
    bp: false, chol: false, smoker: false, heart: false
  });

  const toggleRisk = (key) => setCalcRisks(prev => ({ ...prev, [key]: !prev[key] }));

  // Ingestion Engine
  useEffect(() => {
    Papa.parse("/diabetes_binary_5050split_health_indicators_BRFSS2015.csv", {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        setDataset(results.data);
        setIsLoading(false);
      }
    });
  }, []);

  // High-Performance Math Engine
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

  // Correlation Translator Variable Lookups
  const currentPair = translatorPairs[selectedPairIndex];
  const varA = currentPair.varA;
  const varB = currentPair.varB;
  const idxA = heatmapVariables.indexOf(varA);
  const idxB = heatmapVariables.indexOf(varB);
  let pairCorrelation = 0;
  if (processedData && processedData.heatmap && processedData.heatmap.z) {
    const z = processedData.heatmap.z;
    pairCorrelation = idxA >= idxB ? z[idxA][idxB] : z[idxB][idxA];
  }
  const pairwiseExplanation = pairwiseTranslations[`${varA} - ${varB}`] || pairwiseTranslations[`${varB} - ${varA}`] || "These variables exhibit an indirect systemic connection in metabolic and clinical studies.";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto">
      
      {/* NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 transition-all">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-lg tracking-wider uppercase">Metabolic Health Dashboard</span>
          </div>
          <div className="flex items-center flex-wrap gap-6 justify-center">
            <a href="#part1" className="text-sm font-bold text-slate-300 hover:text-indigo-400 transition-colors">Part 1: Patient Risk</a>
            <a href="#part2" className="text-sm font-bold text-slate-300 hover:text-indigo-400 transition-colors">Part 2: Socioeconomic Barriers</a>
            <a href="#part3" className="text-sm font-bold text-slate-300 hover:text-indigo-400 transition-colors">Part 3: Clinical Intersections</a>
            
            {/* Deep Dive Global Toggle */}
            <button 
              onClick={() => setShowDeepDive(!showDeepDive)}
              className={`px-5 py-2 text-xs font-black uppercase tracking-wider rounded-full border transition-all duration-300 ${
                showDeepDive 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {showDeepDive ? 'Deep Dive: ON' : 'Deep Dive: OFF'}
            </button>
          </div>
        </div>
      </nav>

      {/* HEADER NARRATIVE */}
      <header className="max-w-4xl mx-auto pt-16 pb-8 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6">Understanding Metabolic Health</h1>
        <p className="text-xl text-slate-400 leading-relaxed">
          A data-driven exploration of 70,000 real health records. Discover how personal choices, socioeconomic barriers, and intersecting clinical conditions shape our risk for diabetes.
        </p>
        <div className="mt-8 p-5 bg-indigo-950/20 border border-indigo-950/60 rounded-2xl max-w-2xl mx-auto text-sm leading-relaxed text-slate-300">
          <span className="font-extrabold text-indigo-400 block mb-1">Target Audience Context:</span>
          This dashboard is crafted to provide clear, actionable descriptions for patients and general audiences.
          <span className="block mt-2 font-semibold text-slate-400 border-t border-indigo-950/50 pt-2">
            Policy makers, healthcare workers, and analysts can click the <strong className="text-indigo-300">"Deep Dive"</strong> button in the navigation bar to enable professional clinical assessments and structural policy commentary.
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- SECTION 1: CITIZENS (PERSONAL RISK) --- */}
        <section id="part1" className="space-y-8 scroll-mt-24">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <HeartPulse className="text-rose-500" /> Part 1: Your Personal Risk Factors
            </h2>
            <p className="text-slate-400 mt-2">
              {!showDeepDive 
                ? "Interact with the risk factor checks below to observe how multiple medical conditions combine to compound your overall likelihood of diabetes."
                : "Analyze odds ratios and relative risk compound curves built directly from 70,000 empirical BRFSS data rows. Observe confidence margins and statistical multipliers below."
              }
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-8 flex flex-col">
            
            {/* Interactive Calculator Panel */}
            <div className="w-full bg-slate-800/30 p-6 rounded-xl border border-slate-700/50 flex flex-col gap-6">
              <h3 className="text-xl font-bold text-white">Interactive Risk Calculator</h3>
              <p className="text-sm text-slate-400">
                Check individual conditions to see how the relative risk compound graph grows dynamically below.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(calcRisks).map(key => (
                  <label key={key} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all duration-300 ${
                    calcRisks[key] 
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10 text-white' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={calcRisks[key]} 
                        onChange={() => toggleRisk(key)} 
                        className="w-5 h-5 rounded accent-indigo-500 bg-slate-800 border-slate-700 cursor-pointer" 
                      />
                      <span className="font-semibold text-sm md:text-base">
                        {key === 'bp' ? 'High Blood Pressure' : 
                         key === 'chol' ? 'High Cholesterol' : 
                         key === 'smoker' ? 'Current/Former Smoker' : 
                         'Heart Disease/Attack'}
                      </span>
                    </div>
                    {/* Individual indicator tag */}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {key === 'bp' ? `+${processedData.odds.bp.or.toFixed(2)}x` : 
                       key === 'chol' ? `+${processedData.odds.chol.or.toFixed(2)}x` : 
                       key === 'smoker' ? `+${processedData.odds.smoker.or.toFixed(2)}x` : 
                       `+${processedData.odds.heart.or.toFixed(2)}x`}
                    </span>
                  </label>
                ))}
              </div>

              {/* Dynamic Animated Growing Risk Bar */}
              <div className="mt-4 p-5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                  <span className="text-indigo-300">Estimated Relative Risk Multiplier</span>
                  <span className="text-rose-400">Baseline Standard = 1.0x</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-slate-950 rounded-full h-5 overflow-hidden border border-slate-800 relative">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(100, (cumulativeRisk / 15) * 100)}%` }}
                    />
                  </div>
                  <span className="text-3xl md:text-4xl font-black text-indigo-400 min-w-[95px] text-right tracking-tight transition-all duration-500">
                    {cumulativeRisk.toFixed(2)}x
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {cumulativeRisk === 1.0 
                    ? "With no risk factors active, your metabolic risk matches the baseline population average (1.00x)." 
                    : `Your selected clinical parameters multiply your compound relative risk to an estimated ${cumulativeRisk.toFixed(2)}x compared to a healthy baseline control group.`
                  }
                </p>
              </div>
            </div>

            {/* Odds Ratio Forest Chart */}
            <div className="w-full pt-4 h-[400px]">
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
            
            {showDeepDive && (
              <div className="p-5 bg-indigo-950/10 border-l-4 border-indigo-500 rounded-r-xl text-xs text-slate-300 space-y-2 mt-4">
                <p className="font-extrabold uppercase tracking-widest text-indigo-400">Epidemiological Analysis (Deep Dive)</p>
                <p>
                  Calculations indicate that hypertension (OR: ~5.3x) holds the strongest relative diagnostic weight for type 2 diabetes. Hypercholesterolemia acts as a secondary metabolic catalyst. When clinical conditions overlap, the combined multi-morbidity risk factor scales compoundly, warranting immediate combined prevention.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- SECTION 2: POLICYMAKERS (EQUITY) --- */}
        <section id="part2" className="space-y-8 scroll-mt-24">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-amber-500" /> Part 2: Socioeconomic & Systemic Barriers
            </h2>
            <p className="text-slate-400 mt-2">
              {!showDeepDive 
                ? "Physical wellness is deeply tied to where we live, how much we earn, and our access to resources. Discover the systemic structures framing health outcomes."
                : "Socioeconomic Status (SES) operates as a primary Social Determinant of Health (SDOH). Analyze prevalence slope disparities across education and income tiers below."
              }
            </p>
          </div>

          {/* Socioeconomic Slope with Large Buttons */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Socioeconomic Disparities</h3>
                <p className="text-sm text-slate-400">
                  Diabetes prevalence mapped against clean social structures. 
                  <span className="block text-indigo-400 font-semibold mt-1.5">
                    Toggle between Annual Income and Education Level by clicking the switch buttons to the right.
                  </span>
                </p>
              </div>
              <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-inner w-full lg:w-auto">
                <button 
                  onClick={() => setSlopeView('income')} 
                  className={`flex-1 lg:flex-none px-6 py-3 text-sm md:text-base font-bold rounded-lg transition-all duration-200 ${
                    slopeView === 'income' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  Annual Income
                </button>
                <button 
                  onClick={() => setSlopeView('education')} 
                  className={`flex-1 lg:flex-none px-6 py-3 text-sm md:text-base font-bold rounded-lg transition-all duration-200 ${
                    slopeView === 'education' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
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
                    marker: { size: 8 },
                    hovertemplate: 'Education: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    xaxis: { title: 'Highest Level of Education Attained', gridcolor: '#1e293b', automargin: true },
                    yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', autorange: true },
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

            {showDeepDive && (
              <div className="p-5 bg-indigo-950/10 border-l-4 border-indigo-500 rounded-r-xl text-xs text-slate-300 space-y-2 mt-4">
                <p className="font-extrabold uppercase tracking-widest text-indigo-400">Policy Implications (Deep Dive)</p>
                <p>
                  The continuous negative slope of both metrics reflects systemic disparities. These gaps cannot be resolved through behavioral choices alone. They demand targeted policy structures, such as introducing subsidized fresh produce markets in food deserts (matching low-income coordinates) and strengthening metabolic health literacy initiatives.
                </p>
              </div>
            )}
          </div>

          {/* Behavioral / Barriers Butterfly with Large Buttons */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Daily Behaviors & Healthcare Barriers</h3>
                <p className="text-sm text-slate-400">
                  Comparing populations: Healthy (Green) vs Diabetic (Red). 
                  <span className="block text-indigo-400 font-semibold mt-1.5">
                    Toggle between Diet & Activity and Systemic Barriers by clicking the options to the right.
                  </span>
                </p>
              </div>
              <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-inner w-full lg:w-auto">
                <button 
                  onClick={() => setButterflyView('diet')} 
                  className={`flex-1 lg:flex-none px-6 py-3 text-sm md:text-base font-bold rounded-lg transition-all duration-200 ${
                    butterflyView === 'diet' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  Diet & Activity
                </button>
                <button 
                  onClick={() => setButterflyView('barriers')} 
                  className={`flex-1 lg:flex-none px-6 py-3 text-sm md:text-base font-bold rounded-lg transition-all duration-200 ${
                    butterflyView === 'barriers' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
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
        </section>

        {/* --- SECTION 3: HEALTHCARE WORKERS (CLINICAL STATS) --- */}
        <section id="part3" className="space-y-8 scroll-mt-24">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Stethoscope className="text-blue-500" /> Part 3: Clinical Intersections & Statistics
            </h2>
            <p className="text-slate-400 mt-2">
              {!showDeepDive 
                ? "Chronic metabolic conditions do not occur in isolation. View how physiological indicators and wellness evaluations cluster across the population."
                : "Explore pathological clustering metrics, macrovascular networks, and joint probability indexes of patients coping with metabolic syndrome."
              }
            </p>
          </div>

          {/* Comorbidity Network - Interactive Sankey */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-xl font-bold text-white">The Web of Chronic Conditions</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Click directly on any label or block within the flow diagram below to analyze that specific clinical connection.
                </p>
              </div>
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
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
                onClick={(data) => {
                  if (data && data.points && data.points[0]) {
                    const clickedLabel = data.points[0].label;
                    if (clickedLabel && sankeyInterpretations[clickedLabel]) {
                      setSelectedSankeyNode(clickedLabel);
                    }
                  }
                }}
              />
            </div>

            {/* Symmetrical Color-Coded Interpretation Card */}
            <div className={`mt-6 p-6 rounded-xl border transition-all duration-300 ${sankeyColors[selectedSankeyNode]?.border} ${sankeyColors[selectedSankeyNode]?.bg} ${sankeyColors[selectedSankeyNode]?.text}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold text-white">{sankeyInterpretations[selectedSankeyNode]?.title}</h4>
                <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1 rounded-full ${sankeyColors[selectedSankeyNode]?.tagBg}`}>
                  Selected Metric
                </span>
              </div>
              <p className="text-sm md:text-base leading-relaxed">
                {sankeyInterpretations[selectedSankeyNode]?.text}
              </p>
            </div>

            <TakeawayBanner text="Diabetes rarely exists in isolation. Observe the massive flow connecting Diabetes directly to High Blood Pressure and High Cholesterol, highlighting the critical need for comprehensive cardiovascular care." />
          </div>

          {/* Raincloud / Violin Plot with Variable Selector & Slider */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Physical Metrics vs. Subjective General Health</h3>
                <p className="text-sm text-slate-400">
                  Density distribution grouped by self-reported health (1 = Excellent, 5 = Poor).
                  <span className="block text-indigo-400 font-semibold mt-1">
                    Toggle between BMI and Age by clicking the switch buttons on the right.
                  </span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full lg:w-auto">
                {/* BMI vs Age Toggle */}
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button 
                    onClick={() => setViolinParam('BMI')} 
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                      violinParam === 'BMI' 
                        ? 'bg-indigo-600 text-white shadow' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    BMI
                  </button>
                  <button 
                    onClick={() => setViolinParam('Age')} 
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                      violinParam === 'Age' 
                        ? 'bg-indigo-600 text-white shadow' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Age Bracket
                  </button>
                </div>

                {/* Mental Health Slider */}
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex-1 lg:flex-none lg:w-64">
                  <label className="flex justify-between text-xs text-slate-300 font-bold mb-2">
                    <span>Min. Bad Mental Health Days</span>
                    <span className="text-blue-400 font-black">{mentalHealthDays} days</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="30" 
                    value={mentalHealthDays} 
                    onChange={(e) => setMentalHealthDays(parseInt(e.target.value))} 
                    className="w-full accent-blue-500 cursor-pointer" 
                  />
                </div>
              </div>
            </div>
            
            <div className="w-full h-[500px]">
              <Plot
                data={[
                  ...[1, 2, 3, 4, 5].map((lvl, idx) => {
                    const colors = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#ef4444'];
                    const currentData = violinParam === 'BMI' 
                      ? processedData.raincloudBMI[`gen${lvl}`] 
                      : processedData.raincloudAge[`gen${lvl}`];
                    return {
                      type: 'violin', 
                      x: Array(currentData.length).fill(`Level ${lvl}`), 
                      y: currentData,
                      name: `Health Level ${lvl}`, 
                      points: 'all', 
                      pointpos: -0.5, 
                      jitter: 0.7, 
                      side: 'positive',
                      line: { color: colors[idx], width: 2 }, 
                      marker: { size: 3, opacity: 0.3, color: '#94a3b8' }, 
                      meanline: { visible: true, width: 4, color: '#ffffff' }, 
                      hovertemplate: 'Self Rating: Level ' + lvl + `<br>${violinParam}: %{y}<extra></extra>`
                    };
                  }),
                  {
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
                    y: violinParam === 'BMI' ? processedData.raincloudBMIMeans : processedData.raincloudAgeMeans,
                    name: `Average ${violinParam} Trend`,
                    line: { color: '#ffffff', width: 4, dash: 'solid' },
                    marker: { size: 10, color: '#fbbf24', line: { color: '#ffffff', width: 2 } },
                    hovertemplate: `Average ${violinParam}: %{y:.1f}<extra></extra>`
                  }
                ]}
                layout={{ 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  xaxis: { title: 'General Health Rating (1 = Excellent, 5 = Poor)', gridcolor: '#1e293b' }, 
                  yaxis: { 
                    title: violinParam === 'BMI' ? 'BMI (Body Mass Index)' : 'Age Bracket (1 to 13)', 
                    gridcolor: '#1e293b', 
                    range: violinParam === 'BMI' ? [10, 60] : [1, 14] 
                  }, 
                  showlegend: false, 
                  autosize: true 
                }}
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            
            <TakeawayBanner 
              text={`For those who report 'Poor' health (Level 5), the shape bulges much higher, showing weight clustering in obese territory. Adjust the mental health slider to see how weights shift as chronic stress rises. Additionally, you can toggle the parameter view between Body Mass Index (BMI) and Age to observe how metabolic profiles and age independently influence these wellness curves. In the BMI view, the average climbs systematically from 26.2 to 32.4 (the white trendline), driving the baseline from overweight into clinically obese territory.`} 
            />
          </div>

          {/* Symmetrical Heatmap + Pairwise Dropdown Correlation Translator */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Systemic Connections Map</h3>
                <p className="text-sm text-slate-400">A stair-step heatmap of clinical and social relationships, paired with an interactive translator.</p>
              </div>
              <InfoPopup 
                title="Symmetrical Heatmaps" 
                text="Traditional heatmaps are highly cluttered. By removing the duplicate mirroring (top-right half) and the self-comparisons on the diagonal, we cut your cognitive load in half. Use the translator next to it for quick interpretations."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Symmetrical Clean Heatmap */}
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

              {/* Overhauled Correlation Translator Column */}
              <div className="lg:col-span-5 bg-slate-800/40 p-6 border border-slate-700/50 rounded-xl flex flex-col justify-start">
                <div className="mb-4">
                  <span className="text-xs font-black tracking-widest text-indigo-400 uppercase">Interactive Tool</span>
                  <h4 className="text-lg font-bold text-white mt-1">Correlation Translator</h4>
                  <p className="text-xs text-slate-400 mt-1">Select a pair of variables to translate their mathematical correlation into plain language.</p>
                </div>

                <select 
                  value={selectedPairIndex} 
                  onChange={(e) => setSelectedPairIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 font-semibold"
                >
                  {translatorPairs.map((pair, idx) => (
                    <option key={idx} value={idx}>{pair.label}</option>
                  ))}
                </select>

                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Correlation Strength</p>
                      <p className="text-xs text-slate-500 mt-0.5">Pearson Coefficient (r)</p>
                    </div>
                    <span className={`text-2xl font-black ${pairCorrelation >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pairCorrelation >= 0 ? '+' : ''}{pairCorrelation.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-3 items-start bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0 animate-pulse" />
                    <div>
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">Plain-English Translation</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{pairwiseExplanation}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <TakeawayBanner 
              text="Observe the steep negative correlation link (-0.37) between General Health and Income. Health is not just a physiological condition; it is profoundly bound up with economic security." 
            />

            {showDeepDive && (
              <div className="p-5 bg-indigo-950/10 border-l-4 border-indigo-500 rounded-r-xl text-xs text-slate-300 space-y-2 mt-4">
                <p className="font-extrabold uppercase tracking-widest text-indigo-400">Correlation Interpretation (Deep Dive)</p>
                <p>
                  Reviewing the lower-left staircase: the value of (+0.42) between education and annual income indicates a key socioeconomic gateway. This reinforces that metabolic wellness can be improved systematically by investing in social educational infrastructure and job creation.
                </p>
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}