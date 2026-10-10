"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Check,
  ChevronRight,
  Coins,
  Copy,
  Download,
  Info,
  Layers,
  Percent,
  RotateCcw,
  Scale,
  Sparkles,
  Sprout,
  TrendingUp,
  Wheat,
} from "lucide-react";
import { useFarmData } from "@/lib/farm-data";
import { formatCurrency } from "@/lib/format";

type PresetType = "broiler_1000" | "broiler_2000" | "kampung_500" | "kambing_30";

type SimulationState = {
  livestockName: string;
  initialCount: number;
  mortalityRate: number; // percentage
  targetWeight: number; // kg per head
  fcr: number;
  docPrice: number; // per head
  feedPrice: number; // per kg
  ovkCost: number; // per head
  operationalCost: number; // per head
  sellingPricePerKg: number; // Rp per kg
};

const presets: Record<PresetType, SimulationState> = {
  broiler_1000: {
    livestockName: "Ayam Broiler (1.000 Ekor)",
    initialCount: 1000,
    mortalityRate: 3.5,
    targetWeight: 2.1,
    fcr: 1.45,
    docPrice: 7500,
    feedPrice: 9200,
    ovkCost: 1800,
    operationalCost: 2000,
    sellingPricePerKg: 21500,
  },
  broiler_2000: {
    livestockName: "Ayam Broiler (2.000 Ekor)",
    initialCount: 2000,
    mortalityRate: 3.0,
    targetWeight: 2.05,
    fcr: 1.42,
    docPrice: 7500,
    feedPrice: 9100,
    ovkCost: 1700,
    operationalCost: 1800,
    sellingPricePerKg: 21500,
  },
  kampung_500: {
    livestockName: "Ayam Kampung Unggul (500 Ekor)",
    initialCount: 500,
    mortalityRate: 5.0,
    targetWeight: 1.15,
    fcr: 2.1,
    docPrice: 8500,
    feedPrice: 8800,
    ovkCost: 2500,
    operationalCost: 3500,
    sellingPricePerKg: 38000,
  },
  kambing_30: {
    livestockName: "Kambing/Domba Penggemukan (30 Ekor)",
    initialCount: 30,
    mortalityRate: 2.0,
    targetWeight: 35.0,
    fcr: 6.0,
    docPrice: 1300000, // bakalan per ekor
    feedPrice: 3500, // pakan/konsentrat/silase per kg kenaikan
    ovkCost: 25000,
    operationalCost: 50000,
    sellingPricePerKg: 70000,
  },
};

type FeedIngredient = {
  id: string;
  name: string;
  percentage: number;
  pricePerKg: number;
};

