// src/App.jsx
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getHospitals, getYears, runFraudCheck } from "./fraudApi";

const COLORS = ["#FF4D4F", "#52C41A", "#FFA940"]; // High / Low / Medium

const QUARTERS = [
  { value: "", label: "Full year" },
  { value: 1, label: "Q1" },
  { value: 2, label: "Q2" },
  { value: 3, label: "Q3" },
  { value: 4, label: "Q4" },
];

export default function App() {
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [hospitalsError, setHospitalsError] = useState("");

  const [years, setYears] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [year, setYear] = useState(null);
  const [quarter, setQuarter] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ------------------------------------------------------------
  // Load hospitals + years on mount
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      try {
        setHospitalsLoading(true);
        setHospitalsError("");
        const [hospitalList, yearList] = await Promise.all([
          getHospitals(),
          getYears(),
        ]);

        setHospitals(hospitalList);
        setYears(yearList);

        if (hospitalList.length > 0) {
          setSelectedHospital(hospitalList[0].id);
        }
        if (yearList.length > 0) {
          // Default to latest year from data
          setYear(yearList[yearList.length - 1]);
        }
      } catch (err) {
        console.error(err);
        setHospitalsError(
          "Failed to load hospitals or years from backend."
        );
      } finally {
        setHospitalsLoading(false);
      }
    }

    loadData();
  }, []);

  // ------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------
  async function handleRun() {
    if (!selectedHospital || !year) {
      setError("Please select a hospital and year.");
      return;
    }
    try {
      setLoading(true);
      setError("");

      const q = quarter === "" ? undefined : Number(quarter);
      const data = await runFraudCheck({
        hospitalId: selectedHospital,
        year: Number(year),
        quarter: q,
      });
      setReport(data);
    } catch (err) {
      console.error(err);
      setReport(null);
      setError(err.message || "Failed to run fraud detector.");
    } finally {
      setLoading(false);
    }
  }

  // Prepare chart data
  const barData = (report?.topSuspiciousDrugs || []).map((d) => ({
    name: d.drug_name,
    value: d.avg_fraud_score,
  }));

  const lineData = report?.trend || [];

  const risk = report?.riskDistribution || { High: 0, Medium: 0, Low: 0 };
  const pieData = [
    { name: "High", value: risk.High || 0 },
    { name: "Medium", value: risk.Medium || 0 },
    { name: "Low", value: risk.Low || 0 },
  ];

  const riskLevelLabel = report?.hospitalRiskLevel || "";
  const riskLevelColor =
    riskLevelLabel === "HIGH"
      ? "#FF4D4F"
      : riskLevelLabel === "MEDIUM"
      ? "#FFA940"
      : "#52C41A";

  return (
    <div className="app-root">
      <header className="app-header">
        <h1 className="app-title">Prescription Fraud Detector</h1>
        <p className="app-subtitle">
          Detect unusual prescribing patterns across hospitals using
          AI-driven scoring.
        </p>
      </header>

      <main className="app-main">
        {/* Left panel: filters */}
        <section className="panel panel-filters">
          <h2 className="panel-title">Filters</h2>

          {hospitalsLoading && <p>Loading hospitals &amp; years...</p>}
          {hospitalsError && (
            <p className="error-text">{hospitalsError}</p>
          )}

          <label className="field">
            <span className="field-label">Hospital</span>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              disabled={hospitalsLoading || hospitals.length === 0}
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Year</span>
            <select
              value={year ?? ""}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={hospitalsLoading || years.length === 0}
            >
              <option value="" disabled>
                Select year
              </option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Quarter</span>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              disabled={hospitalsLoading}
            >
              {QUARTERS.map((q) => (
                <option key={q.label} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="error-text">{error}</p>}

          <button
            className="primary-button"
            onClick={handleRun}
            disabled={loading || hospitalsLoading}
          >
            {loading ? "Running..." : "Run Fraud Detector"}
          </button>
        </section>

        {/* Right panel: dashboard */}
        <section className="panel panel-dashboard">
          {!report && !loading && (
            <div className="placeholder">
              <p>Select a hospital, year, and quarter, then click</p>
              <p className="placeholder-cta">“Run Fraud Detector”</p>
            </div>
          )}

          {report && (
            <>
              {/* Risk banner */}
              <div className="risk-banner">
                <div className="risk-banner-main">
                  <span className="risk-label">Hospital Risk Level</span>
                  <span
                    className="risk-badge"
                    style={{ backgroundColor: riskLevelColor }}
                  >
                    {riskLevelLabel || "N/A"}
                  </span>
                </div>
                <p className="risk-banner-summary">{report.summary}</p>
              </div>

              {/* Metrics - 3 per row (handled by CSS) */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Total Prescriptions</span>
                  <span className="metric-value">
                    {report.totalPrescriptions}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">High Risk Cases</span>
                  <span className="metric-value metric-high">
                    {report.highRiskCases}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Medium Risk Cases</span>
                  <span className="metric-value metric-medium">
                    {report.mediumRiskCases}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Low Risk Cases</span>
                  <span className="metric-value metric-low">
                    {report.lowRiskCases}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">
                    Controlled Drug Prescriptions
                  </span>
                  <span className="metric-value">
                    {report.controlledDrugUse}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Active Alerts</span>
                  <span className="metric-value metric-high">
                    {report.activeAlerts}
                  </span>
                </div>
              </div>

              {/* Charts */}
              <div className="charts-grid">
                {/* Top Suspicious Drugs */}
                <div className="chart-card">
                  <h3 className="chart-title">Top Suspicious Drugs</h3>
                  {barData.length === 0 ? (
                    <p className="chart-empty">
                      No data for this selection.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ReTooltip />
                        <Bar dataKey="value"  fill="#3B82F6"/> 
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Fraud Trend */}
                <div className="chart-card">
                  <h3 className="chart-title">
                    Fraud Trend (Last 3 Months)
                  </h3>
                  {lineData.length === 0 ? (
                    <p className="chart-empty">
                      No month data available.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <ReTooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#9254DE"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Risk Distribution */}
                <div className="chart-card">
                  <h3 className="chart-title">Risk Distribution</h3>
                  {pieData.every((d) => d.value === 0) ? (
                    <p className="chart-empty">
                      No risk distribution data.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          nameKey="name"
                          label
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Legend />
                        <ReTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
