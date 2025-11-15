// src/App.jsx
import { useEffect, useState, useRef } from "react";
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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  getHospitals,
  getYears,
  runFraudCheck,
  getTopCases,
} from "./fraudApi";

const COLORS = ["#FF4D4F", "#52C41A", "#FFA940"]; // High / Low / Medium

const QUARTERS = [
  { value: "", label: "Full year" },
  { value: 1, label: "Q1" },
  { value: 2, label: "Q2" },
  { value: 3, label: "Q3" },
  { value: 4, label: "Q4" },
];

export default function App() {
  // -------- shared state ----------
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [hospitalsError, setHospitalsError] = useState("");

  const [years, setYears] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [year, setYear] = useState(null);
  const [quarter, setQuarter] = useState("");

  const [report, setReport] = useState(null);
  const [topCases, setTopCases] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // screens
  const [step, setStep] = useState(1); // 1 = filters, 2 = dashboard
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "cases"

  // dashboard ref for PDF export
  const dashboardRef = useRef(null);

  // -------------------------------------------------------
  // Load hospitals + years at startup
  // -------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      try {
        setHospitalsLoading(true);
        setHospitalsError("");

        // hospitals
        const hospitalList = await getHospitals();
        setHospitals(hospitalList);
        if (hospitalList.length > 0) {
          setSelectedHospital(hospitalList[0].id);
        }

        // years (with fallback)
        try {
          const yearList = await getYears();
          setYears(yearList);
          if (yearList.length > 0) {
            setYear(yearList[yearList.length - 1]); // latest year
          }
        } catch (err) {
          console.error("Failed to load years, using fallback", err);
          const fallback = [2021, 2022, 2023];
          setYears(fallback);
          setYear(fallback[fallback.length - 1]);
        }
      } catch (err) {
        console.error(err);
        setHospitalsError("Failed to load hospitals or years from backend.");
      } finally {
        setHospitalsLoading(false);
      }
    }

    loadData();
  }, []);

  // -------------------------------------------------------
  // Run fraud detector
  // -------------------------------------------------------
  async function handleRun() {
    if (!selectedHospital || !year) {
      setError("Please select a hospital and year.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const q = quarter === "" ? undefined : Number(quarter);

      const [reportData, casesData] = await Promise.all([
        runFraudCheck({
          hospitalId: selectedHospital,
          year: Number(year),
          quarter: q,
        }),
        getTopCases({
          hospitalId: selectedHospital,
          year: Number(year),
          quarter: q,
          limit: 8,
        }),
      ]);

      setReport(reportData);
      setTopCases(casesData);
      setActiveTab("overview");
      setStep(2); // go to dashboard
    } catch (err) {
      console.error(err);
      setReport(null);
      setTopCases([]);
      setError(err.message || "Failed to run fraud detector.");
    } finally {
      setLoading(false);
    }
  }

  function handleBackToFilters() {
    setStep(1);
  }

  // -------------------------------------------------------
  // Export dashboard as PDF
  // -------------------------------------------------------
  async function handleExportPdf() {
    if (!dashboardRef.current || !report) return;

    try {
      await new Promise((r) => setTimeout(r, 300));

      const element = dashboardRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const yPos = Math.max((pageHeight - imgHeight) / 2, 0);

      pdf.addImage(imgData, "PNG", 0, yPos, imgWidth, imgHeight);
      pdf.save(
        `Fraud_Report_${report.hospitalName}_${report.year}${
          report.quarter ? "_" + report.quarter : ""
        }.pdf`
      );
    } catch (err) {
      console.error("Failed to export PDF:", err);
      alert("Failed to export PDF. Please try again.");
    }
  }

  // -------------------------------------------------------
  // Derived data for charts
  // -------------------------------------------------------
  const barData = (report?.topSuspiciousDrugs || []).map((d) => ({
    name: d.drug_name,
    value: d.avg_fraud_score,
  }));

  const lineData = report?.trend || [];

  const riskObj = report?.riskDistribution || { High: 0, Medium: 0, Low: 0 };
  const pieData = [
    { name: "High", value: riskObj.High || 0 },
    { name: "Medium", value: riskObj.Medium || 0 },
    { name: "Low", value: riskObj.Low || 0 },
  ];

  const riskLevelLabel = report?.hospitalRiskLevel || "";
  const riskLevelColor =
    riskLevelLabel === "HIGH"
      ? "#FF4D4F"
      : riskLevelLabel === "MEDIUM"
      ? "#FFA940"
      : "#52C41A";

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <div className="app-root">
      <header className="app-header">
        <h1 className="app-title">Prescription Fraud Detector</h1>
        <p className="app-subtitle">
          Detect unusual prescribing patterns across hospitals using
          AI-driven scoring.
        </p>
      </header>

      {/* =========== SCREEN 1 – FILTERS ONLY =========== */}
      {step === 1 && (
        <main className="app-main single">
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
        </main>
      )}

      {/* =========== SCREEN 2 – DASHBOARD ONLY =========== */}
      {step === 2 && report && (
        <main className="app-main-results">
          {/* Small header row */}
          <div className="results-header-row">
            <div className="selection-summary">
              <div className="selection-line">
                <span className="selection-label">Hospital:</span>{" "}
                <span className="selection-value">
                  {report.hospitalName}
                </span>
              </div>
              <div className="selection-line">
                <span className="selection-label">Period:</span>{" "}
                <span className="selection-value">
                  {report.quarter
                    ? `${report.year} ${report.quarter}`
                    : report.year}
                </span>
              </div>
            </div>

            {/* Top Cases toggle button */}
            <button
              className={
                activeTab === "cases"
                  ? "topcases-btn active"
                  : "topcases-btn"
              }
              type="button"
              onClick={() =>
                setActiveTab(
                  activeTab === "cases" ? "overview" : "cases"
                )
              }
            >
              {activeTab === "cases" ? "Back to Summary" : "View Top Cases"}
            </button>
          </div>

          {/* Dashboard content to be exported as PDF */}
          <section className="panel panel-dashboard" ref={dashboardRef}>
            {/* -------- OVERVIEW -------- */}
            {activeTab === "overview" && (
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
                  <p className="risk-banner-summary">
                    {report.summary}
                  </p>
                </div>

                {/* Metric cards (3 per row via CSS) */}
                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-label">
                      Total Prescriptions
                    </span>
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
                          <Bar dataKey="value" fill="#2563EB" />
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

            {/* -------- TOP CASES -------- */}
            {activeTab === "cases" && (
              <div className="cases-screen">
                <p className="cases-intro">
                  Showing the most suspicious prescriptions for{" "}
                  <strong>{report.hospitalName}</strong> in{" "}
                  <strong>
                    {report.quarter
                      ? `${report.year} ${report.quarter}`
                      : report.year}
                  </strong>
                  . These cases have the highest fraud scores and should
                  be reviewed by the clinical / pharmacy team.
                </p>

                {topCases.length === 0 ? (
                  <p className="chart-empty">
                    No suspicious prescriptions found for this period.
                  </p>
                ) : (
                  <div className="cases-table-wrapper">
                    <table className="cases-table">
                      <thead>
                        <tr>
                          <th>Risk</th>
                          <th>Drug</th>
                          <th>Quantity</th>
                          <th>Patient ID</th>
                          <th>Doctor ID</th>
                          <th>Date</th>
                          <th>Fraud Score</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCases.map((c) => (
                          <tr key={c.prescription_id}>
                            <td>
                              <span
                                className={`risk-pill ${
                                  c.risk_band === "High"
                                    ? "risk-pill-high"
                                    : c.risk_band === "Medium"
                                    ? "risk-pill-medium"
                                    : "risk-pill-low"
                                }`}
                              >
                                {c.risk_band}
                              </span>
                            </td>
                            <td>{c.drug_name}</td>
                            <td>{c.quantity}</td>
                            <td>{c.patient_id}</td>
                            <td>{c.doctor_id}</td>
                            <td>{c.date}</td>
                            <td>{c.final_fraud_score.toFixed(2)}</td>
                            <td>{c.recommended_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Bottom action buttons (inside panel so included in PDF) */}
            <div className="bottom-actions">
              <button className="export-button" onClick={handleExportPdf}>
                📄 Export PDF
              </button>

              <button className="back-button" onClick={handleBackToFilters}>
                ← Back to filters
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
