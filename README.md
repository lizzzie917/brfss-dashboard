# Analyzing Metabolic Risk and Systemic Barriers in Diabetes (BRFSS Dataset Analysis)

An interactive, optimized React single-page data architecture designed to parse, compute, and visualize 70,000 health records from the CDC's Behavioral Risk Factor Surveillance System (BRFSS). The platform serves as a multi-audience data storytelling experience that transitions seamlessly from micro-level personal risks to macro-level systemic health inequities.

Live Site: https://brfss-dashboard.vercel.app/

---

## Core Data Storytelling Framework: The Three Lenses

The interface rejects standard data dumps in favor of a guided narrative broken down into three multi-dimensional perspectives:

### Lens 1: The Patient Perspective (Micro-Focus)
*Focusing on individual health metrics and compounding clinical risks.*
*   **1.1 | The Risk Close-Up (Forest Plot):** Visualizes how personal baseline vulnerabilities multiply when specific clinical conditions are present. Uses calculated epidemiological odds ratios with 95% confidence intervals.
*   **1.2 | The Behavior Portrait (Habits Butterfly Chart):** A mirrored horizontal comparison profiling the active daily habits (diet, smoking, exercise) of non-diabetic versus diabetic populations.

### Lens 2: The Policy Perspective (Wide-Angle)
*Examining structural, environmental, and financial barriers shaping public wellness.*
*   **2.1 | The Socioeconomic Panorama (Gradient Slope):** Traces the direct, step-by-step impact of household income scales and educational achievement against rising rates of chronic disease.
*   **2.2 | The Structural Landscape (Access Barriers Butterfly):** Highlights the systemic physical and financial walls preventing care, such as continuous medication/doctor affordability and physical mobility issues.

### Lens 3: The Clinical Perspective (Deep-Focus)
*Peering underneath clinical data layers to isolate interconnected pathologies and statistical correlations.*
*   **3.1 | The Comorbidity Cross-Section (Sankey Flow):** Maps the continuous paths and secondary cardiovascular failures (high blood pressure, stroke, heart disease) branching directly out of a diabetes diagnosis.
*   **3.2 | The Subjective vs. Physical Spectrum (Raincloud Plot):** Combines raw jittered scatter data, high-density violin curves, and moving trend lines to contrast absolute physical markers (BMI) against subjective wellness states. Fully responsive to active mental health filters.
*   **3.3 | The High-Resolution Connection Matrix (Masked Staircase Heatmap):** A clean statistical grid that masks duplicate mirrors and self-correlations to cut visual noise. Paired with an interactive, plain-English translation interface.

---

## The Tech Stack

*   **Core Framework:** React 18 & Vite (HMR enabled)
*   **Data Ingestion Engine:** PapaParse (Streaming client-side CSV processor)
*   **Visualization Engine:** React-Plotly.js (Built on D3.js data vectors)
*   **Styling & UI Architecture:** Tailwind CSS (Deep dark mode system design)
*   **Iconography:** Lucide React

---

## Computational Pipelines & Engine Design

To eliminate database costs and keep interactions instantaneous, all statistical models operate strictly within optimized client-side lifecycle blocks:

1.  **Asynchronous Local Streaming:** Data is ingested directly via the browser client thread. PapaParse handles automated data-type inference dynamically, skipping empty lines to prevent payload parsing failures.
2.  **Isolated Computation Hooks (useMemo):** Heavy statistical loops (matrix creation, sample stratification, trend evaluations) are bound within isolated caching hooks. Calculations trigger only when state variables (like mental health thresholds) change, keeping interface transitions locked at 60 FPS.
3.  **Custom Pearson Correlation Pipeline:** Iterates over variable arrays to dynamically yield mathematical correlation matrices (r). Features structural row masking that substitutes upper-triangle arrays with null fields to achieve a clean diagonal layout.
4.  **Epidemiological Risk Modeling:** Dynamically calculates live cross-tabulation vectors to produce relative odds ratios along with standard errors (SE) and confidence bounds on the fly.

---

## Getting Started (Local Setup)

Follow these steps to run the dataset and dashboard locally on your hard drive:

### 1. Clone the repository
```bash
git clone [https://github.com/lizzzie917/brfss-dashboard.git](https://github.com/lizzzie917/brfss-dashboard.git)
cd brfss-dashboard