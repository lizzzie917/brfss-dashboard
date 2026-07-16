import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { 
  Activity, Info, HeartPulse, Users, Stethoscope, 
  ArrowUp, ChevronDown, CheckSquare, Square
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
  // Haldane-Anscombe correction to prevent division-by-zero or undefined log calculations
  const correction = (exposedDiabetic === 0 || exposedHealthy === 0 || unexposedDiabetic === 0 || unexposedHealthy === 0) ? 0.5 : 0;
  const a = exposedDiabetic + correction;
  const b = exposedHealthy + correction;
  const c = unexposedDiabetic + correction;
  const d = unexposedHealthy + correction;

  const or = (a * d) / (b * c);
  const se = Math.sqrt((1/a) + (1/b) + (1/c) + (1/d));
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

// Plain-English translations of correlations
const correlationTranslations = {
  'Diabetes Diagnosis': [
    "Strongest Link: High Blood Pressure. People diagnosed with High BP show significantly higher rates of diabetes.",
    "Socioeconomic Shield: Both Annual Income and Education Level have negative correlations (-0.16 & -0.12). As income and education rise, your statistical risk of diabetes decreases.",
    "Physical Footprint: Higher BMI and poorer self-reported General Health Ratings are heavily clustered with positive diabetes diagnoses."
  ],
  'High Blood Pressure': [
    "Age Factor: This has the strongest positive link with Age (+0.27). Risk scales upward systematically as the population ages.",
    "Metabolic Duo: High Cholesterol and BMI are closely bound to High BP, representing a unified cardiovascular health profile.",
    "Socioeconomic Impact: Higher incomes show a strong negative correlation (-0.17), meaning financial stability is tied to healthier blood pressure averages."
  ],
  'High Cholesterol': [
    "Co-Occurrence: Strongly linked to High Blood Pressure and Diabetes. These three markers frequently present together in patients.",
    "Demographics: Age is a major factor. The risk of high cholesterol steadily rises across older brackets in this population."
  ],
  'Body Mass Index (BMI)': [
    "The Health Mirror: As BMI climbs, self-reported General Health Ratings worsen (+0.27 correlation).",
    "Socioeconomic Divide: Shows a negative relationship with Income (-0.11), meaning higher-income groups average lower BMIs, likely due to fresh food access and recreational time."
  ],
  'Age Bracket': [
    "Chronic Accumulation: Age is heavily linked to High BP (+0.27), High Cholesterol (+0.23), and Diabetes (+0.18). Metabolic issues build up over time.",
    "Education Shift: Shows a slight negative correlation with higher education, capturing generational changes in college access."
  ],
  'General Health Rating': [
    "The Ultimate Metric: This subjective rating is highly accurate. It has incredibly strong positive correlations with physical markers like BMI (+0.27) and Diabetes (+0.29).",
    "Socioeconomic Lift: Strongly tied to Annual Income (-0.37). Wealthier individuals rate their own physical health significantly higher."
  ],
  'Annual Income': [
    "The Great Stabilizer: Has the strongest negative relationship with poor General Health Ratings (-0.37). Financial security is the single biggest predictor of positive self-reported wellness.",
    "Education Link: Shows a powerful positive correlation with Education Level (+0.42). Educational opportunities strongly lead to higher career earnings."
  ],
  'Education Level': [
    "Financial Gateway: Highly correlated with Annual Income (+0.42), which in turn feeds into better healthcare and diet access.",
    "Systemic Shield: Higher education levels correlate to lower average BMIs, lower diabetes rates, and overall better subjective health."
  ]
};

const riskFactorDescriptions = {
  CholCheck: {
    title: "Cholesterol Screening Engagement",
    technical: "Routine cholesterol screening (CholCheck=1) possesses a crude Odds Ratio of 6.49 with diabetes. This relationship highlights diagnostic selection bias: individuals actively engaged in lipid screening are significantly more likely to receive clinical evaluations and subsequent formal diabetes diagnoses.",
    general: "Why does checking cholesterol have such a high link to diabetes? It isn't because screening causes diabetes, but because people who regularly visit the doctor for checkups are the ones who actually get diagnosed! It underscores the vital role screening plays in disease detection."
  },
  HighBP: {
    title: "Hypertension (High Blood Pressure)",
    technical: "Hypertension (HighBP=1) carries a powerful Odds Ratio of 5.09. Chronic arterial pressure damages cardiac vasculatures and frequently co-occurs with insulin resistance pathways, forming a foundational component of metabolic syndrome.",
    general: "High blood pressure multiplies your baseline risk of diabetes by over 5 times. High pressure damages blood vessels and impairs blood flow, making it significantly harder for your cells to respond to insulin and handle sugar."
  },
  DiffWalk: {
    title: "Physical Mobility Limitations",
    technical: "Struggling to walk or climb stairs (DiffWalk=1) carries an Odds Ratio of 3.81. Physical immobility creates a metabolic bottleneck, reducing systematic energy expenditure, muscle mass glycogen storage, and glycemic control.",
    general: "Difficulty walking or moving escalates diabetes risk by 3.8 times. When physical limitations limit exercise, the body burns less glucose, causing systemic blood sugar levels to rise and muscle mass to decrease."
  },
  HeartDiseaseorAttack: {
    title: "Coronary Heart Disease/Myocardial Infarction",
    technical: "Active cardiovascular disease (HeartDiseaseorAttack=1) strongly aligns with diabetic prevalence (OR of 3.66). These micro- and macrovascular complications share underlying systemic inflammation and atherogenic plaque pathways.",
    general: "Patients with heart disease history face 3.6 times the risk of diabetes. Cardiovascular disease and diabetes are biological partners—long-term inflammation and artery damage strongly support metabolic decline."
  },
  HighChol: {
    title: "Hypercholesterolemia (High Cholesterol)",
    technical: "Elevated lipids (HighChol=1) carry an Odds Ratio of 3.30. Lipotoxicity blocks key cellular glucose pathways in skeletal muscle and impairs pancreatic beta-cell insulin secretion, advancing chronic insulin resistance.",
    general: "High cholesterol multiplies diabetes risk by 3.3 times. Excess fatty acids in the bloodstream build up inside organs like the pancreas and liver, directly blocking the production and absorption of insulin."
  },
  Stroke: {
    title: "Prior Cerebrovascular Incidents (Stroke)",
    technical: "Cerebrovascular damage (Stroke=1) exhibits a diagnostic Odds Ratio of 3.09. This relationship highlights the vascular impacts of hyperglycemia, where high systemic glucose compromises arterial walls and accelerates cerebral blockages.",
    general: "A prior stroke raises the statistical likelihood of diabetes by 3 times. Strokes and diabetes share a common vascular origin, as long-term high blood sugar weakens and blocks crucial blood vessels."
  },
  Smoker: {
    title: "Tobacco Smoker (Current/Former)",
    technical: "Tobacco exposure (Smoker=1) yields a statistically significant Odds Ratio of 1.41. Absorbed nicotine impairs vascular insulin sensitivity, elevates cortisol, and encourages unhealthy central visceral adiposity.",
    general: "Smoking increases diabetes risk by 1.4 times. Toxins in tobacco smoke damage cells, trigger systematic inflammation, and make body tissue less receptive to insulin."
  },
  NoDocbcCost: {
    title: "Financial Barriers to Doctor Visits",
    technical: "Avoiding medical consults due to financial strain (NoDocbcCost=1) carries an Odds Ratio of 1.33. Financial hurdles drive clinical delays, leaving prediabetic trends unmonitored and skipping structural lifestyle guidance.",
    general: "Skipping doctor visits due to cost increases diabetes risk by 1.3 times. If healthcare is unaffordable, early warning signs go undetected, allowing manageable prediabetic states to advance into chronic disease."
  }
};

const sankeyIntersections = {
  'High Blood Pressure': {
    title: "Vascular Co-occurrence (Hypertension)",
    technical: "High blood pressure serves as a compounding vascular stressor. In this dataset, over 75% of diabetic patients suffer from co-occurring hypertension. This synergy dramatically escalates microvascular complications like retinopathy and macrovascular risks.",
    general: "Over 3 out of 4 diabetics also have high blood pressure. Together, these two conditions place immense strain on your blood vessels, drastically increasing the risk of cardiovascular events, vision loss, and kidney disease."
  },
  'High Cholesterol': {
    title: "Endocrine-Lipid Nexus (Hypercholesterolemia)",
    technical: "Hypercholesterolemia is a leading element in diabetic dyslipidemia. Over 67% of diabetic patients in this study have high cholesterol, fueling rapid plaque formation in arterial walls and accelerating cardiovascular disease.",
    general: "Nearly 70% of diabetic patients also live with high cholesterol. High blood fats and high blood sugar work in tandem to harden and block arteries, making cholesterol control a critical priority for diabetes care."
  },
  'Heart Disease': {
    title: "Macrovascular Complications",
    technical: "Coronary heart disease is an advanced macrovascular complication of progressive insulin resistance. Over 22% of diabetic subjects present with diagnosed coronary disease or prior heart attacks, showing shared structural origins.",
    general: "More than 1 in 5 diabetics have diagnosed heart disease or have suffered a heart attack. This proves diabetes is far more than a blood sugar issue—it is a severe cardiovascular challenge that demands protective heart therapies."
  },
  'Stroke': {
    title: "Cerebrovascular Intersections",
    technical: "Stroke history occurs at elevated levels in metabolic cohorts. Over 9% of diabetic individuals in this dataset have experienced a stroke, driven by cerebral vascular wall breakdown and accelerated atherosclerosis.",
    general: "Nearly 1 in 10 diabetic patients have suffered a stroke. Consistently elevated blood sugar damages cerebral blood vessels, making stroke screening and tight blood pressure control crucial."
  }
};

// --- REUSABLE ANNOTATIVE COMPONENTS ---
const InfoPopup = ({ title, text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 text-xs bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 font-semibold"
      >
        <Info size={14} /> What does this mean?
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 w-72 p-4 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl text-xs text-slate-200">
          <strong className="block text-indigo-400 mb-1">{title}</strong>
          {text}
        </div>
      )}
    </div>
  );
};

