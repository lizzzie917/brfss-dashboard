import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';
import { 
  Activity, Info, HeartPulse, TrendingDown, Users, 
  Stethoscope, ShieldAlert, Brain, Award, DollarSign
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
  return { or, error: upper - or, lower, upper };
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

// Contextual definitions for risk factors when clicked in the Forest Plot
const clinicalRiskDetails = {
  'High Blood Pressure': {
    metric: "HighBP",
    definition: "Systolic blood pressure >= 130 mmHg or diastolic >= 80 mmHg. In this BRFSS cohort, High BP is the single strongest co-occurring marker.",
    recommendation: "Target blood pressure control < 130/80 through a combination of low-sodium intake, aerobic exercise, and first-line clinical therapies like ACE inhibitors."
  },
  'High Cholesterol': {
    metric: "HighChol",
    definition: "Ever told by a health professional that blood cholesterol is high. Direct link to elevated low-density lipoprotein (LDL).",
    recommendation: "Focus on unsaturated fat dietary profiles, regular lipid panel screening every 1-2 years, and active statin therapy when calculated cardiovascular risk exceeds 7.5%."
  },
  'Smoker': {
    metric: "Smoker",
    definition: "Having smoked at least 100 cigarettes (5 packs) in your lifetime. Smoking compounds arterial damage, accelerating macrovascular complications.",
    recommendation: "Deploy combination Nicotine Replacement Therapy (NRT) alongside structured cognitive behavioral therapy (CBT) to reduce compound cardiovascular risks."
  },
  'Heart Disease': {
    metric: "HeartDiseaseorAttack",
    definition: "History of coronary heart disease (CHD) or myocardial infarction (MI). Signifies advanced atherosclerotic buildup.",
    recommendation: "Ensure aggressive dual antiplatelet therapy (DAPT), high-intensity statins, and supervised cardiac rehabilitation programs to manage metabolic risks."
  }
};

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

// --- REUSABLE ANNOTATIVE COMPONENTS ---
const InfoPopup = ({ title, text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-2 text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 text-xs bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20"
      >
        <Info size={12} /> What does this mean?
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 w-72 p-4 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl text-xs text-slate-200">
          <strong className="block text-indigo-400 mb-1">{title}</strong>
          {text}
        </div>
      )}
    </div>
  );
};

const TakeawayBanner = ({ text }) => (
  <div className="mt-4 p-4 bg-slate-800/50 border-l-4 border-indigo-500 rounded-r-lg text-slate-300 text-sm leading-relaxed">
    <span className="font-bold text-slate-100 uppercase text-xs tracking-wider mr-2">Key Takeaway:</span>
    {text}
  </div>
);

