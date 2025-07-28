import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { Sun, Battery, AlertCircle, Trash2, PlusCircle, Wand2, Info, Upload, Copy, Save, Leaf, ChevronDown, ChevronUp, Car, Trees, Home, XCircle, HelpCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Type definitions
interface Bill {
  month: string;
  consumption: number;
  amount: number;
  isEstimated: boolean;
}

interface Tier {
  from: number;
  to: number | typeof Infinity;
  rate: number;
}

interface YearlyBreakdown {
  year: number;
  savings: number;
  degradation: number;
  cashFlow: number;
  cumulativeCashFlow: number;
}

interface FinancialAnalysis {
  annualSavings: number;
  monthlySavings: number;
  paybackPeriod: number;
  roi25YearNetProfit: number;
  roi25YearNetValue: number;
  roiPercentage: number;
  billOffsetPercentage: number;
  // DEWA specific
  netMeteringSavedKwh: number;
  netMeteringSavedAed: number;
  netMeteringCreditKwh: number;
  netMeteringCreditsValue: number;
  // For breakdown
  yearlyBreakdown: YearlyBreakdown[];
}

// Constants
const CITY_SEASONAL_FACTORS: { [city: string]: { [month: string]: number } } = {
  'Dubai': { January: 0.72, February: 0.77, March: 0.91, April: 1.05, May: 1.18, June: 1.25, July: 1.28, August: 1.22, September: 1.10, October: 0.94, November: 0.83, December: 0.75 },
  'Ajman': { January: 0.73, February: 0.78, March: 0.92, April: 1.05, May: 1.17, June: 1.24, July: 1.27, August: 1.22, September: 1.11, October: 0.95, November: 0.83, December: 0.74 },
  'Sharjah': { January: 0.72, February: 0.77, March: 0.90, April: 1.04, May: 1.18, June: 1.25, July: 1.28, August: 1.21, September: 1.10, October: 0.93, November: 0.82, December: 0.74 },
  'Abu Dhabi': { January: 0.74, February: 0.79, March: 0.91, April: 1.05, May: 1.17, June: 1.24, July: 1.26, August: 1.22, September: 1.10, October: 0.95, November: 0.84, December: 0.75 },
  'Ras Al Khaimah': { January: 0.71, February: 0.76, March: 0.89, April: 1.03, May: 1.17, June: 1.25, July: 1.28, August: 1.23, September: 1.12, October: 0.95, November: 0.83, December: 0.73 },
  'Fujairah': { January: 0.69, February: 0.74, March: 0.86, April: 1.00, May: 1.14, June: 1.23, July: 1.27, August: 1.21, September: 1.10, October: 0.94, November: 0.81, December: 0.71 },
  'Umm Al Quwain': { January: 0.72, February: 0.77, March: 0.91, April: 1.04, May: 1.16, June: 1.24, July: 1.27, August: 1.22, September: 1.11, October: 0.94, November: 0.83, December: 0.74 }
};
const ETISALAT_SERVICE_CHARGE_PER_KWH = 0.05;
const REAL_WORLD_LOSS_FACTOR = 0.93;
const CO2_EMISSIONS_FACTOR_KG_PER_KWH = 0.7;
const BIFACIAL_BOOST_FACTOR = 1.07;
const SPACE_PER_PANEL_PORTRAIT = 2.1;
const SPACE_PER_PANEL_LANDSCAPE = 2.4;
const months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// --- UTILITY FUNCTIONS ---
const calculateBillAmountForConsumption = (consumption: number, tiers: Tier[], fuelSurcharge: number, options: { escalate?: boolean; escalateFuelSurcharge?: boolean; escalationRate?: number; year?: number; } = {}): number => {
    if (consumption <= 0) return 0;
    const { escalate = false, escalateFuelSurcharge = false, escalationRate = 0, year = 1 } = options;
    const escalationFactor = escalate ? Math.pow(1 + escalationRate, year - 1) : 1;
    let totalTierAmount = 0;
    let remainingConsumption = consumption;
    const finalTiers = escalate ? tiers.map(t => ({ ...t, rate: t.rate * escalationFactor })) : tiers;
    let lastTierEnd = 0;

    for (const tier of finalTiers) {
        if (remainingConsumption <= 0) break;
        
        const tierStart = tier.from;
        const tierEnd = tier.to === Infinity ? Infinity : tier.to;
        
        // Ensure tiers are contiguous for this logic to work, which they are by design
        const tierCapacity = tierEnd - lastTierEnd;
        const consumptionInThisTier = Math.min(remainingConsumption, tierCapacity);

        totalTierAmount += consumptionInThisTier * tier.rate;
        remainingConsumption -= consumptionInThisTier;
        lastTierEnd = tierEnd;
    }
    const finalFuelSurcharge = escalateFuelSurcharge ? fuelSurcharge * escalationFactor : fuelSurcharge;
    return totalTierAmount + (consumption * finalFuelSurcharge);
};

// --- FINANCIAL CALCULATION CORE LOGIC ---
const calculateFinancialAnalysis = (params: {
    systemCost: number, bills: Bill[], authority: 'DEWA' | 'EtihadWE', batteryEnabled: boolean, batteryMode: 'night' | 'unused',
    daytimeConsumption: number, monthlyProductionMap: { [key: string]: number }, systemRecommendation: any,
    roiParams: any, tiers: Tier[], fuelSurcharge: number, fullYearConsumptionStats: any, getAverageRate: (c: number) => number
}): FinancialAnalysis => {
    const { systemCost, bills, authority, batteryEnabled, daytimeConsumption, monthlyProductionMap, roiParams, tiers, fuelSurcharge, fullYearConsumptionStats, getAverageRate, systemRecommendation, batteryMode } = params;
    const { firstYearDegradation, degradationRate, escalationRate, escalateFuelSurcharge, creditExpiryMonths } = roiParams;
    const { batteryCapacity, idealBatteryEfficiency, idealUsableDoD } = systemRecommendation;

    const consumptionByMonth = months.reduce((acc, month) => ({ ...acc, [month]: fullYearConsumptionStats.avgMonthly }), {} as { [key: string]: number });
    bills.forEach(b => consumptionByMonth[b.month] = b.consumption);

    let cumulativeCashFlow = -systemCost;
    let paybackPeriodYears = 0;
    let year1_annual_savings = 0;
    let creditQueue: { year: number, monthIndex: number, kwh: number }[] = [];
    const yearlyBreakdown: YearlyBreakdown[] = [];
    let totalOriginalBillYear1 = 0;

    for (let year = 1; year <= 25; year++) {
        let yearlySavings = 0;
        const degradationFactor = (1 - firstYearDegradation) * Math.pow(1 - degradationRate, year - 1);

        months.forEach((monthName, monthIndex) => {
            creditQueue = creditQueue.filter(c => ((year - 1) * 12 + monthIndex) - ((c.year - 1) * 12 + c.monthIndex) < creditExpiryMonths);
            const monthlyConsumption = consumptionByMonth[monthName];
            const monthlyProduction = (monthlyProductionMap[monthName] || 0) * degradationFactor;
            const opts = { escalate: true, escalateFuelSurcharge, escalationRate, year };
            const originalBill = calculateBillAmountForConsumption(monthlyConsumption, tiers, fuelSurcharge, opts);
            if (year === 1) totalOriginalBillYear1 += originalBill;

            if (authority === 'DEWA') {
                let netKwh = monthlyProduction - monthlyConsumption;
                let deficit = -netKwh;
                if (netKwh >= 0) { creditQueue.push({ year, monthIndex, kwh: netKwh }); deficit = 0; }
                for (const credit of creditQueue) { if (deficit <= 0) break; const draw = Math.min(deficit, credit.kwh); credit.kwh -= draw; deficit -= draw; }
                creditQueue = creditQueue.filter(c => c.kwh > 0.1); // Use a small epsilon to avoid floating point issues
                yearlySavings += Number(originalBill) - Number(calculateBillAmountForConsumption(deficit, tiers, fuelSurcharge, opts));
            } else { // EtihadWE
                let savedKwh = 0;
                if (batteryEnabled && batteryCapacity > 0) {
                     // Use a more realistic daily simulation
                    const dailyProduction = monthlyProduction / 30.4;
                    const dailyConsumption = monthlyConsumption / 30.4;
                    const dailyDaytimeLoad = dailyConsumption * (daytimeConsumption / 100);
                    const dailyNighttimeLoad = dailyConsumption - dailyDaytimeLoad;

                    const solarDirectlyUsed = Math.min(dailyProduction, dailyDaytimeLoad);
                    const excessSolarForCharging = dailyProduction - solarDirectlyUsed;
                    const energyStoredInBattery = Math.min(excessSolarForCharging, batteryCapacity * idealUsableDoD);
                    const energyDischargedFromBattery = Math.min(dailyNighttimeLoad, energyStoredInBattery * idealBatteryEfficiency);
                    const dailySavedKwh = solarDirectlyUsed + energyDischargedFromBattery;
                    savedKwh = dailySavedKwh * 30.4;
                } else {
                    savedKwh = Math.min(monthlyProduction, monthlyConsumption * (daytimeConsumption / 100));
                }
                yearlySavings += (Number(originalBill) - Number(calculateBillAmountForConsumption(monthlyConsumption - savedKwh, tiers, fuelSurcharge, opts)));
            }
        });

        const yearlyCashFlow = Number(yearlySavings) - (systemCost * 0.01); // Assuming 1% annual maintenance cost
        if (paybackPeriodYears === 0 && (Number(cumulativeCashFlow) + Number(yearlyCashFlow)) > 0) {
            paybackPeriodYears = (year - 1) + (Number(yearlyCashFlow) > 0 ? Math.abs(Number(cumulativeCashFlow)) / Number(yearlyCashFlow) : 0);
        }
        cumulativeCashFlow += Number(yearlyCashFlow);
        yearlyBreakdown.push({ year, savings: yearlySavings, degradation: degradationFactor, cashFlow: yearlyCashFlow, cumulativeCashFlow });
        if (year === 1) year1_annual_savings = yearlySavings;
    }

    const year1_excess_kwh = creditQueue.reduce((acc, c) => acc + (c.year === 1 ? c.kwh : 0), 0);
    const averageRate = getAverageRate(fullYearConsumptionStats.avgMonthly);

    return {
        annualSavings: Math.round(year1_annual_savings),
        monthlySavings: Math.round(year1_annual_savings / 12),
        paybackPeriod: paybackPeriodYears > 0 ? parseFloat(paybackPeriodYears.toFixed(1)) : 0,
        roi25YearNetProfit: Math.round(cumulativeCashFlow),
        roi25YearNetValue: Math.round(Number(cumulativeCashFlow) + systemCost),
        roiPercentage: systemCost > 0 ? Math.round((cumulativeCashFlow / systemCost) * 100) : 0,
        billOffsetPercentage: totalOriginalBillYear1 > 0 ? Math.round((year1_annual_savings / totalOriginalBillYear1) * 100) : 0,
        netMeteringSavedKwh: Math.round(systemRecommendation.annualProduction * (1 - firstYearDegradation) - year1_excess_kwh),
        netMeteringSavedAed: Math.round(year1_annual_savings),
        netMeteringCreditKwh: Math.round(year1_excess_kwh),
        netMeteringCreditsValue: Math.round(year1_excess_kwh * averageRate),
        yearlyBreakdown
    };
};


// --- CHILD COMPONENTS ---

const ProjectConfigurationCard = ({ projectName, setProjectName, city, setCity, authority, setAuthority, batteryEnabled, setBatteryEnabled, batteryMode, setBatteryMode }) => (
    <Card title="Project Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Villa Solar Project" />
            <Select label="City / Emirate" value={city} onChange={(e) => setCity(e.target.value)}>
                {Object.keys(CITY_SEASONAL_FACTORS).map(cityOption => <option key={cityOption} value={cityOption}>{cityOption}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authority</label>
              <div className="flex gap-2">
                {(['DEWA', 'EtihadWE'] as const).map(auth => (
                  <Button key={auth} onClick={() => { setAuthority(auth); if (auth === 'DEWA') setBatteryEnabled(false); }} variant={authority === auth ? 'primary' : 'ghost'} className="w-full">{auth}</Button>
                ))}
              </div>
            </div>
            {authority === 'EtihadWE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Battery Storage</label>
                <Button onClick={() => setBatteryEnabled(!batteryEnabled)} variant={batteryEnabled ? 'secondary' : 'ghost'} className="w-full"><Battery className="w-4 h-4 mr-2" />{batteryEnabled ? 'Enabled' : 'Disabled'}</Button>
                {batteryEnabled && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Battery Usage Mode</label>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setBatteryMode('night')} variant={batteryMode === 'night' ? 'secondary' : 'ghost'} className="w-full text-xs">Nighttime Backup</Button>
                      <Button size="sm" onClick={() => setBatteryMode('unused')} variant={batteryMode === 'unused' ? 'secondary' : 'ghost'} className="w-full text-xs">Store Unused</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
    </Card>
);

const BillAnalysisCard = ({ bills, setBills, billInput, setBillInput, tiers, setTiers, fuelSurcharge, setFuelSurcharge, seasonalAnalysis, fullYearConsumptionStats, handleEstimateFromPartialData, pendingEstimates, setPendingEstimates }) => {
    const calculateBillAmount = useCallback((consumption: number) => calculateBillAmountForConsumption(consumption, tiers, fuelSurcharge), [tiers, fuelSurcharge]);
    
    const parseBillInput = useCallback((input: string): Bill[] => {
      const entries = input.split(/[,;\n]+/).filter(e => e.trim());
      const newBills: Bill[] = [];
      const existingMonths = new Set(bills.map(b => b.month));
      entries.forEach(entry => {
        const match = entry.trim().match(/^(\w+)[\s-]*(\d+)$/);
        if (match) {
          const [_, monthStr, consumptionStr] = match;
          const consumption = parseFloat(consumptionStr);
          const monthLower = monthStr.toLowerCase();
          const monthIndex = months.findIndex(m => m.toLowerCase().startsWith(monthLower));
          if (monthIndex !== -1) {
            const month = months[monthIndex];
            if (month && consumption > 0 && !existingMonths.has(month)) {
              newBills.push({ month, consumption, amount: calculateBillAmount(consumption), isEstimated: false });
              existingMonths.add(month);
            }
          }
        }
      });
      return newBills;
    }, [calculateBillAmount, bills]);
    
    const addBills = useCallback(() => {
        const newBills = parseBillInput(billInput);
        if (newBills.length > 0) {
            setBills(prevBills => [...prevBills, ...newBills].filter((bill, index, self) => 
                index === self.findIndex((b) => b.month === bill.month)
            ).sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month)));
            setBillInput('');
        }
    }, [billInput, parseBillInput, setBills, setBillInput]);
    
    const handleBillInputKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addBills();
        }
    };
    
    const removeBill = (index: number) => setBills(bills.filter((_, i) => i !== index));

    const addTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const newFrom = lastTier.to === Infinity ? (lastTier.from + 2000) : (Number(lastTier.to) + 1);
        setTiers([...tiers.slice(0, -1), { from: lastTier.from, to: newFrom - 1, rate: lastTier.rate }, { from: newFrom, to: Infinity, rate: parseFloat((lastTier.rate + 0.05).toFixed(2)) }]);
    };
    
    const updateTier = (index: number, field: keyof Tier, value: string) => {
        const newTiers = [...tiers];
        let numValue: number | typeof Infinity = field === 'rate' ? parseFloat(value) : parseInt(value, 10);
        if (isNaN(numValue as number)) {
            if (field === 'to') numValue = Infinity;
            else return;
        }
        (newTiers[index] as any)[field] = numValue;
        if (field === 'to' && index < newTiers.length - 1) {
           const nextTierFrom = numValue === Infinity ? newTiers[index].from + 2001 : (Number(numValue)) + 1;
           newTiers[index+1].from = nextTierFrom;
        }
        setTiers(newTiers);
    };

    const removeTier = (index: number) => {
        if (tiers.length > 1 && index > 0) { // Can't remove the first tier.
            const newTiers = tiers.slice(0, index); // Keep all tiers up to (but not including) the one at `index`.
            newTiers[index - 1].to = Infinity; // The new last tier now goes to infinity.
            setTiers(newTiers);
        }
    };

    return (
        <Card title="Electricity Bill Analysis">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <label htmlFor="bill-input" className="block text-sm font-medium text-gray-700 mb-1">Quick Bill Entry</label>
                    <textarea id="bill-input" value={billInput} onChange={(e) => setBillInput(e.target.value)} onKeyPress={handleBillInputKeyPress} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm h-28" placeholder="Enter bills like:&#10;Jan-8200&#10;Feb-5700&#10;Or comma-separated: Mar-2818, Apr-2217" />
                    <Button onClick={addBills} className="mt-2 w-full" variant="secondary">Add Bills</Button>
                </div>
                <div className="space-y-4">
                    <Input label="Fuel Surcharge (AED/kWh)" type="number" min="0" value={fuelSurcharge} onChange={(e) => setFuelSurcharge(parseFloat(e.target.value) || 0)} step="0.001"/>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-medium text-gray-700">Rate Tiers (AED/kWh)</h3><Button onClick={addTier} size="sm" variant="ghost" aria-label="Add Tier"><PlusCircle size={16} /></Button></div>
                        <div className="space-y-2">
                            {tiers.map((tier, index) => (
                                <div key={index} className="flex items-center gap-1 text-xs">
                                    <Input type="number" value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} className="w-16" aria-label="Tier From" disabled={index > 0} />
                                    <span>-</span>
                                    <Input type="number" value={tier.to === Infinity ? '' : tier.to} onChange={(e) => updateTier(index, 'to', e.target.value)} className="w-16" placeholder={tier.to === Infinity ? '∞' : 'To'} aria-label="Tier To" disabled={index === tiers.length - 1} />
                                    <Input type="number" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} className="w-16" step="0.01" placeholder="Rate" aria-label="Tier Rate"/>
                                    <Button onClick={() => removeTier(index)} size="sm" variant="danger" aria-label="Remove Tier" disabled={index === 0}><Trash2 size={14} /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {bills.length > 0 && (
                <div className="p-4 bg-white rounded-xl mt-6">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-md font-semibold text-gray-700">Added Bills ({bills.length})</h3><Button onClick={() => setBills([])} variant="ghost" className="text-red-500"><XCircle size={16} className="mr-1"/>Clear All</Button></div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {bills.map((bill, index) => (
                            <div key={index} className={`flex justify-between items-center p-2 rounded text-sm ${bill.isEstimated ? 'bg-blue-100 border border-blue-200' : 'bg-gray-100'}`} title={bill.isEstimated ? 'Estimated value' : 'User-provided value'}>
                                <span>{bill.month.substring(0,3)}: {bill.consumption}</span>
                                <div className="flex items-center">{bill.isEstimated && <Wand2 size={12} className="text-blue-500 mr-1" />}<Button onClick={() => removeBill(index)} size="sm" variant="danger" aria-label="Remove Bill"><Trash2 size={14} /></Button></div>
                            </div>
                        ))}
                    </div>
                    {bills.length > 0 && bills.length < 12 && (<div className="mt-4 text-center"><Button onClick={handleEstimateFromPartialData} variant="primary"><Wand2 size={16} className="mr-2"/>Estimate Full Year from {bills.length} Bill{bills.length > 1 ? 's' : ''}</Button></div>)}
                    {pendingEstimates.length > 0 && (
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h3 className="font-medium text-brand-primary mb-2">Estimated Months</h3>
                            {!bills.some(b => ['May', 'June', 'July', 'August', 'September'].includes(b.month)) && (<div className="text-xs text-amber-700 bg-amber-100 p-2 rounded-md mb-3"><strong>Note:</strong> The estimation is based on non-summer months. The projected annual consumption may be underestimated.</div>)}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                                {pendingEstimates.map((bill, index) => (<div key={index} className="flex items-center gap-2"><span className="text-sm w-12">{bill.month}</span><input type="number" value={bill.consumption} onChange={(e) => { const newEstimates = [...pendingEstimates]; newEstimates[index].consumption = parseFloat(e.target.value) || 0; setPendingEstimates(newEstimates); }} className="w-24 px-2 py-1 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"/></div>))}
                            </div>
                            <div className="flex gap-4"><Button onClick={() => { setBills(prev => [...prev.filter(b => !b.isEstimated), ...pendingEstimates].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month))); setPendingEstimates([]); }} variant="primary">Apply Estimates</Button><Button onClick={() => setPendingEstimates([])} variant="ghost">Cancel</Button></div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mt-6 p-4 rounded-lg bg-brand-light">
                        {[
                            { key: 'Daily Avg', value: `${fullYearConsumptionStats.dailyAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` },
                            { key: 'Avg Monthly', value: `${fullYearConsumptionStats.avgMonthly.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` },
                            { key: 'Total Annual', value: `${fullYearConsumptionStats.totalAnnual.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` },
                            { key: 'Summer Avg', value: `${seasonalAnalysis.summerAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/mo` }, 
                            { key: 'Winter Avg', value: `${seasonalAnalysis.winterAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/mo` },
                            { key: 'Summer Spike', value: `${seasonalAnalysis.spikePercentage.toLocaleString(undefined, {maximumFractionDigits:0})}%` },
                            { key: 'Base Load', value: `${seasonalAnalysis.baseLoad.toLocaleString(undefined, {maximumFractionDigits:0})} kWh`},
                            { key: 'Cooling Load', value: `${seasonalAnalysis.coolingLoad.toLocaleString(undefined, {maximumFractionDigits:0})} kWh`},
                        ].map(({key, value}) => (<div key={key}><p className="text-sm text-brand-primary">{key}</p><p className={`text-xl font-semibold ${key === 'Summer Spike' ? 'text-brand-secondary' : 'text-brand-dark'}`}>{value}</p></div>))}
                    </div>
                </div>
            )}
        </Card>
    );
};

