// src/fraudApi.js


 const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://fraud-backend-pxg9.onrender.com";


async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------- Hospitals & Years ----------------

export async function getHospitals() {
  const data = await getJson(`${API_BASE_URL}/api/hospitals`);
  // backend returns: { hospitals: [ {id, name, label}, ... ] }
  return data.hospitals || [];
}

export async function getYears() {
  const data = await getJson(`${API_BASE_URL}/api/years`);
  // backend returns: { years: [2021, 2022, ...] }
  return data.years || [];
}

// ---------------- Fraud report ----------------

export async function runFraudCheck({ hospitalId, year, quarter }) {
  const params = new URLSearchParams({
    hospital_id: hospitalId,
    year: String(year),
  });
  if (quarter !== undefined) {
    params.append("quarter", String(quarter));
  }

  const data = await getJson(
    `${API_BASE_URL}/api/fraud-report?${params.toString()}`
  );

  // risk_distribution can be an object {High, Medium, Low}
  // or an array of {name, value}. Handle both.
  let riskDistribution = data.risk_distribution || {};
  if (Array.isArray(riskDistribution)) {
    const obj = {};
    for (const item of riskDistribution) {
      if (!item) continue;
      const name = (item.name || "").toLowerCase();
      if (name.includes("high")) obj.High = item.value;
      else if (name.includes("medium")) obj.Medium = item.value;
      else if (name.includes("low")) obj.Low = item.value;
    }
    riskDistribution = obj;
  }

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
    hospitalRiskLevel: data.risk_level || data.hospital_risk_level,
    summary: data.summary || "",
    trend: data.fraud_trend_last_3_months || data.trend_last_3_months || [],
    topSuspiciousDrugs: data.top_suspicious_drugs || [],
    riskDistribution,
  };
}

// ---------------- Top suspicious cases ----------------

export async function getTopCases({
  hospitalId,
  year,
  quarter,
  limit = 8,
}) {
  const params = new URLSearchParams({
    hospital_id: hospitalId,
    year: String(year),
    limit: String(limit),
  });
  if (quarter !== undefined) {
    params.append("quarter", String(quarter));
  }

  const data = await getJson(
    `${API_BASE_URL}/api/top-cases?${params.toString()}`
  );

  // backend returns: { hospital_id, year, quarter, cases: [...] }
  return data.cases || [];
}