export default function App() {
  const [dataset, setDataset] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Chart Controls
  const [butterflyView, setButterflyView] = useState('diet'); 
  const [slopeView, setSlopeView] = useState('income');
  const [translatorVar, setTranslatorVar] = useState('Diabetes Diagnosis');
  const [mentalHealthDays, setMentalHealthDays] = useState(0);
  const [raincloudMetric, setRaincloudMetric] = useState('BMI'); // BMI or PhysHlth
  const [selectedRiskKey, setSelectedRiskKey] = useState('High Blood Pressure');

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

    const stats = {
      healthy: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 },
      diabetic: { total: 0, smoker: 0, physAct: 0, fruits: 0, veggies: 0, noDoc: 0, diffWalk: 0 }
    };
    const incomeStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0}, 7:{t:0, d:0}, 8:{t:0, d:0} };
    const eduStats = { 1:{t:0, d:0}, 2:{t:0, d:0}, 3:{t:0, d:0}, 4:{t:0, d:0}, 5:{t:0, d:0}, 6:{t:0, d:0} };
    const vars = { Diabetes: [], BP: [], Chol: [], BMI: [], Age: [], GenHlth: [], Income: [], Edu: [] };
    
    const orStats = { 
      bp: { ed: 0, eh: 0, ud: 0, uh: 0 }, 
      chol: { ed: 0, eh: 0, ud: 0, uh: 0 }, 
      smoker: { ed: 0, eh: 0, ud: 0, uh: 0 }, 
      heart: { ed: 0, eh: 0, ud: 0, uh: 0 } 
    };
    let d_bp = 0, d_chol = 0, d_heart = 0, d_stroke = 0;
    
    // Setup Raincloud dynamic metric processing
    const raincloud = {
      gen1: { BMI: [], PhysHlth: [] },
      gen2: { BMI: [], PhysHlth: [] },
      gen3: { BMI: [], PhysHlth: [] },
      gen4: { BMI: [], PhysHlth: [] },
      gen5: { BMI: [], PhysHlth: [] }
    };

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

      if (row.HighBP === 1) { 
        isDiabetic ? orStats.bp.ed++ : orStats.bp.eh++;
      } else { 
        isDiabetic ? orStats.bp.ud++ : orStats.bp.uh++; 
      }
      if (row.HighChol === 1) { 
        isDiabetic ? orStats.chol.ed++ : orStats.chol.eh++; 
      } else { 
        isDiabetic ? orStats.chol.ud++ : orStats.chol.uh++;
      }
      if (row.Smoker === 1) { 
        isDiabetic ? orStats.smoker.ed++ : orStats.smoker.eh++;
      } else { 
        isDiabetic ? orStats.smoker.ud++ : orStats.smoker.uh++; 
      }
      if (row.HeartDiseaseorAttack === 1) { 
        isDiabetic ? orStats.heart.ed++ : orStats.heart.eh++; 
      } else { 
        isDiabetic ? orStats.heart.ud++ : orStats.heart.uh++;
      }

      if (isDiabetic) {
        if (row.HighBP === 1) d_bp++;
        if (row.HighChol === 1) d_chol++; 
        if (row.HeartDiseaseorAttack === 1) d_heart++; 
        if (row.Stroke === 1) d_stroke++;
      }

      // Sample raincloud data to prevent rendering bottleneck in UI
      if (includeInRaincloud && row.GenHlth >= 1 && row.GenHlth <= 5 && index % 12 === 0) {
        raincloud[`gen${row.GenHlth}`].BMI.push(row.BMI);
        raincloud[`gen${row.GenHlth}`].PhysHlth.push(row.PhysHlth);
      }
    });

    const calcPct = (c, t) => t > 0 ? (c / t) * 100 : 0;
    
    // Symmetrical Overhaul: Lower triangle correlation matrix calculation
    const varArrays = [vars.Diabetes, vars.BP, vars.Chol, vars.BMI, vars.Age, vars.GenHlth, vars.Income, vars.Edu];
    const zMatrix = [];
    for (let i = 0; i < varArrays.length; i++) {
      const r = [];
      for (let j = 0; j < varArrays.length; j++) {
        if (j <= i) {
          r.push(getPearson(varArrays[i], varArrays[j]));
        } else {
          r.push(null); // Mask upper diagonal
        }
      }
      zMatrix.push(r);
    }

    // Dynamic Raincloud Means
    const raincloudMeansBMI = [1, 2, 3, 4, 5].map(lvl => {
      const arr = raincloud[`gen${lvl}`].BMI;
      return arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });

    const raincloudMeansPhys = [1, 2, 3, 4, 5].map(lvl => {
      const arr = raincloud[`gen${lvl}`].PhysHlth;
      return arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });

    return {
      raincloud,
      raincloudMeansBMI,
      raincloudMeansPhys,
      totalCount: dataset.length,
      heatmap: { z: zMatrix, labels: heatmapVariables },
      slope: {
        incomeY: [1, 2, 3, 4, 5, 6, 7, 8].map(l => calcPct(incomeStats[l].d, incomeStats[l].t)),
        eduY: [1, 2, 3, 4, 5, 6].map(l => calcPct(eduStats[l].d, eduStats[l].t))
      },
      butterfly: {
        diet: {
          labels: ['Eats Veggies Daily', 'Eats Fruit Daily', 'Active (30 Days)', 'Current/Ex Smoker'],
          healthy: [
            calcPct(stats.healthy.veggies, stats.healthy.total), 
            calcPct(stats.healthy.fruits, stats.healthy.total), 
            calcPct(stats.healthy.physAct, stats.healthy.total), 
            calcPct(stats.healthy.smoker, stats.healthy.total)
          ],
          diabetic: [
            calcPct(stats.diabetic.veggies, stats.diabetic.total), 
            calcPct(stats.diabetic.fruits, stats.diabetic.total), 
            calcPct(stats.diabetic.physAct, stats.diabetic.total), 
            calcPct(stats.diabetic.smoker, stats.diabetic.total)
          ]
        },
        barriers: {
          labels: ['Difficulty Walking', 'Cannot Afford Doctor Visit'],
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
        bp: calcOR(orStats.bp.ed, orStats.bp.eh, orStats.bp.ud, orStats.bp.uh),
        chol: calcOR(orStats.chol.ed, orStats.chol.eh, orStats.chol.ud, orStats.chol.uh),
        smoker: calcOR(orStats.smoker.ed, orStats.smoker.eh, orStats.smoker.ud, orStats.smoker.uh),
        heart: calcOR(orStats.heart.ed, orStats.heart.eh, orStats.heart.ud, orStats.heart.uh)
      },
      sankey: {
        nodes: [
          'Diabetes Cohort (n=35,346)', 
          'Co-Occurring High BP', 
          'Co-Occurring High Chol', 
          'Heart Disease/Attack', 
          'Prior Stroke History'
        ],
        links: { 
          source: [0, 0, 0, 0], 
          target: [1, 2, 3, 4], 
          value: [d_bp, d_chol, d_heart, d_stroke] 
        }
      }
    };
  }, [dataset, mentalHealthDays]);

  if (isLoading || !processedData) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center flex-col gap-6">
        <Activity className="animate-spin text-indigo-500" size={64} />
        <h2 className="text-2xl font-bold mb-2">Ingesting 70,692 CDC Health Records...</h2>
        <p className="text-sm text-slate-400">Loading balanced 50-50 BRFSS demographic matrices</p>
      </div>
    );
  }

  // Calculate live cumulative relative risk 
  let cumulativeRisk = 1.0;
  if (calcRisks.bp) cumulativeRisk *= processedData.odds.bp.or;
  if (calcRisks.chol) cumulativeRisk *= processedData.odds.chol.or;
  if (calcRisks.smoker) cumulativeRisk *= processedData.odds.smoker.or;
  if (calcRisks.heart) cumulativeRisk *= processedData.odds.heart.or;

  // Click handler for heatmap integration with translator
  const handleHeatmapClick = (eventData) => {
    if (eventData.points && eventData.points[0]) {
      const clickedX = eventData.points[0].x;
      const clickedY = eventData.points[0].y;
      // Primary select the variable clicked
      if (heatmapVariables.includes(clickedX)) {
        setTranslatorVar(clickedX);
      } else if (heatmapVariables.includes(clickedY)) {
        setTranslatorVar(clickedY);
      }
    }
  };

  // Click handler for forest plot marker active panel
  const handleForestClick = (eventData) => {
    if (eventData.points && eventData.points[0]) {
      const activeLabel = eventData.points[0].y;
      if (clinicalRiskDetails[activeLabel]) {
        setSelectedRiskKey(activeLabel);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-y-auto">
      
      {/* NARRATIVE HEADER */}
      <header className="max-w-4xl mx-auto pt-16 pb-8 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-xs font-bold uppercase tracking-widest mb-4">
          <Activity size={12} /> CDC BRFSS 2015 Deep-Dive
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
          Understanding Metabolic Health
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          An interactive, data-backed cohort study mapping {processedData.totalCount.toLocaleString()} real CDC health indicators. Toggle parameters below to explore compound risks, disparities, and system interactions.
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-16">

        {/* --- SECTION 1: CITIZENS (PERSONAL RISK) --- */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <HeartPulse className="text-rose-500" /> Part 1: Your Personal Risk Factors
            </h2>
            <p className="text-slate-400 mt-2">Interact with the calculator checklist to watch live odds ratios compound baseline susceptibility.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col lg:flex-row">
            {/* Calculator Panel */}
            <div className="w-full lg:w-1/3 bg-slate-800/50 p-6 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldAlert size={18} className="text-indigo-400" /> Risk Combos</h3>
                <p className="text-xs text-slate-400 mt-1">Check individual clinical histories to calculate cumulative odds relative to standard population controls.</p>
              </div>
              <div className="space-y-3">
                {Object.keys(calcRisks).map(key => (
                  <label key={key} className="flex items-center justify-between p-3 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition bg-slate-900">
                    <span className="font-semibold text-slate-200 text-sm">
                      {key === 'bp' ? 'High BP' : key === 'chol' ? 'High Cholesterol' : key === 'smoker' ? 'Active Smoker' : 'Heart Disease'}
                    </span>
                    <input 
                      type="checkbox" 
                      checked={calcRisks[key]} 
                      onChange={() => toggleRisk(key)} 
                      className="w-5 h-5 checked:bg-indigo-500 rounded accent-indigo-500 cursor-pointer" 
                    />
                  </label>
                ))}
              </div>
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Compounded Risk Score</p>
                <p className="text-4xl font-black text-indigo-400 mt-1">{cumulativeRisk.toFixed(2)}x</p>
                <p className="text-[10px] text-slate-400 mt-1">likelihood of co-presenting diabetes</p>
              </div>
            </div>

            {/* Forest Plot with Active Panel Explorer */}
            <div className="w-full lg:w-2/3 p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white">How Specific Diagnoses Amplify Risk</h3>
                  <InfoPopup 
                    title="Odds Ratios and Error Bars" 
                    text="The points represent the specific odds ratios. The horizontal lines denote 95% confidence intervals. Click directly on any blue marker to display localized clinical definitions and targeted health tips below."
                  />
                </div>
                <div className="w-full h-[280px]">
                  <Plot
                    data={[{
                      type: 'scatter', 
                      mode: 'markers',
                      x: [processedData.odds.bp.or, processedData.odds.chol.or, processedData.odds.smoker.or, processedData.odds.heart.or],
                      y: ['High Blood Pressure', 'High Cholesterol', 'Smoker', 'Heart Disease'],
                      error_x: { 
                        type: 'data', 
                        symmetric: true, 
                        array: [processedData.odds.bp.error, processedData.odds.chol.error, processedData.odds.smoker.error, processedData.odds.heart.error], 
                        color: '#818cf8', 
                        thickness: 2.5, 
                        width: 8 
                      },
                      marker: { size: 14, color: '#4f46e5', line: { color: '#818cf8', width: 1.5 } },
                      text: [
                        `Odds: ${processedData.odds.bp.or.toFixed(2)}x`, 
                        `Odds: ${processedData.odds.chol.or.toFixed(2)}x`, 
                        `Odds: ${processedData.odds.smoker.or.toFixed(2)}x`, 
                        `Odds: ${processedData.odds.heart.or.toFixed(2)}x`
                      ],
                      hovertemplate: '<b>%{y}</b><br>Odds Ratio: %{x:.2f}x<br>Click to expand<extra></extra>'
                    }]}
                    layout={{ 
                      font: { color: '#94a3b8', size: 11 }, 
                      paper_bgcolor: 'transparent', 
                      plot_bgcolor: 'transparent', 
                      xaxis: { title: 'Relative Risk (Log odds multiplier scale)', gridcolor: '#1e293b' }, 
                      yaxis: { gridcolor: 'transparent' }, 
                      shapes: [{ 
                        type: 'line', 
                        x0: 1, x1: 1, 
                        y0: -0.5, y1: 3.5, 
                        line: { color: '#f43f5e', dash: 'dash', width: 2 } 
                      }], 
                      margin: { l: 150, r: 20, t: 10, b: 40 }, 
                      autosize: true 
                    }}
                    onClick={handleForestClick}
                    useResizeHandler={true} 
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </div>

              {/* Active Clinical Tip Panel */}
              <div className="mt-4 p-4 bg-slate-850 border border-slate-700/60 rounded-xl">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-2 mb-2">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                    <Stethoscope size={14} /> Selected Metric: {selectedRiskKey}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-black">Interactive Panel</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-semibold mb-1">
                  {clinicalRiskDetails[selectedRiskKey]?.definition}
                </p>
                <p className="text-xs text-indigo-300 leading-relaxed">
                  <span className="font-bold">Interventional Recommendation:</span> {clinicalRiskDetails[selectedRiskKey]?.recommendation}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- SECTION 2: POLICYMAKERS (EQUITY & BARRIERS) --- */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-amber-500" /> Part 2: Socioeconomic & Systemic Barriers
            </h2>
            <p className="text-slate-400 mt-2">Health pathways are shaped by income and access. Track structural inequalities across populations.</p>
          </div>

          {/* Socioeconomic Slope with Split Tabs */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Stratified Prevalence Slopes</h3>
                <p className="text-sm text-slate-400">Comparing diabetes prevalence against socioeconomic metrics.</p>
              </div>
              <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button 
                  onClick={() => setSlopeView('income')} 
                  className={`px-4 py-2 text-sm rounded-md font-medium transition-all duration-200 ${slopeView === 'income' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <span className="flex items-center gap-1.5"><DollarSign size={14}/> Household Income</span>
                </button>
                <button 
                  onClick={() => setSlopeView('education')} 
                  className={`px-4 py-2 text-sm rounded-md font-medium transition-all duration-200 ${slopeView === 'education' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <span className="flex items-center gap-1.5"><Award size={14}/> Education Level</span>
                </button>
              </div>
            </div>

            <div className="w-full h-[400px]">
              {slopeView === 'income' ? (
                <Plot
                  data={[{
                    type: 'scatter', 
                    mode: 'lines+markers',
                    x: incomeLabels,
                    y: processedData.slope.incomeY,
                    name: 'Income Level',
                    line: { color: '#fbbf24', width: 4, shape: 'spline' },
                    marker: { size: 10, color: '#d97706', border: { color: '#ffffff', width: 2 } },
                    hovertemplate: 'Income Bracket: %{x}<br>Diabetes Prevalence: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent',
                    xaxis: { title: 'Annual Household Income Bracket', gridcolor: '#1e293b', automargin: true },
                    yaxis: { title: 'Calculated Prevalence of Diabetes (%)', gridcolor: '#1e293b', range: [10, 45] },
                    autosize: true
                  }}
                  useResizeHandler={true} 
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Plot
                  data={[{
                    type: 'scatter', 
                    mode: 'lines+markers',
                    x: educationLabels,
                    y: processedData.slope.eduY,
                    name: 'Education Level',
                    line: { color: '#22d3ee', width: 4, shape: 'spline' },
                    marker: { size: 10, color: '#0891b2', border: { color: '#ffffff', width: 2 } },
                    hovertemplate: 'Education level: %{x}<br>Diabetes Prevalence: %{y:.1f}%<extra></extra>'
                  }]}
                  layout={{
                    font: { color: '#94a3b8' }, 
                    paper_bgcolor: 'transparent', 
                    plot_bgcolor: 'transparent',
                    xaxis: { title: 'Highest Level of Education Attained', gridcolor: '#1e293b', automargin: true },
                    yaxis: { title: 'Calculated Prevalence of Diabetes (%)', gridcolor: '#1e293b', range: [10, 45] },
                    autosize: true
                  }}
                  useResizeHandler={true} 
                  style={{ width: '100%', height: '100%' }}
                />
              )}
            </div>
            <TakeawayBanner text={slopeView === 'income' ?
              "A stark, stepped socioeconomic slope: households earning under $10,000 annually show over double the prevalence rate of diabetes (roughly 38%) compared to secure households earning over $75,000 (roughly 15%)."
              : "Education operates as a critical protective factor. Populations holding college degrees (Level 6) exhibit a heavily diminished rate of diabetes compared to those who did not complete standard high school profiles."} 
            />
          </div>

          {/* Behavioral / Barriers Butterfly */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Behavioral Realities vs. Access Barriers</h3>
                <p className="text-sm text-slate-400">Comparing populations: Healthy (Green, left side) vs Diabetic (Red, right side).</p>
              </div>
              <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button 
                  onClick={() => setButterflyView('diet')} 
                  className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${butterflyView === 'diet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Diet & Activity
                </button>
                <button 
                  onClick={() => setButterflyView('barriers')} 
                  className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${butterflyView === 'barriers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Systemic Obstacles
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
                    name: 'Healthy Control Group', 
                    marker: { color: '#10b981' }, 
                    customdata: processedData.butterfly[butterflyView].healthy, 
                    hovertemplate: '%{y} (Healthy)<br>Prevalence Rate: %{customdata:.1f}%<extra></extra>' 
                  },
                  { 
                    type: 'bar', 
                    x: processedData.butterfly[butterflyView].diabetic, 
                    y: processedData.butterfly[butterflyView].labels, 
                    orientation: 'h', 
                    name: 'Diabetic Population', 
                    marker: { color: '#f43f5e' }, 
                    hovertemplate: '%{y} (Diabetic)<br>Prevalence Rate: %{x:.1f}%<extra></extra>' 
                  }
                ]}
                layout={{ 
                  barmode: 'relative', 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  margin: { l: 220, r: 20, t: 20, b: 40 }, 
                  xaxis: { 
                    range: [-100, 100], 
                    tickvals: [-100, -50, 0, 50, 100], 
                    ticktext: ['100%', '50%', '0%', '50%', '100%'], 
                    gridcolor: '#1e293b' 
                  }, 
                  yaxis: { gridcolor: 'transparent' }, 
                  autosize: true 
                }}
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text={butterflyView === 'diet' ? 
              "Regular physical exercise displays a substantial gap: over 80% of the healthy cohort is active compared to only 60% of the diabetic cohort. Daily fruit/veggie intake shows smaller, marginal gaps."
              : "Access dynamics are highly uneven. Diabetic populations exhibit triple the rate of physical ambulatory limitations (DiffWalk, over 37% vs 11%) and face much higher financial barriers to seeing doctors."} 
            />
          </div>
        </section>

        {/* --- SECTION 3: CLINICIANS (OVERLAPS & CORRELATIONS) --- */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4 mt-16 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Stethoscope className="text-blue-500" /> Part 3: Clinical Intersections & Statistics
            </h2>
            <p className="text-slate-400 mt-2">Track disease co-occurrence and clinical metrics using interactive visual networks.</p>
          </div>

          {/* Comorbidity Network */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-white">The Web of Chronic Conditions</h3>
              <InfoPopup 
                title="Comorbidity Sankey Flow" 
                text="This visualization maps how the 35,346 diabetic individuals in this dataset co-present with other serious ailments. The pathways connect diabetes directly to high blood pressure, cholesterol, heart disease, and strokes." 
              />
            </div>
            <div className="w-full h-[400px] mt-4">
              <Plot
                data={[{
                  type: 'sankey', 
                  orientation: 'h',
                  node: { 
                    pad: 20, 
                    thickness: 30, 
                    line: { color: 'transparent', width: 0 }, 
                    label: processedData.sankey.nodes, 
                    color: ['#f43f5e', '#38bdf8', '#fbbf24', '#a855f7', '#10b981'] 
                  },
                  link: { 
                    source: processedData.sankey.links.source, 
                    target: processedData.sankey.links.target, 
                    value: processedData.sankey.links.value, 
                    color: 'rgba(148, 163, 184, 0.15)' 
                  }
                }]}
                layout={{ 
                  font: { color: '#f8fafc', size: 12 }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  margin: { l: 20, r: 160, t: 20, b: 20 }, 
                  autosize: true 
                }}
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text="Metabolic diseases rarely present in isolation. Notice the enormous flow directly connecting the diabetes cohort to High Blood Pressure (approx. 74% co-occurrence) and High Cholesterol (approx. 67%), highlighting the vital need for integrated cardiovascular-metabolic therapies." />
          </div>

          {/* Raincloud Plot with Metric Selector */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Density Distributions vs. General Health</h3>
                <p className="text-sm text-slate-400">Examine how self-reported wellness (1 = Excellent, 5 = Poor) maps onto physiological and mental indicators.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
                {/* Metric Selector Toggle */}
                <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
                  <button 
                    onClick={() => setRaincloudMetric('BMI')} 
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${raincloudMetric === 'BMI' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Body Mass Index
                  </button>
                  <button 
                    onClick={() => setRaincloudMetric('PhysHlth')} 
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${raincloudMetric === 'PhysHlth' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Physical Health Days
                  </button>
                </div>

                {/* Bad Mental Health Day Filter */}
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 w-full sm:w-64">
                  <label className="flex justify-between text-xs text-slate-300 font-medium mb-2">
                    <span>Min Bad Mental Health Days:</span>
                    <span className="text-blue-400 font-bold">{mentalHealthDays} days</span>
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
                    const values = processedData.raincloud[`gen${lvl}`][raincloudMetric];
                    return {
                      type: 'violin', 
                      x: Array(values.length).fill(`Level ${lvl}`), 
                      y: values,
                      name: `Health Level ${lvl}`, 
                      points: 'all', 
                      pointpos: -0.5, 
                      jitter: 0.6, 
                      side: 'positive',
                      box: { visible: true, width: 0.15, line: { color: '#ffffff' } }, // Embedded Box Plot
                      line: { color: colors[idx], width: 2 }, 
                      marker: { size: 3, opacity: 0.2, color: '#94a3b8' }, 
                      meanline: { visible: true, width: 3, color: '#ffffff' }, 
                      hovertemplate: 'Self-Rating: Level ' + lvl + '<br>Val: %{y:.1f}<extra></extra>'
                    };
                  }),
                  {
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
                    y: raincloudMetric === 'BMI' ? processedData.raincloudMeansBMI : processedData.raincloudMeansPhys,
                    name: 'Average Trendline',
                    line: { color: '#ffffff', width: 4, dash: 'solid' },
                    marker: { size: 10, color: '#fbbf24', line: { color: '#ffffff', width: 2 } },
                    hovertemplate: 'Average: %{y:.1f}<extra></extra>'
                  }
                ]}
                layout={{ 
                  font: { color: '#94a3b8' }, 
                  paper_bgcolor: 'transparent', 
                  plot_bgcolor: 'transparent', 
                  xaxis: { title: 'Self-Reported General Health Rating (1 = Excellent, 5 = Poor)', gridcolor: '#1e293b' }, 
                  yaxis: { 
                    title: raincloudMetric === 'BMI' ? 'BMI (Body Mass Index)' : 'Bad Physical Health Days (past 30 days)', 
                    gridcolor: '#1e293b', 
                    range: raincloudMetric === 'BMI' ? [12, 55] : [-1, 31] 
                  }, 
                  showlegend: false, 
                  autosize: true 
                }}
                useResizeHandler={true} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <TakeawayBanner text={raincloudMetric === 'BMI' ? 
              "Clear physical manifestation: as self-reported health degrades, the average BMI systematically climbs from 26.2 to 32.4 (obese territory). Chronic high-density scatter reveals a deep reservoir of high-BMI outliers in 'Fair' and 'Poor' bands."
              : "Severe functional limitations: individuals reporting poor general health (Level 5) average over 22 bad physical health days a month, compared to less than 1 day in the excellent category (Level 1)."} 
            />
          </div>

          {/* Staircase Heatmap + Interactive Plain English Translator */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Systemic Connections Map</h3>
                <p className="text-sm text-slate-400">A stair-step heatmap of clinical and social relationships, paired with an interactive translator panel.</p>
              </div>
              <InfoPopup 
                title="Symmetrical Overhaul" 
                text="Traditional correlation grids duplicate data along the diagonal. Here, the upper half is masked to cut visual noise. Click directly on any tile inside the heatmap to automatically load the corresponding English translations on the right!"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Symmetrical Correlation Heatmap */}
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
                    hovertemplate: 'Var A: %{x}<br>Var B: %{y}<br>Pearson r: %{z:.2f}<extra></extra>'
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
                  onClick={handleHeatmapClick}
                  useResizeHandler={true} 
                  style={{ width: '100%', height: '100%' }} 
                />
              </div>

              {/* The Plain-English Translator Column */}
              <div className="lg:col-span-5 bg-slate-800/40 p-6 border border-slate-700/50 rounded-xl flex flex-col justify-start">
                <div className="mb-4">
                  <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Interactive Translator</span>
                  <h4 className="text-lg font-bold text-white mt-1">Correlation Details</h4>
                  <p className="text-xs text-slate-400 mt-1">Select a variable below—or click directly on any square in the heatmap—to decipher its clinical relationships.</p>
                </div>

                <select 
                  value={translatorVar} 
                  onChange={(e) => setTranslatorVar(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 cursor-pointer font-semibold"
                >
                  {heatmapVariables.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                <div className="space-y-4">
                  {correlationTranslations[translatorVar]?.map((bullet, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-slate-300 leading-relaxed font-semibold">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TakeawayBanner text="Social circumstances shape health profiles. The massive negative correlation (-0.37) between General Health and Income indicates that wealth is highly predictive of subjective physical health. Strong education-to-income linkages (+0.42) confirm that academic access remains a primary gateway to health security." />
          </div>

        </section>
      </div>
    </div>
  );
}