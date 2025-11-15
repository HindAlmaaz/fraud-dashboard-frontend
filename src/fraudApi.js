// src/fraudApi.js

// ✨ Hard-code your backend URL for now
// If your backend is on Render, put that URL here instead.
const API_BASE_URL = "https://fraud-backend-pxg9.onrender.com";  // <--- important

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getHospitals() {
  const url = `${API_BASE_URL}/api/hospitals`;
  const data = await getJson(url);

  if (!data || !Array.isArray(data.hospitals)) {
    throw new Error("Invalid hospitals response from backend");
  }

  return data.hospitals;
}

export async function getYears() {
  const url = `${API_BASE_URL}/api/years`;
  const data = await getJson(url);

  if (!data || !Array.isArray(data.years)) {
    throw new Error("Invalid years response from backend");
  }

  return data.years;
}

export async function runFraudCheck({ hospitalId, year, quarter }) {
  const params = new URLSearchParams();
  params.set("hospital_id", hospitalId);
  params.set("year", String(year));
  if (quarter) params.set("quarter", String(quarter));

  const url = `${API_BASE_URL}/api/fraud-report?${params.toString()}`;
  const data = await getJson(url);

  return {
    hospitalId: data.hospital_id,
    hospitalName: data.hospital_name,
    year: data.year,
    quarter: data.quarter,
    totalPrescriptions: data.total_prescriptions,
    highRiskCases: data.high_risk_cases,
    mediumRiskCases: data.medium_risk_cases,
    lowRiskCases: data.low_risk_cases,
    controlledDrugUse: data.controlled_drug_use,
    activeAlerts: data.active_alerts,
    hospitalRiskLevel: data.hospital_risk_level,
    summary: data.summary || "",
    trend: data.trend_last_3_months || [],
    topSuspiciousDrugs: data.top_suspicious_drugs || [],
    riskDistribution:
      data.risk_distribution || { High: 0, Medium: 0, Low: 0 },
  };
}