const TakeawayBanner = ({ technical, general }) => (
  <div className="mt-6 space-y-4">
    <div className="p-4 bg-slate-900/80 border-l-4 border-amber-500 rounded-r-lg text-slate-300 text-sm leading-relaxed">
      <span className="font-bold text-slate-100 uppercase text-xs tracking-wider block mb-1">CLINICAL & POLICY INSIGHT:</span>
      {technical}
    </div>
    <div className="p-4 bg-indigo-950/40 border-l-4 border-indigo-400 rounded-r-lg text-indigo-200 text-sm leading-relaxed font-medium">
      <span className="font-bold text-indigo-300 uppercase text-xs tracking-wider block mb-1">WHAT THIS MEANS FOR YOU:</span>
      {general}
    </div>
  </div>
);

const DualSectionHeader = ({ technicalTitle, generalTitle, technicalDesc, generalDesc }) => (
  <div className="space-y-4 mb-6">
    <div className="flex flex-col md:flex-row md:items-baseline md:gap-4">
      <h3 className="text-xl font-bold text-white border-r border-slate-700 pr-4">{technicalTitle}</h3>
      <span className="text-sm font-semibold text-indigo-400 italic">{generalTitle}</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Technical Analysis (Epidemiology & Policy)</span>
        <p className="text-slate-300 leading-relaxed">{technicalDesc}</p>
      </div>
      <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/30">
        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block mb-2">What does this mean for you? (General Audience & Patients)</span>
        <p className="text-indigo-200 leading-relaxed font-medium">{generalDesc}</p>
      </div>
    </div>
  </div>
);