export default function CalculatorPage() {
  const { data } = useFarmData();
  const [activeTab, setActiveTab] = useState<"harvest" | "feed">("harvest");
  const [sim, setSim] = useState<SimulationState>(presets.broiler_1000);
  const [copied, setCopied] = useState(false);

  // Feed mixer state
  const [ingredients, setIngredients] = useState<FeedIngredient[]>([
    { id: "1", name: "Jagung Giling", percentage: 50, pricePerKg: 5500 },
    { id: "2", name: "Konsentrat Pabrik", percentage: 35, pricePerKg: 10500 },
    { id: "3", name: "Dedak Padi Halus", percentage: 15, pricePerKg: 3800 },
  ]);
  const [commercialFeedPrice, setCommercialFeedPrice] = useState(9200); // Rp per kg pakan jadi
  const [feedCopied, setFeedCopied] = useState(false);

  // Real-time Calculations for Harvest Simulation
  const harvestCount = Math.round(sim.initialCount * (1 - sim.mortalityRate / 100));
  const deadCount = sim.initialCount - harvestCount;
  const totalWeightKg = harvestCount * sim.targetWeight;
  const totalFeedKg = totalWeightKg * sim.fcr;
  const totalFeedSacks = Math.ceil(totalFeedKg / 50);

  const docTotalCost = sim.initialCount * sim.docPrice;
  const feedTotalCost = totalFeedKg * sim.feedPrice;
  const ovkTotalCost = sim.initialCount * sim.ovkCost;
  const operationalTotalCost = sim.initialCount * sim.operationalCost;
  const totalCost = docTotalCost + feedTotalCost + ovkTotalCost + operationalTotalCost;

  const totalRevenue = totalWeightKg * sim.sellingPricePerKg;
  const grossProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const hppPerKg = totalWeightKg > 0 ? totalCost / totalWeightKg : 0;
  const hppPerHead = harvestCount > 0 ? totalCost / harvestCount : 0;
  const bepPricePerKg = hppPerKg; // Break-even price per kg

  const applyPreset = (key: PresetType) => {
    setSim(presets[key]);
  };

  const copyHarvestSummary = () => {
    const text = `📊 PROYEKSI KELAYAKAN USAHA: ${sim.livestockName}
Populasi Awal: ${sim.initialCount.toLocaleString("id-ID")} ekor
Mortalitas: ${sim.mortalityRate}% (${deadCount} ekor)
Populasi Panen: ${harvestCount.toLocaleString("id-ID")} ekor
Target Bobot Rata-rata: ${sim.targetWeight} kg/ekor
Total Bobot Panen: ${totalWeightKg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg
FCR: ${sim.fcr} (Kebutuhan Pakan: ${Math.round(totalFeedKg).toLocaleString("id-ID")} kg / ${totalFeedSacks} sak)

💰 KEUANGAN:
Total Omzet: ${formatCurrency(totalRevenue)} (@ Rp ${sim.sellingPricePerKg.toLocaleString("id-ID")}/kg)
Total Biaya: ${formatCurrency(totalCost)}
  - Bibit/DOC: ${formatCurrency(docTotalCost)}
  - Pakan: ${formatCurrency(feedTotalCost)}
  - OVK: ${formatCurrency(ovkTotalCost)}
  - Operasional: ${formatCurrency(operationalTotalCost)}

📈 HASIL PROYEKSI:
Laba / Rugi Bersih: ${formatCurrency(grossProfit)} (Margin: ${profitMargin.toFixed(1)}%)
HPP per Kg: ${formatCurrency(hppPerKg)}
HPP per Ekor: ${formatCurrency(hppPerHead)}
Titik Impas (BEP): Rp ${Math.round(bepPricePerKg).toLocaleString("id-ID")}/kg
Dicatat oleh: ${data.profile.business_name}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Calculations for Feed Mixer
  const totalPercentage = ingredients.reduce((sum, item) => sum + item.percentage, 0);
  const costPerKgMix = ingredients.reduce(
    (sum, item) => sum + (item.percentage / 100) * item.pricePerKg,
    0,
  );
  const costPerSackMix = costPerKgMix * 50;
  const commercialCostPerSack = commercialFeedPrice * 50;
  const savingsPerSack = commercialCostPerSack - costPerSackMix;
  const savingsPerTon = (commercialFeedPrice - costPerKgMix) * 1000;
  const savingsPercentage =
    commercialFeedPrice > 0
      ? ((commercialFeedPrice - costPerKgMix) / commercialFeedPrice) * 100
      : 0;

  const updateIngredient = (id: string, field: "percentage" | "pricePerKg", value: number) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const copyFeedSummary = () => {
    const text = `🌾 FORMULASI PAKAN RACIKAN MANDIRI
Komposisi Bahan:
${ingredients.map((i) => `- ${i.name}: ${i.percentage}% (@ Rp ${i.pricePerKg.toLocaleString("id-ID")}/kg)`).join("\n")}

Total Biaya Racikan: ${formatCurrency(costPerKgMix)} / kg (${formatCurrency(costPerSackMix)} / sak 50kg)
Harga Pakan Pabrik: ${formatCurrency(commercialFeedPrice)} / kg (${formatCurrency(commercialCostPerSack)} / sak)
Hemat per Sak: ${formatCurrency(savingsPerSack)} (${savingsPercentage.toFixed(1)}%)
Hemat per Ton (1.000 kg): ${formatCurrency(savingsPerTon)}`;

    navigator.clipboard.writeText(text);
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2500);
  };

  return (
    <div className="module-page calculator-page">
      <div className="page-intro module-intro">
        <div>
          <p className="eyebrow">ALAT BANTU & SIMULASI USAHA</p>
          <h2>Kalkulator & Proyeksi Peternakan</h2>
          <p>
            Hitung kelayakan siklus ternak, HPP per kilogram & ekor, titik impas (BEP), dan formulasi pakan secara akurat.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="segmented-control tool-tab-switch" role="tablist">
        <button
          type="button"
          className={activeTab === "harvest" ? "segment-active segment-income" : ""}
          onClick={() => setActiveTab("harvest")}
        >
          <TrendingUp size={16} />
          Proyeksi Panen & Analisis Kelayakan (ROI)
        </button>
        <button
          type="button"
          className={activeTab === "feed" ? "segment-active segment-expense" : ""}
          onClick={() => setActiveTab("feed")}
        >
          <Wheat size={16} />
          Formulasi & Penghematan Pakan Mandiri
        </button>
      </div>

      {activeTab === "harvest" ? (
        <div className="calculator-layout">
          {/* Left Form: Inputs */}
          <div className="calc-inputs-panel panel">
            <div className="calc-panel-header">
              <div className="calc-panel-title">
                <Sparkles size={18} className="text-forest" />
                <h3>Parameter Proyeksi</h3>
              </div>
              <div className="preset-chips">
                <span className="preset-label">Preset:</span>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset("broiler_1000")}
                >
                  Broiler 1k
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset("broiler_2000")}
                >
                  Broiler 2k
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset("kampung_500")}
                >
                  Kampung 500
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => applyPreset("kambing_30")}
                >
                  Kambing 30
                </button>
              </div>
            </div>

            <div className="calc-section-label">1. Data Populasi & Siklus</div>
            <div className="calc-form-grid">
              <label className="field-label">
                Populasi Awal (Ekor)
                <input
                  type="number"
                  min="1"
                  value={sim.initialCount}
                  onChange={(e) => setSim({ ...sim, initialCount: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="field-label">
                Mortalitas / Kematian (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={sim.mortalityRate}
                  onChange={(e) => setSim({ ...sim, mortalityRate: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="field-label">
                Target Bobot (Kg / Ekor)
                <input
                  type="number"
                  min="0.1"
                  step="0.05"
                  value={sim.targetWeight}
                  onChange={(e) => setSim({ ...sim, targetWeight: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="field-label">
                Target FCR (Feed Conversion)
                <input
                  type="number"
                  min="0.5"
                  step="0.01"
                  value={sim.fcr}
                  onChange={(e) => setSim({ ...sim, fcr: Number(e.target.value) || 0 })}
                />
              </label>
            </div>

            <div className="calc-section-label">2. Biaya Produksi (Modal)</div>
            <div className="calc-form-grid">
              <label className="field-label">
                Harga Bibit / DOC (Rp / Ekor)
                <input
                  type="number"
                  min="0"
                  value={sim.docPrice}
                  onChange={(e) => setSim({ ...sim, docPrice: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="field-label">
                Harga Pakan (Rp / Kg)
                <input
                  type="number"
                  min="0"
                  value={sim.feedPrice}
                  onChange={(e) => setSim({ ...sim, feedPrice: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="field-label">
                Obat & Vaksin (Rp / Ekor)
                <input
                  type="number"
                  min="0"
                  value={sim.ovkCost}
                  onChange={(e) => setSim({ ...sim, ovkCost: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="field-label">
                Operasional / Upah (Rp / Ekor)
                <input
                  type="number"
                  min="0"
                  value={sim.operationalCost}
                  onChange={(e) => setSim({ ...sim, operationalCost: Number(e.target.value) || 0 })}
                />
              </label>
            </div>

            <div className="calc-section-label">3. Target Penjualan</div>
            <div className="calc-form-grid">
              <label className="field-label form-span">
                Target Harga Jual Panen (Rp / Kg Hidup)
                <input
                  type="number"
                  min="0"
                  value={sim.sellingPricePerKg}
                  onChange={(e) => setSim({ ...sim, sellingPricePerKg: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          </div>

          {/* Right Panel: Output & Analytics */}
          <div className="calc-results-panel">
            {/* Top Profit Highlight Card */}
            <div className={`calc-highlight-card ${grossProfit >= 0 ? "highlight-positive" : "highlight-negative"}`}>
              <div className="highlight-top">
                <span className="highlight-badge">
                  {grossProfit >= 0 ? "Surplus Keuntungan" : "Defisit / Perlu Penyesuaian"}
                </span>
                <span className="highlight-margin">
                  Margin: {profitMargin.toFixed(1)}%
                </span>
              </div>
              <div className="highlight-nominal">
                {formatCurrency(grossProfit)}
              </div>
              <p className="highlight-sub">
                Estimasi Laba Bersih dari omzet {formatCurrency(totalRevenue)}
              </p>
            </div>

            {/* Key Efficiency Metrics Grid */}
            <div className="calc-metrics-grid">
              <div className="calc-metric-card">
                <span className="metric-label">HPP per Kilogram</span>
                <strong className="metric-val text-forest">{formatCurrency(hppPerKg)}</strong>
                <small className="metric-sub">Biaya modal per kg bobot hidup</small>
              </div>

              <div className="calc-metric-card">
                <span className="metric-label">HPP per Ekor</span>
                <strong className="metric-val">{formatCurrency(hppPerHead)}</strong>
                <small className="metric-sub">Biaya per ekor panen</small>
              </div>

              <div className="calc-metric-card">
                <span className="metric-label">Titik Impas (BEP)</span>
                <strong className="metric-val text-amber">Rp {Math.round(bepPricePerKg).toLocaleString("id-ID")}/kg</strong>
                <small className="metric-sub">Harga jual minimal agar tidak rugi</small>
              </div>

              <div className="calc-metric-card">
                <span className="metric-label">Kebutuhan Pakan Total</span>
                <strong className="metric-val">{Math.round(totalFeedKg).toLocaleString("id-ID")} kg</strong>
                <small className="metric-sub">Setara {totalFeedSacks} sak (50 kg/sak)</small>
              </div>
            </div>

            {/* Cost Breakdown Summary */}
            <div className="panel calc-breakdown-panel">
              <h4 className="breakdown-title">Rincian Komponen Biaya</h4>
              <div className="breakdown-rows">
                <div className="breakdown-row">
                  <span>Pakan ({((feedTotalCost / (totalCost || 1)) * 100).toFixed(0)}%)</span>
                  <strong>{formatCurrency(feedTotalCost)}</strong>
                </div>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill bar-feed"
                    style={{ width: `${(feedTotalCost / (totalCost || 1)) * 100}%` }}
                  />
                </div>

                <div className="breakdown-row">
                  <span>Bibit / DOC ({((docTotalCost / (totalCost || 1)) * 100).toFixed(0)}%)</span>
                  <strong>{formatCurrency(docTotalCost)}</strong>
                </div>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill bar-doc"
                    style={{ width: `${(docTotalCost / (totalCost || 1)) * 100}%` }}
                  />
                </div>

                <div className="breakdown-row">
                  <span>Operasional & Upah ({((operationalTotalCost / (totalCost || 1)) * 100).toFixed(0)}%)</span>
                  <strong>{formatCurrency(operationalTotalCost)}</strong>
                </div>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill bar-ops"
                    style={{ width: `${(operationalTotalCost / (totalCost || 1)) * 100}%` }}
                  />
                </div>

                <div className="breakdown-row">
                  <span>OVK / Vaksin ({((ovkTotalCost / (totalCost || 1)) * 100).toFixed(0)}%)</span>
                  <strong>{formatCurrency(ovkTotalCost)}</strong>
                </div>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill bar-ovk"
                    style={{ width: `${(ovkTotalCost / (totalCost || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="breakdown-total-row">
                <span>Total Estimasi Biaya</span>
                <strong>{formatCurrency(totalCost)}</strong>
              </div>
            </div>

            {/* Action Bar */}
            <div className="calc-action-bar">
              <button
                type="button"
                className="primary-button"
                onClick={copyHarvestSummary}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Tersalin ke Clipboard!" : "Salin Ringkasan Proyeksi"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => applyPreset("broiler_1000")}
              >
                <RotateCcw size={15} />
                Reset Nilai
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Feed Formulator & Savings Calculator */
        <div className="calculator-layout">
          <div className="calc-inputs-panel panel">
            <div className="calc-panel-header">
              <div className="calc-panel-title">
                <Wheat size={18} className="text-forest" />
                <h3>Komposisi Bahan Pakan Mandiri</h3>
              </div>
              <span className={`status-pill ${totalPercentage === 100 ? "status-paid" : "status-unpaid"}`}>
                Total: {totalPercentage}% {totalPercentage === 100 ? "✓ Pas" : "(Harus 100%)"}
              </span>
            </div>

            <p className="editor-description">
              Atur persentase bahan baku dan harga beli per kilogram untuk menghitung harga pakan racikan per sak (50 kg) dibanding pakan pabrik.
            </p>

            <div className="feed-ingredients-list">
              {ingredients.map((item) => (
                <div key={item.id} className="feed-ingredient-row">
                  <span className="ingredient-name">{item.name}</span>
                  <div className="ingredient-fields">
                    <label className="field-compact">
                      Proporsi (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.percentage}
                        onChange={(e) =>
                          updateIngredient(item.id, "percentage", Number(e.target.value) || 0)
                        }
                      />
                    </label>
                    <label className="field-compact">
                      Harga (Rp/kg)
                      <input
                        type="number"
                        min="0"
                        value={item.pricePerKg}
                        onChange={(e) =>
                          updateIngredient(item.id, "pricePerKg", Number(e.target.value) || 0)
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="calc-section-label" style={{ marginTop: "1.5rem" }}>
              Pembanding Harga Pasar
            </div>
            <label className="field-label">
              Harga Pakan Pabrik Komersial (Rp / Kg)
              <input
                type="number"
                min="0"
                value={commercialFeedPrice}
                onChange={(e) => setCommercialFeedPrice(Number(e.target.value) || 0)}
              />
              <small>Biasanya berkisar antara Rp 8.800 – Rp 10.500 per kg.</small>
            </label>
          </div>

          {/* Feed Savings Results */}
          <div className="calc-results-panel">
            <div className={`calc-highlight-card ${savingsPerSack >= 0 ? "highlight-positive" : "highlight-negative"}`}>
              <div className="highlight-top">
                <span className="highlight-badge">Penghematan Biaya Pakan</span>
                <span className="highlight-margin">Hemat {savingsPercentage.toFixed(1)}%</span>
              </div>
              <div className="highlight-nominal">{formatCurrency(savingsPerSack)}</div>
              <p className="highlight-sub">
                Penghematan per sak 50 kg dibanding pakan pabrik
              </p>
            </div>

            <div className="calc-metrics-grid">
              <div className="calc-metric-card">
                <span className="metric-label">HPP Racikan per Kg</span>
                <strong className="metric-val text-forest">{formatCurrency(costPerKgMix)}</strong>
                <small className="metric-sub">Pakan pabrik: {formatCurrency(commercialFeedPrice)}/kg</small>
              </div>

              <div className="calc-metric-card">
                <span className="metric-label">HPP Racikan per Sak (50 kg)</span>
                <strong className="metric-val">{formatCurrency(costPerSackMix)}</strong>
                <small className="metric-sub">Pakan pabrik: {formatCurrency(commercialCostPerSack)}/sak</small>
              </div>

              <div className="calc-metric-card">
                <span className="metric-label">Penghematan per Ton (1.000 kg)</span>
                <strong className="metric-val text-lime-dark">{formatCurrency(savingsPerTon)}</strong>
                <small className="metric-sub">Setara 20 sak pakan</small>
              </div>

              <div className="calc-metric-card">
                <span className="metric-label">Status Formulasi</span>
                <strong className="metric-val">
                  {totalPercentage === 100 ? "Ideal (100%)" : `${totalPercentage}%`}
                </strong>
                <small className="metric-sub">
                  {totalPercentage === 100 ? "Siap diaplikasikan" : "Sesuaikan proporsi"}
                </small>
              </div>
            </div>

            <div className="calc-action-bar">
              <button
                type="button"
                className="primary-button"
                onClick={copyFeedSummary}
              >
                {feedCopied ? <Check size={16} /> : <Copy size={16} />}
                {feedCopied ? "Tersalin ke Clipboard!" : "Salin Ringkasan Formulasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