const SystemParametersCard = ({ params, setParams, authority, batteryEnabled }) => {
    const { daytimeConsumption, availableSpace, peakSunHours, systemEfficiency, panelWattage, inverterRatio, panelOrientation, batteryEfficiency, usableDoD, isBifacialEnabled, showIdealOutput } = params;
    const [showLossesExplanation, setShowLossesExplanation] = useState(false);

    const handleChange = (field: string, value: any) => {
        let parsedValue = value;
        // Clamp values to logical ranges
        if (typeof value === 'string') {
            parsedValue = parseFloat(value);
            if (isNaN(parsedValue)) parsedValue = 0;
        }

        if (field === 'daytimeConsumption' || field === 'systemEfficiency') {
            parsedValue = Math.max(0, Math.min(100, parsedValue));
        } else if (field === 'batteryEfficiency' || field === 'usableDoD') {
             parsedValue = Math.max(0, Math.min(100, parsedValue));
        }

        setParams(prev => ({ ...prev, [field]: parsedValue }));
    };
    
    return (
        <Card title="System Parameters">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start">
                {authority === 'EtihadWE' && (<Input label="Daytime Use (%)" type="number" value={daytimeConsumption} onChange={(e) => handleChange('daytimeConsumption', e.target.value)} min="0" max="100" />)}
                <Input label="Available Space (m²)" type="number" min="0" value={availableSpace} onChange={(e) => handleChange('availableSpace', e.target.value)} />
                <Input label="Peak Sun Hours" type="number" min="0" value={peakSunHours} onChange={(e) => handleChange('peakSunHours', e.target.value)} step={0.1} />
                <Input label="System Efficiency (%)" type="number" min="0" max="100" value={systemEfficiency} onChange={(e) => handleChange('systemEfficiency', e.target.value)} />
                <Input label="Panel Wattage (W)" type="number" min="0" value={panelWattage} onChange={(e) => handleChange('panelWattage', e.target.value)} />
                <div className="md:col-span-2 lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inverter Sizing Ratio</label>
                    <Select value={inverterRatio} onChange={(e) => handleChange('inverterRatio', e.target.value)} className="w-full text-sm">
                        <option value={0.85}>0.85 – Cost-focused residential</option><option value={1.0}>1.00 – Net metering (DEWA)</option><option value={1.05}>1.05 – Light oversize (buffering)</option><option value={1.1}>1.10 – Commercial rooftops</option><option value={1.15}>1.15 – Hybrid with battery</option><option value={1.2}>1.20 – Industrial/export systems</option>
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Panel Orientation</label>
                    <div className="flex gap-2">
                        <Button onClick={() => setParams(p => ({...p, panelOrientation: 'portrait'}))} variant={panelOrientation === 'portrait' ? 'primary' : 'ghost'} className="w-full">Portrait</Button>
                        <Button onClick={() => setParams(p => ({...p, panelOrientation: 'landscape'}))} variant={panelOrientation === 'landscape' ? 'primary' : 'ghost'} className="w-full">Landscape</Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Affects space required calculation.</p>
                </div>
            </div>
            {authority === 'EtihadWE' && batteryEnabled && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-start mt-4 pt-4 border-t border-gray-200">
                     <Input label="Battery Efficiency (%)" type="number" value={batteryEfficiency} onChange={(e) => handleChange('batteryEfficiency', e.target.value)} min="0" max="100" />
                     <Input label="Battery Usable DoD (%)" type="number" value={usableDoD} onChange={(e) => handleChange('usableDoD', e.target.value)} min="0" max="100" />
                </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><input type="checkbox" id="bifacial-toggle" checked={isBifacialEnabled} onChange={(e) => setParams(p=>({...p, isBifacialEnabled: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" /><label htmlFor="bifacial-toggle" className="text-sm text-gray-600">Bifacial Panels (+7% Boost)</label></div>
                    <div className="flex items-center gap-2"><input type="checkbox" id="ideal-output-toggle" checked={showIdealOutput} onChange={(e) => setParams(p=>({...p, showIdealOutput: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" /><label htmlFor="ideal-output-toggle" className="text-sm text-gray-600">Ideal Output (No Losses)</label></div>
                </div>
                <div>
                    <button onClick={() => setShowLossesExplanation(!showLossesExplanation)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">How is production calculated? {showLossesExplanation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                    {showLossesExplanation && (<div className="mt-2 p-3 bg-gray-50 border rounded-lg text-xs text-gray-700 space-y-3"><p>A system's final output is determined by its ideal potential minus several distinct types of losses, which are multiplied together:</p><div><h4 className="font-semibold text-gray-800">1. System Component Efficiency ({systemEfficiency}%)</h4><p className="mb-1">Accounts for energy lost within the physical equipment (inverter, wiring, etc.).</p></div><div><h4 className="font-semibold text-gray-800">2. Environmental & Soiling Factor ({Math.round(REAL_WORLD_LOSS_FACTOR * 100)}%)</h4><p className="mb-1">Accounts for production loss due to dust, temperature, and other on-site conditions.</p></div><div><h4 className="font-semibold text-gray-800">3. Bifacial Boost ({isBifacialEnabled ? '7%' : '0%'})</h4><p>An extra energy gain from light reflected onto the back of bifacial panels.</p></div><p className="font-semibold mt-3 pt-2 border-t">Final Production = Ideal Production &times; System Efficiency &times; Environmental Factor &times; Bifacial Boost</p></div>)}
                </div>
            </div>
        </Card>
    );
};

const RecommendedSystemCard = ({ systemRecommendation, availableSpace, authority, batteryEnabled, setBatteryEnabled, batteryMode, setBatteryMode }) => (
    <Card title="Recommended System">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemRecommendation.systemSize} kWp</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary text-center"><p className="text-sm text-brand-primary">Number of Panels</p><p className="text-2xl font-bold text-brand-primary">{systemRecommendation.panelCount}</p></div>
            <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">Space Required</p><p className="text-2xl font-bold">~{systemRecommendation.spaceRequired} m²</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary text-center"><p className="text-sm text-brand-primary">Annual Production</p><p className="text-2xl font-bold text-brand-primary">{systemRecommendation.annualProduction.toLocaleString()} kWh</p></div>
            <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">Inverter Capacity</p><p className="text-2xl font-bold">{systemRecommendation.inverterCapacity} kW</p></div>
        </div>
        
        {systemRecommendation.sizingStrategy && (
             <div className="text-center text-xs text-gray-500 italic mb-4 p-2 bg-gray-50 rounded-md flex items-center justify-center gap-2">
                <Info size={14} /> {systemRecommendation.sizingStrategy}
            </div>
        )}

        {systemRecommendation.unusedSolar > 0 && authority === 'EtihadWE' && (!batteryEnabled || batteryMode !== 'night') && (
            <div className="text-sm text-amber-600 my-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              Estimated unused solar: <strong>{systemRecommendation.unusedSolar.toLocaleString()} kWh/year</strong>. 
              <button className="underline text-brand-primary ml-1" onClick={() => { setBatteryEnabled(true); setBatteryMode('unused'); }} > Store this?</button>
            </div>
        )}
        
        {batteryEnabled && authority === 'EtihadWE' && (<div className="text-center mb-6"><p className="text-sm text-gray-600">Recommended Battery Capacity</p><p className="text-xl font-semibold text-brand-primary">{systemRecommendation.batteryCapacity} kWh</p></div>)}

        <div className="mb-6"><h3 className="text-lg font-semibold mb-3 text-brand-primary">Seasonal Coverage Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><p className="text-sm text-gray-600">Summer Coverage</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-brand-secondary" style={{width: `${systemRecommendation.summerCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-brand-primary">{systemRecommendation.summerCoverage}%</p></div>
                <div><p className="text-sm text-gray-600">Winter Coverage</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-brand-primary" style={{width: `${systemRecommendation.winterCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-brand-primary">{systemRecommendation.winterCoverage}%</p></div>
                <div><p className="text-sm text-gray-600">Annual Average</p<div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-green-500" style={{width: `${systemRecommendation.annualCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-green-600">{systemRecommendation.annualCoverage}%</p></div>
            </div>
        </div>
        {systemRecommendation.spaceRequired > availableSpace && (<div className="bg-red-100 border border-red-300 rounded-lg p-4 flex items-center gap-2 text-sm mt-4"><AlertCircle className="w-5 h-5 text-red-600" /><p className="text-red-800">Warning: Required space ({systemRecommendation.spaceRequired} m²) exceeds available space ({availableSpace} m²).</p></div>)}
    </Card>
);

const FinancialAnalysisCard = ({ financialAnalysis, roiParams, setRoiParams, authority }) => {
    const { systemCost, firstYearDegradation, degradationRate, escalationRate, escalateFuelSurcharge, creditExpiryMonths } = roiParams;

    const handleChange = (field: string, value: any, isToggle = false) => {
        let parsedValue = isToggle ? value : parseFloat(value);
        if (isNaN(parsedValue)) parsedValue = 0;
        
        // Clamp values to logical ranges
        if (['firstYearDegradation', 'degradationRate', 'escalationRate'].includes(field)) {
            parsedValue = Math.max(0, parsedValue);
        }

        setRoiParams(prev => ({ ...prev, [field]: parsedValue }));
    };
    
    const generateMonthlyData = () => months.map(month => ({ month: month.substring(0, 3), Consumption: roiParams.bills.find(b => b.month === month)?.consumption || roiParams.fullYearConsumptionStats.avgMonthly, Production: Math.round(roiParams.monthlyProductionMap[month] || 0) }));
    
    return (
        <Card title="Financial & ROI Analysis">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2 gap-4 mb-6">
                <Input label="System Cost (AED)" type="number" min="0" value={systemCost} onChange={(e) => setRoiParams(p => ({...p, systemCost: e.target.value}))} placeholder="Enter total cost..." />
                <Input label="Price Escalation (%/yr)" type="number" min="0" value={escalationRate} onChange={(e) => handleChange('escalationRate', e.target.value)} step="0.1" />
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-6 items-start">
                <Input label="First Year Degradation (%)" type="number" min="0" value={firstYearDegradation} onChange={(e) => handleChange('firstYearDegradation', e.target.value)} step="0.1" />
                <Input label="Annual Degradation (%)" type="number" min="0" value={degradationRate} onChange={(e) => handleChange('degradationRate', e.target.value)} step="0.01" />
                <div className="flex items-center gap-2 pt-7"><input type="checkbox" id="escalate-fuel-toggle" checked={escalateFuelSurcharge} onChange={(e) => handleChange('escalateFuelSurcharge', e.target.checked, true)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" /><label htmlFor="escalate-fuel-toggle" className="text-sm text-gray-600">Escalate Fuel Surcharge</label></div>
                {authority === 'DEWA' && <Input label="Credit Expiry (Months)" type="number" min="1" value={creditExpiryMonths} onChange={(e) => setRoiParams(p => ({...p, creditExpiryMonths: parseInt(e.target.value) || 12}))} />}
            </div>

            {parseFloat(systemCost) > 0 && (<>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                    <div className="bg-green-100 border border-green-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">First-Year Savings</p><p className="text-xl font-bold text-green-700">AED {financialAnalysis.annualSavings.toLocaleString()}</p></div>
                    <div className="bg-green-100 border border-green-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Avg Monthly Savings</p><p className="text-xl font-bold text-green-700">AED {financialAnalysis.monthlySavings.toLocaleString()}</p></div>
                    <div className="bg-blue-100 border border-blue-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Payback Period</p><p className="text-xl font-bold text-blue-700">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} yrs` : 'N/A'}</p></div>
                    <div className="bg-amber-100 border border-amber-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">ROI %</p><p className="text-xl font-bold text-amber-700">{financialAnalysis.roiPercentage}%</p></div>
                    <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">Bill Offset</p><p className="text-2xl font-bold">{financialAnalysis.billOffsetPercentage}%</p></div>
                    <div className="bg-purple-100 border border-purple-200 p-4 rounded-lg text-center col-span-2 lg:col-span-2"><p className="text-sm text-gray-600">25-Year Net Profit</p><p className="text-xl font-bold text-purple-700">AED {financialAnalysis.roi25YearNetProfit.toLocaleString()}</p></div>
                    <div className="bg-purple-100 border border-purple-200 p-4 rounded-lg text-center col-span-2 lg:col-span-3"><p className="text-sm text-gray-600">25-Year Net Value</p><p className="text-xl font-bold text-purple-700">AED {financialAnalysis.roi25YearNetValue.toLocaleString()}</p></div>
                </div>
                {authority === 'DEWA' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 my-4 text-sm text-center space-y-2">
                        <div><p className="font-semibold text-green-800">Net Metering Savings (Y1)</p><p className="text-green-700"><strong>{financialAnalysis.netMeteringSavedKwh.toLocaleString()} kWh</strong> / <strong>AED {financialAnalysis.netMeteringSavedAed.toLocaleString()}</strong></p><p className="text-xs text-gray-600">Total energy savings from direct consumption and used credits.</p></div>
                        <div className="border-t pt-2"><p className="font-semibold text-green-800">Rollover Credits (End of Y1)</p><p className="text-green-700"><strong>{financialAnalysis.netMeteringCreditKwh.toLocaleString()} kWh</strong> / <strong>AED {financialAnalysis.netMeteringCreditsValue.toLocaleString()}</strong></p><p className="text-xs text-gray-600">Excess credits carried forward to offset future bills (expires after {creditExpiryMonths} months).</p></div>
                    </div>
                )}
                <div className="mt-6"><h3 className="text-lg font-semibold mb-3 text-brand-primary">Monthly Consumption vs. Production</h3><ResponsiveContainer width="100%" height={300}><BarChart data={generateMonthlyData()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Consumption" fill="#003366" /><Bar dataKey="Production" fill="#FFD700" /></BarChart></ResponsiveContainer></div>
            </>)}
        </Card>
    );
};

const EnvironmentalImpactCard = ({ environmentalAnalysis }) => (
    <Card title="Environmental Impact">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 text-brand-primary border border-blue-200 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                <Leaf size={32} />
                <div>
                    <p className="text-2xl font-bold">{(environmentalAnalysis.lifetimeCo2SavingsKg / 1000).toLocaleString(undefined, {maximumFractionDigits: 1})}</p>
                    <p className="text-sm font-semibold">Tonnes CO₂ Saved (25 Yrs)</p>
                </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                 <Trees size={32} className="text-green-600"/>
                <div>
                    <p className="text-xl font-bold text-green-700">{environmentalAnalysis.lifetimeTreesPlanted.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                    <p className="text-sm text-gray-600">Trees Planted Equiv.</p>
                </div>
            </div>
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                 <Car size={32} className="text-yellow-500"/>
                <div>
                    <p className="text-2xl font-bold ">{environmentalAnalysis.lifetimeCarsOffRoad.toLocaleString()}</p>
                    <p className="text-sm font-semibold">Cars Off Road Equiv.</p>
                </div>
            </div>
        </div>
        <p className="text-xs text-center text-gray-500 mt-4">Based on an emissions factor of {CO2_EMISSIONS_FACTOR_KG_PER_KWH} kg CO₂ per kWh for the UAE grid.</p>
    </Card>
);

const CalculationBreakdownCard = ({ showBreakdown, setShowBreakdown, fullCalculationBreakdown }) => (
    <Card>
        <button onClick={() => setShowBreakdown(!showBreakdown)} className="w-full flex justify-between items-center text-left font-semibold text-gray-700">
            <span>Full Calculation Breakdown</span>
            {showBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showBreakdown && (<textarea readOnly value={fullCalculationBreakdown} className="w-full h-96 mt-4 p-2 font-mono text-xs bg-gray-900 text-green-400 rounded-lg border border-gray-700" />)}
    </Card>
);

// --- MAIN PAGE COMPONENT ---
const CalculatorPage: React.FC = () => {
  // Config State
  const [projectName, setProjectName] = useState<string>('');
  const [city, setCity] = useState('Dubai');
  const [authority, setAuthority] = useState<'DEWA' | 'EtihadWE'>('EtihadWE');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(false);
  const [batteryMode, setBatteryMode] = useState<'night' | 'unused'>('night');

  // Bill State
  const [bills, setBills] = useState<Bill[]>([]);
  const [billInput, setBillInput] = useState<string>('');
  const [tiers, setTiers] = useState<Tier[]>([ { from: 1, to: 2000, rate: 0.23 }, { from: 2001, to: 4000, rate: 0.28 }, { from: 4001, to: 6000, rate: 0.32 }, { from: 6001, to: Infinity, rate: 0.38 } ]);
  const [pendingEstimates, setPendingEstimates] = useState<Bill[]>([]);
  const [fuelSurcharge, setFuelSurcharge] = useState<number>(0.05);

  // System Parameters State
  const [systemParams, setSystemParams] = useState({
    daytimeConsumption: 55, availableSpace: 100, peakSunHours: 5.5, systemEfficiency: 95, panelWattage: 610,
    inverterRatio: 1.05, panelOrientation: 'portrait' as 'portrait' | 'landscape', batteryEfficiency: 90, usableDoD: 100,
    isBifacialEnabled: true, showIdealOutput: false,
  });

  // ROI State
  const [roiParams, setRoiParams] = useState({
    systemCost: '', firstYearDegradation: 2.0, degradationRate: 0.5, escalationRate: 1.5,
    escalateFuelSurcharge: false, creditExpiryMonths: 12,
  });

  // UI State
  const [showBreakdown, setShowBreakdown] = useState(false);

  // --- DERIVED STATE & CALCULATIONS ---
  const { daytimeConsumption, peakSunHours, systemEfficiency, panelWattage, panelOrientation, showIdealOutput, isBifacialEnabled, inverterRatio, batteryEfficiency, usableDoD } = systemParams;

  const loadProjectData = useCallback((data: any) => {
    const auth = data.authority || 'EtihadWE';
    setProjectName(data.projectName || '');
    setCity(data.city || 'Dubai');
    setAuthority(auth);
    setBatteryEnabled(data.batteryEnabled ?? false);
    setBills(data.bills || []);
    setTiers(data.tiers || [ { from: 1, to: 2000, rate: 0.23 }, { from: 2001, to: 4000, rate: 0.28 }, { from: 4001, to: 6000, rate: 0.32 }, { from: 6001, to: Infinity, rate: 0.38 } ]);
    setFuelSurcharge(data.fuelSurcharge ?? (auth === 'DEWA' ? 0.06 : 0.05));
    setSystemParams(prev => ({ ...prev, 
        daytimeConsumption: data.daytimeConsumption || 55, availableSpace: data.availableSpace || 100, peakSunHours: data.peakSunHours || 5.5,
        systemEfficiency: data.systemEfficiency || 95, panelWattage: data.panelWattage || 610, panelOrientation: data.panelOrientation || 'portrait',
        batteryEfficiency: data.batteryEfficiency || 90, usableDoD: data.usableDoD || 100, inverterRatio: data.inverterRatio || (auth === 'DEWA' ? 1.0 : 1.05),
        isBifacialEnabled: data.isBifacialEnabled ?? true,
    }));
    setBatteryMode(data.batteryMode || 'night');
    setRoiParams(prev => ({ ...prev, 
        systemCost: data.systemCost || '', firstYearDegradation: data.firstYearDegradation || 2.0, degradationRate: data.degradationRate || 0.5,
        escalationRate: data.escalationRate || 1.5, escalateFuelSurcharge: data.escalateFuelSurcharge ?? false, creditExpiryMonths: data.creditExpiryMonths || 12,
    }));
  }, []);
  
  useEffect(() => {
    const aiConfigString = sessionStorage.getItem('aiProjectConfig');
    if (aiConfigString) {
      try {
        loadProjectData(JSON.parse(aiConfigString));
        alert('Project configuration applied from AI Assistant!');
      } catch (error) { console.error("Failed to parse AI configuration:", error); } 
      finally { sessionStorage.removeItem('aiProjectConfig'); }
    }
  }, [loadProjectData]);

  useEffect(() => {
    setSystemParams(p => ({...p, inverterRatio: authority === 'DEWA' ? 1.0 : 1.05}));
    setFuelSurcharge(authority === 'DEWA' ? 0.06 : 0.05);
  }, [authority]);

  const calculateBillAmount = useCallback((consumption: number) => calculateBillAmountForConsumption(consumption, tiers, fuelSurcharge), [tiers, fuelSurcharge]);
  const getAverageRate = useCallback((consumption: number) => consumption <= 0 ? tiers[0]?.rate || 0 : calculateBillAmountForConsumption(consumption, tiers, 0) / consumption, [tiers]);

  const handleEstimateFromPartialData = useCallback(() => {
    if (bills.length === 0 || bills.length >= 12) return;
    const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
    const totalBaseConsumption = bills.reduce((sum: number, bill) => sum + (bill.consumption / cityFactors[bill.month]), 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;
    const userProvidedMonths = new Set(bills.map(b => b.month));
    const estimatedBills = months.filter(month => !userProvidedMonths.has(month)).map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * cityFactors[month]);
        return { month, consumption: estimatedConsumption, amount: calculateBillAmount(estimatedConsumption), isEstimated: true };
    });
    setPendingEstimates(estimatedBills);
  }, [bills, calculateBillAmount, city]);
  
  const seasonalAnalysis = useMemo(() => {
    if (bills.length === 0) return { summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0 };
    const summerMonths = ['May', 'June', 'July', 'August', 'September'];
    const winterMonths = months.filter(m => !summerMonths.includes(m));
    const summerBills = bills.filter(bill => summerMonths.includes(bill.month));
    const winterBills = bills.filter(bill => winterMonths.includes(bill.month));
    const summerAvg = summerBills.length > 0 ? summerBills.reduce((sum, bill) => sum + bill.consumption, 0) / summerBills.length : 0;
    const winterAvg = winterBills.length > 0 ? winterBills.reduce((sum, bill) => sum + bill.consumption, 0) / winterBills.length : 0;
    const spikePercentage = winterAvg > 0 ? ((summerAvg - winterAvg) / winterAvg) * 100 : 0;
    return { summerAvg: Math.round(summerAvg), winterAvg: Math.round(winterAvg), spikePercentage: Math.round(spikePercentage), baseLoad: Math.round(winterAvg), coolingLoad: Math.round(summerAvg - winterAvg) };
  }, [bills]);

  const fullYearConsumptionStats = useMemo(() => {
    if (bills.length === 0) return { totalAnnual: 0, avgMonthly: 0, dailyAvg: 0 };
    const consumptionByMonth = months.reduce((acc, month) => {
        const bill = bills.find(b => b.month === month);
        if (bill) {
            acc[month] = bill.consumption;
        }
        return acc;
    }, {} as Record<string, number>);
    
    if (Object.keys(consumptionByMonth).length < 12) {
        const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
        const providedBills = bills.filter(b => consumptionByMonth[b.month]);
        const totalProvidedConsumption = providedBills.reduce((sum: number, bill) => sum + bill.consumption, 0);
        const totalProvidedFactor = providedBills.reduce((sum: number, bill) => sum + (cityFactors[bill.month] || 1), 0);
        const baseConsumption = totalProvidedFactor > 0 ? totalProvidedConsumption / totalProvidedFactor : 0;
        months.forEach(month => {
            if (!consumptionByMonth[month]) consumptionByMonth[month] = Math.round(baseConsumption * (cityFactors[month] || 1));
        });
    }
    const totalAnnual = Object.values(consumptionByMonth).reduce((sum: number, c: number) => sum + c, 0);
    return { totalAnnual, avgMonthly: totalAnnual / 12, dailyAvg: totalAnnual / 365 };
  }, [bills, city]);

  const systemMetrics = useMemo(() => {
    if (fullYearConsumptionStats.totalAnnual === 0) return { systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, actualSystemSize: 0, sizingStrategy: '' };
    let targetConsumption = fullYearConsumptionStats.dailyAvg;
    let sizingStrategy = '';

    if (authority === 'EtihadWE' && !batteryEnabled) {
      targetConsumption *= (daytimeConsumption / 100);
      sizingStrategy = `Sizing based on offsetting daytime consumption (~${daytimeConsumption}%) for EtihadWE.`
    } else if (authority === 'DEWA') {
      sizingStrategy = 'Sizing based on 100% annual consumption due to DEWA net-metering.';
    } else {
      sizingStrategy = 'Sizing based on 100% annual consumption for EtihadWE with battery.';
    }

    const effectiveProductionFactor = (showIdealOutput ? 1 : REAL_WORLD_LOSS_FACTOR) * (showIdealOutput ? 1 : systemEfficiency / 100) * (isBifacialEnabled ? BIFACIAL_BOOST_FACTOR : 1);
    const requiredSystemSize = (targetConsumption / peakSunHours) / effectiveProductionFactor;
    const panelCount = Math.ceil((requiredSystemSize * 1000) / panelWattage);
    const actualSystemSize = (panelCount * panelWattage) / 1000;
    const spacePerPanel = panelOrientation === 'portrait' ? SPACE_PER_PANEL_PORTRAIT : SPACE_PER_PANEL_LANDSCAPE;
    const spaceRequired = panelCount * spacePerPanel;
    const annualProduction = actualSystemSize * peakSunHours * 365 * effectiveProductionFactor;
    return { systemSize: Math.round(actualSystemSize * 10) / 10, panelCount, spaceRequired: Math.round(spaceRequired), annualProduction: Math.round(annualProduction), actualSystemSize, sizingStrategy };
  }, [fullYearConsumptionStats.totalAnnual, fullYearConsumptionStats.dailyAvg, authority, batteryEnabled, daytimeConsumption, peakSunHours, systemEfficiency, panelWattage, showIdealOutput, isBifacialEnabled, panelOrientation]);

  const monthlyProductionMap = useMemo(() => {
    const { annualProduction } = systemMetrics;
    if (annualProduction === 0) return months.reduce((acc, month) => ({ ...acc, [month]: 0 }), {});
    const seasonalFactors = CITY_SEASONAL_FACTORS[city];
    const totalFactor = months.reduce((sum, m) => sum + seasonalFactors[m], 0);
    return months.reduce((acc, month) => ({...acc, [month]: (annualProduction * (seasonalFactors[month] / totalFactor))}), {} as { [key: string]: number });
  }, [systemMetrics.annualProduction, city]);

  const systemRecommendation = useMemo(() => {
    const { actualSystemSize, annualProduction } = systemMetrics;
    const { totalAnnual, avgMonthly, dailyAvg } = fullYearConsumptionStats;
    const inverterCapacity = Math.ceil(actualSystemSize * inverterRatio * 10) / 10;
    const idealBatteryEfficiency = showIdealOutput ? 1 : (batteryEfficiency / 100);
    const idealUsableDoD = showIdealOutput ? 1 : (usableDoD / 100);
    let batteryCapacity = 0, unusedSolar = 0;

    if (systemMetrics.annualProduction > 0 && totalAnnual > 0) {
        let totalSelfConsumed = months.reduce((acc: number, month) => {
            const monthlyProd = monthlyProductionMap[month] || 0;
            const monthlyCons = (bills.find(b => b.month === month)?.consumption || avgMonthly);
            return acc + (authority === 'EtihadWE' ? Math.min(monthlyProd, monthlyCons * (daytimeConsumption / 100)) : Math.min(monthlyProd, monthlyCons));
        }, 0);
        unusedSolar = Math.round(systemMetrics.annualProduction - totalSelfConsumed);
    }
    
    if (authority === 'EtihadWE' && batteryEnabled) {
        if (batteryMode === 'night') batteryCapacity = Math.ceil((dailyAvg * (1 - daytimeConsumption / 100)) / (idealBatteryEfficiency * idealUsableDoD));
        else if (batteryMode === 'unused') batteryCapacity = Math.ceil((unusedSolar / 365) / (idealBatteryEfficiency * idealUsableDoD));
    }

    const summerMonths = ['May', 'June', 'July', 'August', 'September'];
    const summerProductionAvg = summerMonths.reduce((sum, m) => sum + (monthlyProductionMap[m] || 0), 0) / summerMonths.length;
    const winterProductionAvg = months.filter(m => !summerMonths.includes(m)).reduce((sum, m) => sum + (monthlyProductionMap[m] || 0), 0) / (12 - summerMonths.length);
    const summerCoverage = seasonalAnalysis.summerAvg > 0 ? (summerProductionAvg / seasonalAnalysis.summerAvg) * 100 : 100;
    const winterCoverage = seasonalAnalysis.winterAvg > 0 ? (winterProductionAvg / seasonalAnalysis.winterAvg) * 100 : 100;
    
    return { ...systemMetrics, inverterCapacity, batteryCapacity, unusedSolar,
        summerCoverage: Math.min(Math.round(summerCoverage), 100), winterCoverage: Math.min(Math.round(winterCoverage), 100),
        annualCoverage: totalAnnual > 0 ? Math.min(Math.round((annualProduction / totalAnnual) * 100), 100) : 100,
        dailyAvgConsumption: Math.round(dailyAvg),
        idealBatteryEfficiency, idealUsableDoD
    };
  }, [systemMetrics, fullYearConsumptionStats, seasonalAnalysis, authority, batteryEnabled, batteryMode, daytimeConsumption, inverterRatio, showIdealOutput, batteryEfficiency, usableDoD, monthlyProductionMap, bills]);

  const financialAnalysis = useMemo<FinancialAnalysis>(() => {
    const parsedSystemCost = parseFloat(String(roiParams.systemCost));
    if (isNaN(parsedSystemCost) || parsedSystemCost <= 0 || bills.length === 0 || systemRecommendation.annualProduction === 0) {
        return { annualSavings: 0, monthlySavings: 0, paybackPeriod: 0, roi25YearNetProfit: 0, roi25YearNetValue: 0, roiPercentage: 0, netMeteringCreditsValue: 0, billOffsetPercentage: 0, netMeteringSavedKwh: 0, netMeteringSavedAed: 0, netMeteringCreditKwh: 0, yearlyBreakdown: [] };
    }
    const roiParamsForCalc = {
      ...roiParams,
      firstYearDegradation: roiParams.firstYearDegradation / 100,
      degradationRate: roiParams.degradationRate / 100,
      escalationRate: roiParams.escalationRate / 100,
    };
    return calculateFinancialAnalysis({
        systemCost: parsedSystemCost, bills, authority, batteryEnabled, batteryMode, daytimeConsumption, monthlyProductionMap,
        systemRecommendation, roiParams: roiParamsForCalc, tiers, fuelSurcharge, fullYearConsumptionStats, getAverageRate
    });
  }, [roiParams.systemCost, bills, authority, batteryEnabled, batteryMode, daytimeConsumption, monthlyProductionMap, systemRecommendation, roiParams, tiers, fuelSurcharge, fullYearConsumptionStats, getAverageRate]);

  const environmentalAnalysis = useMemo(() => {
    const annualProduction = systemRecommendation.annualProduction;
    const annualCo2SavingsKg = annualProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH;
    return {
      lifetimeCo2SavingsKg: annualCo2SavingsKg * 25,
      lifetimeTreesPlanted: (annualCo2SavingsKg / 21.77) * 25,
      lifetimeCarsOffRoad: Math.ceil((annualCo2SavingsKg * 25) / 4600),
    };
  }, [systemRecommendation.annualProduction]);

  const copyReport = () => {
    const totalAnnual = fullYearConsumptionStats.totalAnnual;
    let summary = `SOLAR OASIS - PROJECT REPORT\n============================\nProject: ${projectName || 'N/A'}\nAuthority: ${authority}\nDate: ${new Date().toLocaleDateString()}\n\nCONSUMPTION ANALYSIS\n--------------------\nAnnual Consumption: ${Number(totalAnnual).toLocaleString(undefined, {maximumFractionDigits:0})} kWh\nAvg Monthly Bill: AED ${Number(calculateBillAmount(fullYearConsumptionStats.avgMonthly)).toLocaleString(undefined, {maximumFractionDigits:0})}\n\nRECOMMENDED SYSTEM\n------------------\nSystem Size: ${systemRecommendation.systemSize} kWp\nAnnual Production: ${Number(systemRecommendation.annualProduction).toLocaleString()} kWh\nBill Offset: ${financialAnalysis.billOffsetPercentage}%${batteryEnabled ? `\nBattery Capacity: ${systemRecommendation.batteryCapacity} kWh` : ''}\n\nFINANCIAL ANALYSIS\n------------------\nSystem Cost: AED ${parseFloat(String(roiParams.systemCost)).toLocaleString()}\nFirst-Year Savings: AED ${Number(financialAnalysis.annualSavings).toLocaleString()}\nPayback Period: ${financialAnalysis.paybackPeriod} years\n25-Year Net Profit: AED ${Number(financialAnalysis.roi25YearNetProfit).toLocaleString()}\nROI: ${financialAnalysis.roiPercentage}%\n${authority === 'DEWA' ? `Net-Metering Savings (Y1): ${Number(financialAnalysis.netMeteringSavedKwh).toLocaleString()} kWh (AED ${Number(financialAnalysis.netMeteringSavedAed).toLocaleString()})\nRollover Credits (End of Y1): ${Number(financialAnalysis.netMeteringCreditKwh).toLocaleString()} kWh (AED ${Number(financialAnalysis.netMeteringCreditsValue).toLocaleString()})` : ''}\n\nENVIRONMENTAL IMPACT\n--------------------\n25-Year CO₂ Savings: ${(Number(environmentalAnalysis.lifetimeCo2SavingsKg) / 1000).toLocaleString(undefined, {maximumFractionDigits:1})} Tonnes\nEquivalent to taking ${Number(environmentalAnalysis.lifetimeCarsOffRoad).toLocaleString()} cars off the road.`;
    navigator.clipboard.writeText(summary).then(() => alert('Report copied to clipboard!'));
  };

  const fullCalculationBreakdown = useMemo(() => {
      let text = `FULL CALCULATION BREAKDOWN\n============================\n`;
      if (!roiParams.systemCost || bills.length === 0) return text + "Please enter bills and system cost to see the full breakdown.";
      text += `[SYSTEM SIZING & PRODUCTION]\n- Final Annual Production = ${systemRecommendation.annualProduction.toFixed(0)} kWh\n- Sizing Strategy: ${systemMetrics.sizingStrategy}\n\n`;
      text += `[FINANCIAL LOGIC - ${authority}]\n`;
      if (authority === 'DEWA') text += `- DEWA uses a net-metering system with credits expiring after ${roiParams.creditExpiryMonths} months.\n\n`;
      else text += `- EtihadWE savings are based on direct self-consumption${batteryEnabled ? ` with a battery for ${batteryMode} usage.` : '.'}\n\n`;
      if (financialAnalysis.yearlyBreakdown?.length > 0) {
        text += `[25-YEAR FINANCIAL FORECAST]\nYear | Output   | Savings (AED) | Cash Flow (AED) | Cumulative (AED)\n----------------------------------------------------------------------\n`;
        financialAnalysis.yearlyBreakdown.forEach(d => { text += `${d.year.toString().padEnd(5)}| ${(d.degradation * 100).toFixed(1).padStart(7)}% | ${Math.round(d.savings).toLocaleString().padStart(13)} | ${Math.round(d.cashFlow).toLocaleString().padStart(15)} | ${Math.round(d.cumulativeCashFlow).toLocaleString().padStart(16)}\n`; });
      }
      return text;
  }, [authority, batteryEnabled, roiParams.systemCost, bills, systemRecommendation, financialAnalysis, roiParams.creditExpiryMonths, batteryMode, systemMetrics.sizingStrategy]);

  const saveProject = () => {
    const projectData = { projectName, city, authority, batteryEnabled, bills, tiers, fuelSurcharge, batteryMode, ...systemParams, ...roiParams };
    const dataStr = JSON.stringify(projectData, null, 2);
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    link.download = `${projectName.replace(/\s/g, '_') || 'solar_project'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try { loadProjectData(JSON.parse(event.target?.result as string)); alert('Project imported successfully!'); } 
        catch (err) { alert('Failed to import project. Please check the file format.'); }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  return (
    <div className="space-y-6">
        <Button asChild variant="ghost"><label htmlFor="import-project" className="cursor-pointer flex items-center text-brand-primary font-semibold"><Upload size={16} className="mr-2"/> Import Project</label></Button>
        <input type="file" id="import-project" className="hidden" accept=".json" onChange={importProject}/>
        
        <ProjectConfigurationCard {...{ projectName, setProjectName, city, setCity, authority, setAuthority, batteryEnabled, setBatteryEnabled, batteryMode, setBatteryMode }} />
        <BillAnalysisCard {...{ bills, setBills, billInput, setBillInput, tiers, setTiers, fuelSurcharge, setFuelSurcharge, seasonalAnalysis, fullYearConsumptionStats, handleEstimateFromPartialData, pendingEstimates, setPendingEstimates }} />
        <SystemParametersCard params={systemParams} setParams={setSystemParams} authority={authority} batteryEnabled={batteryEnabled} />
      
        {bills.length > 0 && (
            <>
                <RecommendedSystemCard {...{ systemRecommendation, availableSpace: systemParams.availableSpace, authority, batteryEnabled, setBatteryEnabled, batteryMode, setBatteryMode }} />
                <FinancialAnalysisCard 
                    financialAnalysis={financialAnalysis}
                    authority={authority}
                    roiParams={{...roiParams, bills, fullYearConsumptionStats, monthlyProductionMap}}
                    setRoiParams={setRoiParams}
                />
                <EnvironmentalImpactCard environmentalAnalysis={environmentalAnalysis} />
                <Card title="Export & Save">
                    <div className="flex flex-wrap items-center gap-4">
                        <Button onClick={copyReport} disabled={!roiParams.systemCost || bills.length === 0}><Copy className="w-5 h-5 mr-2" /> Copy Report</Button>
                        <Button onClick={saveProject} disabled={bills.length === 0} variant="secondary"><Save className="w-5 h-5 mr-2" /> Save Project</Button>
                    </div>
                </Card>
                <CalculationBreakdownCard showBreakdown={showBreakdown} setShowBreakdown={setShowBreakdown} fullCalculationBreakdown={fullCalculationBreakdown} />
            </>
        )}
    </div>
  );
};

export default CalculatorPage;