export default function App() {
  const [dataset, setDataset] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [butterflyView, setButterflyView] = useState('diet'); 
  const [slopeView, setSlopeView] = useState('income');
  const [translatorVar, setTranslatorVar] = useState('Diabetes Diagnosis');
  const [mentalHealthDays, setMentalHealthDays] = useState(0);
  const [selectedSankeyNode, setSelectedSankeyNode] = useState('High Blood Pressure');
  const [activeRiskFactor, setActiveRiskFactor] = useState('HighBP');
  
  // Navigation active state for dynamic sub-scrolling
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Dynamic state for all 8 python-verified risk factors
  const [calcRisks, setCalcRisks] = useState({
    CholCheck: false,
    HighBP: false,
    DiffWalk: false,
    HeartDiseaseorAttack: false,
    HighChol: false,
    Stroke: false,
    Smoker: false,
    NoDocbcCost: false
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

    const violin = { gen1: [], gen2: [], gen3: [], gen4: [], gen5: [] };
    const stats = {
      healthy: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 },
      diabetic: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 }
    };
    const incomeStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0}, 7:{t:0, d:0}, 8:{t:0, d:0} };
    const eduStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0} };
    const vars = { Diabetes: [], BP: [], Chol: [], BMI: [], Age: [], GenHlth: [], Income: [], Edu: [] };
    
    // Contingency counts for dynamic Odds Ratios
    const riskKeys = ['CholCheck', 'HighBP', 'DiffWalk', 'HeartDiseaseorAttack', 'HighChol', 'Stroke', 'Smoker', 'NoDocbcCost'];
    const orCounts = {};
    riskKeys.forEach(k => { orCounts[k] = { ed: 0, eh: 0, ud: 0, uh: 0 }; });

    let d_bp = 0, d_chol = 0, d_heart = 0, d_stroke = 0;

    dataset.forEach((row) => {
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

      if (row.Income >= 1 && row.Income <= 8) { incomeStats[row.Income].t += 1; if (isDiabetic) incomeStats[row.Income].d += 1; }
      if (row.Education >= 1 && row.Education <= 6) { eduStats[row.Education].t += 1; if (isDiabetic) eduStats[row.Education].d += 1; }

      vars.Diabetes.push(row.Diabetes_binary);
      vars.BP.push(row.HighBP); 
      vars.Chol.push(row.HighChol);
      vars.BMI.push(row.BMI); 
      vars.Age.push(row.Age); 
      vars.GenHlth.push(row.GenHlth); 
      vars.Income.push(row.Income); 
      vars.Edu.push(row.Education);

      // Odds calculation iteration
      riskKeys.forEach(k => {
        const val = row[k];
        if (val === 1) {
          isDiabetic ? orCounts[k].ed++ : orCounts[k].eh++;
        } else if (val === 0) {
          isDiabetic ? orCounts[k].ud++ : orCounts[k].uh++;
        }
      });

      if (isDiabetic) {
        if (row.HighBP === 1) d_bp++;
        if (row.HighChol === 1) d_chol++; 
        if (row.HeartDiseaseorAttack === 1) d_heart++; 
        if (row.Stroke === 1) d_stroke++;
      }

      if (includeInViolin && row.GenHlth >= 1 && row.GenHlth <= 5) {
        violin[`gen${row.GenHlth}`].push(row.BMI);
      }
    });

    const calcPct = (c, t) => t > 0 ? (c / t) * 100 : 0;
    
    // Calculate lower triangle Pearson correlation matrix
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

    // Dynamic means for Violin Plots
    const violinMeans = [1, 2, 3, 4, 5].map(lvl => {
      const arr = violin[`gen${lvl}`];
      return arr && arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });

    // Compute active Odds Ratios dynamically
    const odds = {};
    riskKeys.forEach(k => {
      odds[k] = calcOR(orCounts[k].ed, orCounts[k].eh, orCounts[k].ud, orCounts[k].uh);
    });

    // Absolute counts for details display
    const totalDiabetic = stats.diabetic.total;

    return {
      violin, violinMeans, totalDiabetic,
      heatmap: { z: zMatrix, labels: heatmapVariables },
      slope: {
        incomeY: [1, 2, 3, 4, 5, 6, 7, 8].map(l => calcPct(incomeStats[l].d, incomeStats[l].t)),
        eduY: [1, 2, 3, 4, 5, 6].map(l => calcPct(eduStats[l].d, eduStats[l].t))
      },
      butterfly: {
        diet: {
          labels: ['Daily Vegetables', 'Daily Fruits', 'Physical Activity', 'Tobacco Smoking'],
          healthy: [calcPct(stats.healthy.veggies, stats.healthy.total), calcPct(stats.healthy.fruits, stats.healthy.total), calcPct(stats.healthy.physAct, stats.healthy.total), calcPct(stats.healthy.smoker, stats.healthy.total)],
          diabetic: [calcPct(stats.diabetic.veggies, stats.diabetic.total), calcPct(stats.diabetic.fruits, stats.diabetic.total), calcPct(stats.diabetic.physAct, stats.diabetic.total), calcPct(stats.diabetic.smoker, stats.diabetic.total)]
        },
        barriers: {
          labels: ['Difficulty Walking', 'Healthcare Cost Barriers'],
          healthy: [calcPct(stats.healthy.diffWalk, stats.healthy.total), calcPct(stats.healthy.noDoc, stats.healthy.total)],
          diabetic: [calcPct(stats.diabetic.diffWalk, stats.diabetic.total), calcPct(stats.diabetic.noDoc, stats.diabetic.total)]
        }
      },
      odds,
      sankey: {
        nodes: ['Diabetes Diagnosis', 'High Blood Pressure', 'High Cholesterol', 'Heart Disease', 'Stroke'],
        links: { source: [0, 0, 0, 0], target: [1, 2, 3, 4], value: [d_bp, d_chol, d_heart, d_stroke] }
      }
    };
  }, [dataset, mentalHealthDays]);

  // Handle loading states elegantly
  if (isLoading || !processedData) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center flex-col gap-6">
        <Activity className="animate-spin text-indigo-500" size={64} />
        <h2 className="text-2xl font-bold mb-2">Ingesting 70,000 Health Records...</h2>
      </div>
    );
  }

  // Calculate live cumulative risk dynamically using Python odds values
  let cumulativeRisk = 1.0;
  Object.keys(calcRisks).forEach(key => {
    if (calcRisks[key]) {
      cumulativeRisk *= processedData.odds[key].or;
    }
  });

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveDropdown(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto selection:bg-indigo-500 selection:text-white">
      
      {/* FLOATING BACK TO TOP BUTTON */}
      <button 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-500 text-white p-3.5 rounded-full shadow-2xl transition-all cursor-pointer z-50 flex items-center justify-center border border-indigo-400/30 hover:scale-105 active:scale-95"
        title="Go back to top"
      >
        <ArrowUp size={20} />
      </button>

      {/* TOP NAVIGATION BAR WITH DROP DOWNS */}
      <nav className="sticky top-0 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 z-50 py-3.5 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
            <span className="font-extrabold text-white text-base tracking-wide">
              Population Health Analytics
            </span>
          </div>

          <div className="flex gap-1">
            {/* Dropdown 1 */}
            <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'part1' ? null : 'part1')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:bg-slate-900 transition"
              >
                Part 1: Patient Risk <ChevronDown size={14} />
              </button>
              {activeDropdown === 'part1' && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <button 
                    onClick={() => scrollToSection('part1')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🚀 Top of Part 1
                  </button>
                  <button 
                    onClick={() => scrollToSection('calculator')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🧮 Interactive Calculator
                  </button>
                  <button 
                    onClick={() => scrollToSection('risk-bar-chart')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    📊 Risk Multiplier Chart
                  </button>
                </div>
              )}
            </div>

            {/* Dropdown 2 */}
            <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'part2' ? null : 'part2')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:bg-slate-900 transition"
              >
                Part 2: Socioeconomic <ChevronDown size={14} />
              </button>
              {activeDropdown === 'part2' && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <button 
                    onClick={() => scrollToSection('part2')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🚀 Top of Part 2
                  </button>
                  <button 
                    onClick={() => scrollToSection('slopes')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    📈 Socioeconomic Slopes
                  </button>
                  <button 
                    onClick={() => scrollToSection('butterfly')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🦋 Behavioral Delta Gaps
                  </button>
                </div>
              )}
            </div>

            {/* Dropdown 3 */}
            <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'part3' ? null : 'part3')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:bg-slate-900 transition"
              >
                Part 3: Intersections <ChevronDown size={14} />
              </button>
              {activeDropdown === 'part3' && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <button 
                    onClick={() => scrollToSection('part3')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🚀 Top of Part 3
                  </button>
                  <button 
                    onClick={() => scrollToSection('comorbidity')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🕸️ Web of Chronic Conditions
                  </button>
                  <button 
                    onClick={() => scrollToSection('violins')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🎻 BMI Density Distribution
                  </button>
                  <button 
                    onClick={() => scrollToSection('heatmap-sec')}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition font-medium"
                  >
                    🗺️ Systemic Connections Map
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* HEADER NARRATIVE */}
      <header className="max-w-4xl mx-auto pt-14 pb-12 px-6 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Population Health Analytics: <br className="hidden md:inline" />
          <span className="text-indigo-400">Mapping Diabetes Risk & Systemic Barriers</span>
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 text-left text-sm">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Technical Summary & Dataset Info</span>
            <p className="text-slate-300 leading-relaxed">
              This dashboard analyzes 70,000 anonymized health records extracted from the CDC's Behavioral Risk Factor Surveillance System (BRFSS) 2015 dataset. Using calculated statistical parameters, multi-dimensional stratification, and correlation matrices, we explore non-linear logistic markers, demographic discrepancies, and cardiovascular overlaps[cite: 3, 11, 51].
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

          <div className="bg-indigo-950/25 p-5 rounded-2xl border border-indigo-900/35">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest block mb-2">What does this mean for you?</span>
            <p className="text-indigo-200 leading-relaxed font-medium">
              This interactive dashboard translates complex numbers from 70,000 real people into simple wellness stories. It is designed to show how our personal life situations (like household income and school access) combine with physical markers and common behaviors to shape our risk of developing diabetes.
            </p>
            <p className="text-indigo-300/80 text-xs mt-4 font-semibold italic">
              Use the top navigation bar or scroll down to explore clinical indicators, societal structures, and chronic overlaps.
            </p>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- PART 1: CLINICAL DRIVERS --- */}
        <section id="part1" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <DualSectionHeader 
              technicalTitle="Part 1: Analyzing Patient Risk: Clinical Drivers of Diabetes"
              generalTitle="Part 1: Clinical Health & Personal Risks"
              technicalDesc="Evaluating Odds Ratios (OR) and calculated statistics across leading clinical variables in the BRFSS dataset. We map relative diagnostic likelihoods given specific chronic exposures[cite: 10, 36]."
              generalDesc="This section acts as an interactive hazard map. It explores how much more likely a person is to be diagnosed with diabetes if they already live with other health conditions."
            />
          </div>

          {/* CALCULATOR PANEL */}
          <div id="calculator" className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row scroll-mt-24">
            <div className="w-full md:w-1/3 bg-slate-800/50 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <HeartPulse className="text-rose-500" /> Multi-Factor Risk Calculator
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Toggle patient health factors based on our Python odds results to see how relative metabolic risks compound[cite: 31, 32].
                </p>
                <div className="space-y-2 mt-5">
                  {Object.keys(calcRisks).map(key => (
                    <label key={key} className="flex items-center gap-3 p-2.5 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/80 transition bg-slate-950/50">
                      <input 
                        type="checkbox" 
                        checked={calcRisks[key]} 
                        onChange={() => toggleRisk(key)} 
                        className="w-4 h-4 checked:bg-indigo-500 rounded accent-indigo-500" 
                      />
                      <span className="font-semibold text-slate-200 text-xs md:text-sm">
                        {riskFactorDescriptions[key]?.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Estimated Relative Risk Multiplier</p>
                <p className="text-4xl font-black text-indigo-400 mt-1">{cumulativeRisk.toFixed(2)}x</p>
                <p className="text-[10px] text-slate-400 mt-1">compared to standard baseline population</p>
              </div>
            </div>

            {/* INTERACTIVE RISK BAR CHART */}
            <div id="risk-bar-chart" className="w-full md:w-2/3 p-6 flex flex-col justify-between scroll-mt-24">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-base font-bold text-slate-100">Relative Risk Multipliers (Odds Ratios)</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Click any risk factor bar to display its clinical translation.
                  </p>
                </div>
                <InfoPopup 
                  title="What is an Odds Ratio?" 
                  text="An Odds Ratio is a key statistical metric in medicine. It calculates exactly how many times more common a disease is in patients who have a specific health condition compared to those who do not. A score of 1.0 represents baseline (no added risk), while a 5.0 means patients are 5 times more likely to receive a diabetes diagnosis."
                />
              </div>

              <div className="h-[280px] mt-4">
                <Plot
                  data={[{
                    type: 'bar',
                    orientation: 'h',
                    x: Object.keys(processedData.odds).map(k => processedData.odds[k].or),
                    y: Object.keys(processedData.odds).map(k => riskFactorDescriptions[k]?.title || k),
                    marker: { color: '#4f46e5' },
                    hovertemplate: '<b>%{y}</b><br>Odds Ratio: %{x:.2f}x<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8', size: 9 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    xaxis: { title: 'Risk Multiplier (Odds Ratio)', gridcolor: '#1e293b' },
                    yaxis: { gridcolor: 'transparent', autorange: 'reversed' },
                    margin: { l: 200, r: 20, t: 10, b: 40 },
                    autosize: true,
                    shapes: [{
                      type: 'line',
                      x0: 1, x1: 1,
                      y0: -0.5, y1: 7.5,
                      line: { color: '#f43f5e', dash: 'dash', width: 2 }
                    }]
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                  onClick={(data) => {
                    if (data && data.points && data.points[0]) {
                      const idx = data.points[0].pointIndex;
                      const clickedKey = Object.keys(processedData.odds)[idx];
                      if (clickedKey) setActiveRiskFactor(clickedKey);
                    }
                  }}
                />
              </div>

              {/* DUAL DETAILS CARD FOR CLICKED BAR */}
              <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                    Selected Profile: {riskFactorDescriptions[activeRiskFactor]?.title}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-1">
                  <div>
                    <span className="font-semibold text-slate-400 block mb-1">Epidemiological Impact</span>
                    <p className="text-slate-300 leading-relaxed">
                      {riskFactorDescriptions[activeRiskFactor]?.technical}
                    </p>
                  </div>
                  <div className="bg-indigo-950/20 p-2 rounded border border-indigo-900/20">
                    <span className="font-semibold text-indigo-300 block mb-1">What does this mean for you?</span>
                    <p className="text-indigo-200 leading-relaxed font-medium">
                      {riskFactorDescriptions[activeRiskFactor]?.general}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TakeawayBanner 
            technical="The analysis shows a stark stratification in relative risk. Screening patterns (CholCheck, OR 6.49) introduce diagnostic biases[cite: 36]. This is followed closely by primary clinical pathologies like Hypertension (HighBP, OR 5.09) and stroke histories (OR 3.09), showing the cardiovascular burdens associated with metabolic decline[cite: 36, 40]."
            general="Having regular cholesterol checkups has the highest mathematical connection to diabetes, which shows that people who regularly consult physicians are the ones who catch it[cite: 36]! Beyond this, conditions like high blood pressure and difficulty walking are the single biggest biological contributors to high risk[cite: 36, 39]."
          />
        </section>

        {/* --- PART 2: SOCIAL STRATIFICATION --- */}
        <section id="part2" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <DualSectionHeader 
              technicalTitle="Part 2: Social Stratification: Income, Education, and Access"
              generalTitle="Part 2: Society, Money, and Health Disparities"
              technicalDesc="Analyzing the prevalence gradient of diabetes across discrete annual income brackets and educational attainment tiers[cite: 80]. Demonstrating how structural capital operates as a protective health shield."
              generalDesc="This section explores how health is connected to our daily environment, including how much money we make and the level of school we finished[cite: 78, 79]."
            />
          </div>

          {/* SOCIOECONOMIC SLOPES */}
          <div id="slopes" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-1">Socioeconomic Prevalence Slopes</h4>
                <p className="text-xs text-slate-400">
                  Observe how diabetes rates trend downward as household income or school access increases[cite: 80].
                </p>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setSlopeView('income')} 
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${slopeView === 'income' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Household Income
                </button>
                <button 
                  onClick={() => setSlopeView('education')} 
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${slopeView === 'education' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Education Level
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Plotly line graph */}
              <div className="lg:col-span-8 h-[340px]">
                {slopeView === 'income' ? (
                  <Plot
                    data={[{
                      type: 'scatter', mode: 'lines+markers',
                      x: incomeLabels,
                      y: processedData.slope.incomeY,
                      name: 'Income Level',
                      line: { color: '#fbbf24', width: 4 },
                      marker: { size: 10, color: '#d97706' },
                      hovertemplate: 'Income: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                    }]}
                    layout={{
                      font: { color: '#94a3b8', size: 9 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                      xaxis: { title: 'Annual Household Income Bracket', gridcolor: '#1e293b', automargin: true },
                      yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', range: [10, 45] },
                      autosize: true,
                      margin: { l: 50, r: 20, t: 15, b: 50 }
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
                      marker: { size: 10, color: '#0891b2' },
                      hovertemplate: 'Education: %{x}<br>Diabetes Rate: %{y:.1f}%<extra></extra>'
                    }]}
                    layout={{
                      font: { color: '#94a3b8', size: 9 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                      xaxis: { title: 'Highest Level of Education Attained', gridcolor: '#1e293b', automargin: true },
                      yaxis: { title: 'Prevalence of Diabetes (%)', gridcolor: '#1e293b', range: [10, 45] },
                      autosize: true,
                      margin: { l: 50, r: 20, t: 15, b: 50 }
                    }}
                    useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                  />
                )}
              </div>

              {/* Explanatory Double-length column */}
              <div className="lg:col-span-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-4 text-xs">
                <div>
                  <span className="font-extrabold text-slate-400 uppercase block mb-1">
                    {slopeView === 'income' ? 'Income Slope Analysis' : 'Education Slope Analysis'}
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {slopeView === 'income' 
                      ? "This line traces the direct negative association between wealth and health[cite: 92]. Households earning under $10,000 exhibit a massive 42.1% diabetes rate. As income increases, the slope descends in a clear step pattern down to 18.2% for families earning over $75,000[cite: 92]. Each marker represents a localized socioeconomic cohort's diabetic rate[cite: 83]."
                      : "This line represents education as a systemic shield. Patients with no formal schooling show a 41.5% diabetes prevalence[cite: 88]. This rate drops steadily as we progress through elementary and high school levels, bottoming out at 19.8% for college graduates[cite: 88, 93]. Advanced learning is strongly tied to health literacy, lifestyle habits, and occupation quality."
                    }
                  </p>
                </div>
                <div className="bg-indigo-950/20 p-3 rounded border border-indigo-900/20">
                  <span className="font-extrabold text-indigo-300 block mb-1">What does this mean for you?</span>
                  <p className="text-indigo-200 leading-relaxed font-medium">
                    {slopeView === 'income'
                      ? "Health behaves like a ladder. People in the lowest income group have double the rate of diabetes compared to those in the highest group[cite: 92]. Higher income grants families access to fresh foods, safe places to play and exercise, and premium healthcare."
                      : "Finishing school is about more than landing a job—it acts as physical armor[cite: 93]. College graduates have half the rate of diabetes compared to those with limited schooling. More school equips people with health information and structural security."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC RELATIVE BUTTERFLY PLOT */}
          <div id="butterfly" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-1">Relative Behavioral Delta & Barriers Gap</h4>
                <p className="text-xs text-slate-400">
                  Isolating behavioral and financial gaps by plotting the Relative Percentage Difference[cite: 94].
                </p>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setButterflyView('diet')} 
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${butterflyView === 'diet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Diet & Activity
                </button>
                <button 
                  onClick={() => setButterflyView('barriers')} 
                  className={`px-3 py-1.5 text-xs rounded-md font-semibold transition ${butterflyView === 'barriers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Systemic Barriers
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left explanation containing raw rates */}
              <div className="lg:col-span-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-4 text-xs">
                <div>
                  <span className="font-extrabold text-slate-400 uppercase block mb-1">
                    {butterflyView === 'diet' ? 'Isolating Habitual Differences' : 'Quantifying Access Gaps'}
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {butterflyView === 'diet' 
                      ? "To highlight behavioral discrepancies, we divide the diabetic cohort's absolute rate by the healthy cohort's baseline. For example, while 78% of healthy individuals eat veggies daily compared to 65% of diabetics, this represents a 13% relative decrease[cite: 57, 58]. More starkly, the physical activity rate reveals a massive 35% relative drop in the diabetic group[cite: 57, 58]."
                      : "We observe extreme access divides by looking at the relative percentage delta. Diabetics face a 280% relative increase in walking difficulties (38% vs 10%) [cite: 57, 58] and an 87.5% relative increase in avoiding medical consults due to direct cost barriers (15% vs 8%)[cite: 57, 58]."
                    }
                  </p>
                </div>
                <div className="bg-indigo-950/20 p-3 rounded border border-indigo-900/20">
                  <span className="font-extrabold text-indigo-300 block mb-1">What does this mean for you?</span>
                  <p className="text-indigo-200 leading-relaxed font-medium">
                    {butterflyView === 'diet'
                      ? "Healthy individuals are 35% more likely to exercise compared to diabetics. While eating fruits and vegetables or smoking is fairly similar between the groups, the main driver here is regular movement."
                      : "Diabetics struggle with major health challenges: they are nearly 3 times more likely to experience serious mobility problems (difficulty walking) and twice as likely to skip medical care because of expensive bills[cite: 57, 58, 101]."
                    }
                  </p>
                </div>
              </div>

              {/* Butterfly Plot showing relative delta */}
              <div className="lg:col-span-8 h-[320px]">
                <Plot
                  data={[{
                    type: 'bar',
                    orientation: 'h',
                    x: processedData.butterfly[butterflyView].labels.map((lbl, idx) => {
                      const h = processedData.butterfly[butterflyView].healthy[idx];
                      const d = processedData.butterfly[butterflyView].diabetic[idx];
                      return h > 0 ? ((d - h) / h) * 100 : 0;
                    }),
                    y: processedData.butterfly[butterflyView].labels,
                    marker: {
                      color: processedData.butterfly[butterflyView].labels.map((lbl, idx) => {
                        const h = processedData.butterfly[butterflyView].healthy[idx];
                        const d = processedData.butterfly[butterflyView].diabetic[idx];
                        return (d - h) < 0 ? '#10b981' : '#f43f5e';
                      })
                    },
                    hovertemplate: '<b>%{y}</b><br>Relative Delta: %{x:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8', size: 9 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                    xaxis: { title: 'Relative Difference from Healthy Baseline (%)', gridcolor: '#1e293b' },
                    yaxis: { gridcolor: 'transparent' },
                    margin: { l: 150, r: 20, t: 10, b: 45 },
                    autosize: true
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>

            <TakeawayBanner 
              technical="Social determinism strongly dictates medical outcomes. Families with less than $10k annual income suffer a diabetes rate 2.3 times higher than top earners[cite: 92]. Daily behavior gaps are significantly widened by structural barriers like healthcare costs and mobility issues[cite: 101]."
              general="People living on lower incomes or with less access to schooling face double the rate of diabetes compared to those with higher incomes and degrees[cite: 92, 93]. Gaps in physical activity and doctor access are primarily driven by affordability issues, not simply personal choices[cite: 101]."
            />
          </div>
        </section>

        {/* --- PART 3: CLINICAL INTERSECTIONS --- */}
        <section id="part3" className="space-y-8 scroll-mt-20">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <DualSectionHeader 
              technicalTitle="Part 3: Intersecting Conditions & Subjective Wellness"
              generalTitle="Part 3: Chronic Conditions, Weight & Mental Health"
              technicalDesc="Examining cardiovascular overlaps using network flow models[cite: 103]. Modeling continuous BMI distributions across subjective health ratings and tracing Pearson's correlation networks[cite: 51, 109]."
              generalDesc="This section explores how chronic illnesses stack up, how self-reported body weight relates to overall health, and how daily stress can impact your wellness."
            />
          </div>

          {/* COMORBIDITY FLOW NETWORK (SANKEY) */}
          <div id="comorbidity" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <div className="flex justify-between items-start gap-4 mb-2">
              <div>
                <h4 className="text-lg font-bold text-white">The Web of Chronic Conditions</h4>
                <p className="text-xs text-slate-400">
                  Select any cardiovascular condition block below to update the co-occurrence details card.
                </p>
              </div>
              <InfoPopup 
                title="What is a Sankey Diagram?" 
                text="A Sankey diagram is a continuous flow chart showing how items move between groups. Here, the red block represents all diabetic patients on the left[cite: 104]. The flowing bands represent how many of those same patients also have other chronic conditions on the right[cite: 105]."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Interactive nodes menu */}
              <div className="lg:col-span-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-4">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block">
                  Select a Secondary Condition:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(sankeyIntersections).map(cond => (
                    <button 
                      key={cond}
                      onClick={() => setSelectedSankeyNode(cond)}
                      className={`p-2 rounded-lg text-xs font-bold border transition ${selectedSankeyNode === cond ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                    >
                      {cond}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                      {sankeyIntersections[selectedSankeyNode].title}
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {sankeyIntersections[selectedSankeyNode].technical}
                    </p>
                  </div>
                  <div className="bg-indigo-950/20 p-2 rounded border border-indigo-900/20">
                    <span className="text-[11px] font-bold text-indigo-300 block mb-1">What does this mean for you?</span>
                    <p className="text-[11px] text-indigo-200 leading-relaxed font-medium">
                      {sankeyIntersections[selectedSankeyNode].general}
                    </p>
                  </div>
                </div>
              </div>

              {/* Plotly Sankey diagram */}
              <div className="lg:col-span-8 h-[340px]">
                <Plot
                  data={[{
                    type: 'sankey', orientation: 'h',
                    node: { pad: 20, thickness: 30, line: { color: 'transparent', width: 0 }, label: processedData.sankey.nodes, color: ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7', '#10b981'] },
                    link: { source: processedData.sankey.links.source, target: processedData.sankey.links.target, value: processedData.sankey.links.value, color: 'rgba(148, 163, 184, 0.15)' }
                  }]}
                  layout={{ font: { color: '#f8fafc', size: 10 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', margin: { l: 20, r: 120, t: 20, b: 20 }, autosize: true }}
                  useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* SPLIT VIOLIN PLOT */}
          <div id="violins" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h4 className="text-lg font-bold text-white mb-1">Continuous BMI Distributions vs. Self-Reported General Health</h4>
                <p className="text-xs text-slate-400">
                  Observe the full density of weights across general health levels (1 = Excellent, 5 = Poor)[cite: 109].
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
                  onChange={(e) => setMentalHealthDays(parseInt(e.target.value))} 
                  className="w-full accent-indigo-500 cursor-pointer" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Explanatory Left Panel explaining Violin Plots */}
              <div className="lg:col-span-4 bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-4 text-xs">
                <div>
                  <span className="font-extrabold text-slate-400 uppercase block mb-1">
                    What is a Violin Plot?
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    A violin plot is an advanced statistical chart that combines a box plot with a continuous density curve[cite: 113, 115]. While a line graph only shows basic averages, a violin plot maps the entire distribution of weights[cite: 115]. The width of each violin represents where most people's body mass indexes are clustered.
                  </p>
                </div>
                <div className="bg-indigo-950/20 p-3 rounded border border-indigo-900/20">
                  <span className="font-extrabold text-indigo-300 block mb-1">What does this mean for you?</span>
                  <p className="text-indigo-200 leading-relaxed font-medium">
                    Think of a violin shape as a distribution mirror. For people who report 'Excellent' health (Level 1), the violin is widest near a healthy BMI (24)[cite: 113, 115]. For those who report 'Poor' health (Level 5), the shape bulges much higher, showing weight clustering in obese territory[cite: 113, 122]. Adjust the mental health slider to see how weights shift as chronic stress rises[cite: 110].
                  </p>
                </div>
              </div>

              {/* Split Violin Plot */}
              <div className="lg:col-span-8 h-[380px]">
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
          </div>

          {/* COGNITIVE HEATMAP & TRANSLATOR */}
          <div id="heatmap-sec" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full scroll-mt-24">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h4 className="text-lg font-bold text-white">Systemic Connections Map</h4>
                <p className="text-xs text-slate-400">
                  Click any block inside the heatmap to translate that correlation instantly on the right panel[cite: 124, 126].
                </p>
              </div>
              <InfoPopup 
                title="Symmetrical Heatmap Overhaul" 
                text="Standard heatmaps are mirroring duplicates. We removed the duplicating top-right triangle to save cognitive focus. Dark Blue colors represent positive co-occurrences, while Dark Red represents strong inverse relationships[cite: 125, 128]."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Heatmap Graphic */}
              <div className="lg:col-span-7 h-[420px]">
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
                    font: { color: '#94a3b8', size: 8 }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent', 
                    margin: { l: 120, r: 10, t: 10, b: 120 }, 
                    xaxis: { tickangle: -45, automargin: true, gridcolor: 'transparent' }, 
                    yaxis: { autorange: 'reversed', automargin: true, gridcolor: 'transparent' }, 
                    autosize: true 
                  }} 
                  useResizeHandler={true} 
                  style={{ width: '100%', height: '100%' }} 
                  onClick={(data) => {
                    if (data && data.points && data.points[0]) {
                      const clickedVar = data.points[0].y;
                      if (heatmapVariables.includes(clickedVar)) {
                        setTranslatorVar(clickedVar);
                      }
                    }
                  }}
                />
              </div>

              {/* Translator panel */}
              <div className="lg:col-span-5 bg-slate-950/60 p-5 border border-slate-800 rounded-xl flex flex-col justify-between h-[380px]">
                <div>
                  <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Interactive Translator Tool</span>
                  <h5 className="text-base font-bold text-white mt-1">Correlation Translator</h5>
                  <p className="text-[11px] text-slate-400 mt-1">Select a variable below or click the heatmap to translate the relationships[cite: 133].</p>
                  
                  <select 
                    value={translatorVar} 
                    onChange={(e) => setTranslatorVar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 mt-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {heatmapVariables.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>

                  <div className="space-y-2 mt-4 max-h-[190px] overflow-y-auto pr-1">
                    {correlationTranslations[translatorVar].map((bullet, idx) => (
                      <div key={idx} className="flex gap-2.5 items-start bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                        <p className="text-[11px] text-slate-300 leading-relaxed">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Heatmap Legend */}
            <div className="mt-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">How to Read the Color Mapping:</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px]">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-600 rounded-sm" />
                  <div>
                    <span className="font-bold text-blue-400 block">Deep Blue (+0.25 to +1.00)</span>
                    <span className="text-slate-400">Strong Co-occurrence (conditions that scale and rise together, e.g. age and blood pressure).</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-slate-100 rounded-sm border border-slate-300" />
                  <div>
                    <span className="font-bold text-slate-200 block">White/Light Blue (-0.10 to +0.10)</span>
                    <span className="text-slate-400">Statistical Independence (no direct or meaningful connection between factors).</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-600 rounded-sm" />
                  <div>
                    <span className="font-bold text-red-400 block">Deep Red (-0.10 to -1.00)</span>
                    <span className="text-slate-400">Inverse Relationship (socioeconomic shielding / protective factors like income reducing risk).</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TakeawayBanner 
            technical="Clinical comorbidity is standard: Diabetes presents alongside hypertension in 75% of cases and hypercholesterolemia in 67%[cite: 59, 108]. Violin densities demonstrate that poorer subjective health relates systematically to elevated continuous BMI indexes, which is heavily influenced by stress[cite: 122, 123]."
            general="Diabetes almost never exists alone; it regularly occurs alongside high blood pressure or high cholesterol[cite: 108]. Our self-ratings of health align closely with our physical body weights—and having high mental stress or depression significantly shifts overall weight averages upward[cite: 110, 123]."
          />
        </section>

      </div>
    </div>
  );
}