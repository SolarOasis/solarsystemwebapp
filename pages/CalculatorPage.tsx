import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select, Table, Modal } from '../components/ui';
import { Sun, Battery, AlertCircle, Trash2, PlusCircle, Wand2, Info, Upload, Copy, Save, Leaf, ChevronDown, ChevronUp, Car, Trees, Home, XCircle, HelpCircle, ChevronRight, Loader } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// Type definitions
interface Bill {
  month: string;
  consumption: number;
  isEstimate?: boolean;
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

interface DewaYearlyBreakdown {
  year: number;
  direct_use_kwh: number;
  stored_as_credits_kwh: number;
  credits_used_kwh: number;
  rollover_kwh: number;
  rollover_value: number;
}

interface FinancialAnalysis {
  firstYearSavings: number;
  avgMonthlySavings: number;
  paybackPeriod: number;
  roi25YearNetProfit: number;
  roi25YearNetValue: number;
  roiPercentage: number;
  billOffsetPercentage: number;
  dewa_year1_direct_use_kwh: number;
  dewa_year1_stored_as_credits_kwh: number;
  dewa_year1_credits_used_kwh: number;
  dewa_year1_rollover_kwh: number;
  dewa_year1_rollover_value: number;
  yearlyBreakdown: YearlyBreakdown[];
  dewaYearlyBreakdown: DewaYearlyBreakdown[];
  totalOriginalBillYear1: number;
}

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
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
const DAYS_IN_MONTH: { [month: string]: number } = {
  January: 31, February: 28, March: 31, April: 30, May: 31, June: 30,
  July: 31, August: 31, September: 30, October: 31, November: 30, December: 31
};
const CO2_EMISSIONS_FACTOR_KG_PER_KWH = 0.7;
const BIFACIAL_BOOST_FACTOR = 1.07;
const SPACE_PER_PANEL_PORTRAIT = 2.1;
const SPACE_PER_PANEL_LANDSCAPE = 2.4;
const months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SYSTEM_COMPONENT_EFFICIENCY = 0.95;
const ENVIRONMENTAL_FACTOR = 0.93;
const VALIDATION_RULES = {
    peakSunHours: { min: 4.0, max: 7.0, step: 0.1 },
    firstYearDegradation: { min: 0, max: 5, step: 0.1 },
    degradationRate: { min: 0, max: 1, step: 0.01 },
    fuelSurcharge: { min: 0, max: 0.2, step: 0.001 },
    escalationRate: { min: 0, max: 10, step: 0.1 }
};


// --- UTILITY FUNCTIONS ---
const calculateBillAmountForConsumption = (consumption: number, tiers: Tier[], fuelSurcharge: number, options: { escalate?: boolean; escalateFuelSurcharge?: boolean; escalationRate?: number; year?: number; meterCharges?: number } = {}): number => {
    if (isNaN(consumption) || consumption < 0) consumption = 0;
    const { escalate = false, escalateFuelSurcharge = false, escalationRate = 0, year = 1, meterCharges = 0 } = options;
    const escalationFactor = escalate ? Math.pow(1 + (escalationRate || 0), year - 1) : 1;
    
    const finalTiers = escalate ? tiers.map(t => ({ ...t, rate: t.rate * escalationFactor })) : tiers;
    let billAmount = 0;
    
    const sortedTiers = [...finalTiers].sort((a, b) => a.from - b.from);
    
    let consumed = 0;
    for (const tier of sortedTiers) {
        if (consumption <= consumed) break;
        const tierStart = Math.max(tier.from, consumed + 1);
        const tierEnd = tier.to === Infinity ? consumption : Math.min(tier.to, consumption);
        const consumptionInThisTier = Math.max(0, tierEnd - tierStart + 1);
        billAmount += consumptionInThisTier * tier.rate;
        consumed = tierEnd;
    }

    const finalFuelSurcharge = escalateFuelSurcharge ? fuelSurcharge * escalationFactor : fuelSurcharge;
    return billAmount + (consumption * finalFuelSurcharge) + (meterCharges || 0);
};

const getMarginalRate = (consumption: number, tiers: Tier[]): number => {
    if (consumption <= 0) return tiers[0]?.rate || 0;
    const sortedTiers = [...tiers].sort((a,b) => a.from - b.from);
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
        const tier = sortedTiers[i];
        if (consumption >= tier.from) {
            return tier.rate;
        }
    }
    return tiers[0]?.rate || 0;
};

// --- FINANCIAL CALCULATION CORE LOGIC ---
const calculateFinancialAnalysis = (params: {
    systemCost: number, bills: Bill[], authority: 'DEWA' | 'EtihadWE', dewaDaytimeConsumption: number,
    monthlyProductionMap: { [key: string]: number }, systemRecommendation: any, meterCharges: number,
    roiParams: any, systemParams: any, tiers: Tier[], fuelSurcharge: number, fullYearConsumptionStats: any
}): FinancialAnalysis => {
    const { systemCost, bills, authority, dewaDaytimeConsumption, monthlyProductionMap, roiParams, systemParams, tiers, fuelSurcharge, fullYearConsumptionStats, systemRecommendation, meterCharges } = params;
    const { firstYearDegradation, degradationRate, escalationRate, escalateFuelSurcharge } = roiParams;
    const { daytimeConsumption, usableDoD, batteryEfficiency, batteryEnabled, batteryMode } = systemParams;
    const creditExpiryMonths = 12;

    const getDaytimeRatio = () => authority === 'DEWA' ? dewaDaytimeConsumption / 100 : daytimeConsumption / 100;

    const consumptionByMonth = months.reduce((acc, month) => ({ ...acc, [month]: fullYearConsumptionStats.avgMonthly }), {} as { [key:string]: number });
    bills.forEach(b => { if (b.consumption > 0) consumptionByMonth[b.month] = b.consumption });

    let cumulativeCashFlow = -systemCost;
    let paybackPeriodYears = 0;
    let year1_annual_savings = 0;
    let creditQueue: { year: number, monthIndex: number, kwh: number }[] = [];
    const yearlyBreakdown: YearlyBreakdown[] = [];
    let totalOriginalBillYear1 = 0;
    const dewaYearlyBreakdown: DewaYearlyBreakdown[] = [];
    
    for (let year = 1; year <= 25; year++) {
        let yearlySavings = 0;
        const degradationFactor = (1 - firstYearDegradation) * Math.pow(1 - degradationRate, year - 1);
        let yearly_direct_use_kwh = 0;
        let yearly_stored_as_credits_kwh = 0;
        let yearly_credits_used_kwh = 0;

        months.forEach((monthName, monthIndex) => {
            const currentMonthAbsolute = (year - 1) * 12 + monthIndex;
            creditQueue = creditQueue.filter(credit => (currentMonthAbsolute - ((credit.year - 1) * 12 + credit.monthIndex)) < creditExpiryMonths);
            
            const monthlyConsumption = consumptionByMonth[monthName];
            const monthlyProduction = (monthlyProductionMap[monthName] || 0) * degradationFactor;

            const opts = { escalate: true, escalateFuelSurcharge, escalationRate, year, meterCharges };
            const originalBill = calculateBillAmountForConsumption(monthlyConsumption, tiers, fuelSurcharge, opts);
            if (year === 1) {
                totalOriginalBillYear1 += calculateBillAmountForConsumption(monthlyConsumption, tiers, fuelSurcharge, {escalate: false, meterCharges: meterCharges});
            }

            if (authority === 'DEWA') {
                const daytimeConsumptionRatio = getDaytimeRatio();
                const monthlyDaytimeLoad = monthlyConsumption * daytimeConsumptionRatio;
                const monthlyNighttimeLoad = monthlyConsumption * (1 - daytimeConsumptionRatio);
                
                const monthly_self_consumed = Math.min(monthlyProduction, monthlyDaytimeLoad);
                const monthly_exported_to_grid = Math.max(0, monthlyProduction - monthlyDaytimeLoad);
                
                const daytimeDeficit = Math.max(0, monthlyDaytimeLoad - monthlyProduction);
                const monthly_imported_from_grid = monthlyNighttimeLoad + daytimeDeficit;
                
                yearly_direct_use_kwh += monthly_self_consumed;
                
                if (monthly_exported_to_grid > 0) {
                    creditQueue.push({ year, monthIndex, kwh: monthly_exported_to_grid });
                    yearly_stored_as_credits_kwh += monthly_exported_to_grid;
                }

                let deficit = monthly_imported_from_grid;
                let usedFromQueueThisMonth = 0;
                for (const credit of creditQueue) {
                    if (deficit <= 0) break;
                    const draw = Math.min(deficit, credit.kwh);
                    credit.kwh -= draw;
                    deficit -= draw;
                    usedFromQueueThisMonth += draw;
                }
                yearly_credits_used_kwh += usedFromQueueThisMonth;
                creditQueue = creditQueue.filter(c => c.kwh > Number.EPSILON);

                const finalBill = calculateBillAmountForConsumption(deficit, tiers, fuelSurcharge, opts);
                yearlySavings += (originalBill - finalBill);

            } else { // EtihadWE
                let savedKwh = 0;
                if (batteryEnabled && systemRecommendation.batteryCapacity > 0) {
                    let monthlySavedKwh = 0;
                    const daysInMonth = DAYS_IN_MONTH[monthName];
                    const daytimeConsumptionRatio = getDaytimeRatio();

                    for(let i=0; i < daysInMonth; i++){
                        const dailyProduction = monthlyProduction / daysInMonth;
                        const dailyConsumption = monthlyConsumption / daysInMonth;
                        const dailyDaytimeLoad = dailyConsumption * daytimeConsumptionRatio;
                        const dailyNighttimeLoad = dailyConsumption - dailyDaytimeLoad;

                        if (batteryMode === 'unused') {
                            // Store unused solar mode - system sized for daytime only
                            const solarDirectlyUsed = Math.min(dailyProduction, dailyDaytimeLoad);
                            const excessSolar = Math.max(0, dailyProduction - solarDirectlyUsed);
                            const energyStoredInBattery = Math.min(excessSolar * batteryEfficiency, systemRecommendation.batteryCapacity * usableDoD);
                            const energyDischargedForNight = Math.min(dailyNighttimeLoad, energyStoredInBattery);
                            monthlySavedKwh += solarDirectlyUsed + energyDischargedForNight;
                        } else { // 'night' mode - nighttime backup, system sized for 100%
                            const solarDirectlyUsed = Math.min(dailyProduction, dailyDaytimeLoad);
                            const excessSolarForCharging = Math.max(0, dailyProduction - solarDirectlyUsed);
                            const energyStoredInBattery = Math.min(excessSolarForCharging * batteryEfficiency, systemRecommendation.batteryCapacity * usableDoD);
                            const energyDischargedFromBattery = Math.min(dailyNighttimeLoad, energyStoredInBattery);
                            monthlySavedKwh += solarDirectlyUsed + energyDischargedFromBattery;
                        }
                    }
                    savedKwh = monthlySavedKwh
                } else {
                    const daytimeConsumptionKwh = monthlyConsumption * getDaytimeRatio();
                    savedKwh = Math.min(monthlyProduction, daytimeConsumptionKwh);
                }
                const newBill = calculateBillAmountForConsumption(monthlyConsumption - savedKwh, tiers, fuelSurcharge, opts);
                yearlySavings += originalBill - newBill;
            }
        });

        if (authority === 'DEWA') {
            const highestTierRate = tiers.reduce((max, tier) => Math.max(max, tier.rate), 0);
            const yearly_rollover_kwh = creditQueue.reduce((acc, c) => acc + c.kwh, 0);
            const yearly_rollover_value = yearly_rollover_kwh * highestTierRate;
            dewaYearlyBreakdown.push({ year, direct_use_kwh: yearly_direct_use_kwh, stored_as_credits_kwh: yearly_stored_as_credits_kwh, credits_used_kwh: yearly_credits_used_kwh, rollover_kwh: yearly_rollover_kwh, rollover_value: yearly_rollover_value });
        }

        if (year === 1) year1_annual_savings = yearlySavings;
        const cashFlow = yearlySavings;
        cumulativeCashFlow += cashFlow;
        if (paybackPeriodYears === 0 && cumulativeCashFlow >= 0) {
            const lastYearCumulative = cumulativeCashFlow - cashFlow;
            const lastCashFlow = yearlyBreakdown[year-2]?.cashFlow || cashFlow;
            paybackPeriodYears = lastCashFlow > 0 ? (year - 1 + (Math.abs(lastYearCumulative) / lastCashFlow)) : 0;
        }
        yearlyBreakdown.push({ year, savings: yearlySavings, degradation: degradationFactor, cashFlow, cumulativeCashFlow });
    }
    
    const dewa_year1_data = dewaYearlyBreakdown.find(d => d.year === 1) || { direct_use_kwh: 0, stored_as_credits_kwh: 0, credits_used_kwh: 0, rollover_kwh: 0, rollover_value: 0 };

    const roi25YearNetProfit = cumulativeCashFlow;
    const roi25YearNetValue = roi25YearNetProfit + systemCost;
    const roiPercentage = systemCost > 0 ? (roi25YearNetProfit / systemCost) * 100 : Infinity;
    const billOffsetPercentage = totalOriginalBillYear1 > 0 ? (year1_annual_savings / totalOriginalBillYear1) * 100 : 0;
    
    return {
        firstYearSavings: year1_annual_savings,
        avgMonthlySavings: year1_annual_savings / 12,
        paybackPeriod: paybackPeriodYears,
        roi25YearNetProfit,
        roi25YearNetValue,
        roiPercentage,
        billOffsetPercentage,
        dewa_year1_direct_use_kwh: dewa_year1_data.direct_use_kwh,
        dewa_year1_stored_as_credits_kwh: dewa_year1_data.stored_as_credits_kwh,
        dewa_year1_credits_used_kwh: dewa_year1_data.credits_used_kwh,
        dewa_year1_rollover_kwh: dewa_year1_data.rollover_kwh,
        dewa_year1_rollover_value: dewa_year1_data.rollover_value,
        yearlyBreakdown,
        dewaYearlyBreakdown,
        totalOriginalBillYear1,
    };
};

// --- UI SUB-COMPONENTS ---
const ToastMessage = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    return (
        <div className={`p-4 rounded-lg shadow-lg flex items-center justify-between text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            <span>{toast.message}</span>
            <button onClick={() => onDismiss(toast.id)} className="ml-2 p-1 rounded-full hover:bg-white/20">
                <XCircle size={18} />
            </button>
        </div>
    );
};

const ToastContainer: React.FC<{ notifications: ToastNotification[]; onDismiss: (id: number) => void }> = ({ notifications, onDismiss }) => (
    <div className="fixed top-4 right-4 z-50 w-full max-w-xs space-y-2">
        {notifications.map(toast => (
            <ToastMessage key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
    </div>
);

const CustomBatteryToggle = ({ enabled, onChange, disabled = false }) => {
  const baseClasses = "flex items-center justify-center gap-2 p-2 rounded-md transition-colors text-sm w-full";
  const enabledClasses = "bg-brand-secondary text-brand-primary font-semibold";
  const disabledClasses = "bg-gray-200 text-gray-700";

  return (
    <button onClick={() => !disabled && onChange(!enabled)} disabled={disabled} aria-label={`Battery storage ${enabled ? 'enabled' : 'disabled'}`} className={`${baseClasses} ${enabled ? enabledClasses : disabledClasses} ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-yellow-300'}`}>
      <Battery size={16}/> {enabled ? 'Enabled' : 'Disabled'}
    </button>
  );
};

const ProjectConfigurationCard = ({ projectName, setProjectName, authority, setAuthority, city, setCity, handleSaveProject, handleLoadProject, copyReport }) => (
    <Card title="Project Configuration" actions={
        <div className="flex items-center gap-2">
            <Button onClick={handleLoadProject} variant="ghost"><Upload className="h-4 w-4 mr-2" /> Load</Button>
            <Button onClick={handleSaveProject} variant="ghost"><Save className="h-4 w-4 mr-2" /> Save</Button>
            <Button onClick={() => copyReport()} variant="secondary"><Copy className="h-4 w-4 mr-2"/> Copy Report</Button>
        </div>
    }>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Input label="Project Name" placeholder="e.g., Villa Solar Project" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <Select label="City / Emirate" value={city} onChange={e => setCity(e.target.value)}>
                {Object.keys(CITY_SEASONAL_FACTORS).map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
             <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Authority</label>
                <div className="flex rounded-lg border p-1">
                    <Button onClick={() => setAuthority('DEWA')} className="flex-1" variant={authority === 'DEWA' ? 'primary' : 'ghost'}>DEWA</Button>
                    <Button onClick={() => setAuthority('EtihadWE')} className="flex-1" variant={authority === 'EtihadWE' ? 'primary' : 'ghost'}>EtihadWE</Button>
                </div>
            </div>
        </div>
    </Card>
);

const BillAnalysisCard = ({ bills, setBills, tiers, setTiers, fuelSurcharge, setFuelSurcharge, meterCharges, setMeterCharges, fullYearConsumptionStats, onEstimateFullYear, showEstimateWarning, addNotification, authority }) => {
    const [quickBillEntry, setQuickBillEntry] = useState('');
    
    const handleFuelSurchargeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        const { min, max } = VALIDATION_RULES.fuelSurcharge;
        if (!isNaN(val)) {
            setFuelSurcharge(Math.max(min, Math.min(max, val)));
        }
    };

    const removeBill = (index: number) => setBills(bills.filter((_, i) => i !== index));

    const handleAddBillsFromQuickEntry = () => {
        const cleanedInput = quickBillEntry.replace(/,/g, '\n');
        const lines = cleanedInput.split('\n').filter(line => line.trim() !== '');
        const parsedBills: Bill[] = [];
    
        const monthRegex = new RegExp(`(${months.map(m => m.slice(0,3)).join('|')})`, 'i');
    
        lines.forEach(line => {
            const monthMatch = line.match(monthRegex);
            if (monthMatch) {
                const monthName = months.find(m => m.toLowerCase().startsWith(monthMatch[0].toLowerCase()));
                const consumptionMatch = line.slice(monthMatch.index + monthMatch[0].length).match(/[\d.]+/);
                if (monthName && consumptionMatch) {
                    const consumption = parseFloat(consumptionMatch[0]);
                    if (!isNaN(consumption)) {
                        parsedBills.push({ month: monthName, consumption });
                    }
                }
            }
        });
    
        if (parsedBills.length > 0) {
            setBills(prev => {
                const existingMonths = new Set(prev.map(b => b.month));
                const uniqueNewBills = parsedBills.filter(b => !existingMonths.has(b.month));
                if (uniqueNewBills.length === 0) {
                    addNotification({ message: 'All parsed bills are for months already entered.', type: 'error' });
                    return prev;
                }
                addNotification({ message: `Added ${uniqueNewBills.length} new bill(s).`, type: 'success' });
                return [...prev, ...uniqueNewBills].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
            });
            setQuickBillEntry('');
        } else {
            addNotification({ message: 'Could not parse any valid bills from the input.', type: 'error' });
        }
    };
    
    const addTierRow = () => {
        const lastTier = tiers[tiers.length - 1];
        if (lastTier && lastTier.to !== Infinity) {
            setTiers([...tiers, { from: lastTier.to + 1, to: Infinity, rate: 0 }]);
        }
    };
    
    const updateTier = (index: number, field: 'from' | 'to' | 'rate', value: string) => {
        const newTiers = [...tiers];
        const currentTier = { ...newTiers[index] };
    
        let parsedValue = field === 'rate' ? parseFloat(value) : parseInt(value, 10);
        
        if (isNaN(parsedValue)) {
            currentTier[field] = field === 'to' ? Infinity : 0;
        } else {
            currentTier[field] = Math.max(0, parsedValue);
        }
    
        newTiers[index] = currentTier;
    
        for (let i = index; i < newTiers.length - 1; i++) {
            const prevTier = newTiers[i];
            const nextTier = newTiers[i + 1];
            if (prevTier.to !== Infinity && typeof prevTier.to === 'number') {
                if(nextTier) nextTier.from = prevTier.to + 1;
            }
        }
        setTiers(newTiers);
    };
    
    const removeTier = (indexToRemove: number) => {
       if(indexToRemove > 0 && tiers.length > 1){
            const newTiers = [...tiers];
            const prevTier = newTiers[indexToRemove - 1];
            prevTier.to = Infinity;
            setTiers(newTiers.slice(0, indexToRemove));
       }
    };

    const { avgMonthly, total, winterAvg, summerAvg, dailyAvg, summerSpike, baseLoad, coolingLoad } = fullYearConsumptionStats;

    if (bills.length === 0) {
        return (
            <Card title="Step 1: Electricity Bill Analysis">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-semibold text-gray-800 mb-2">Quick Bill Entry</h4>
                        <p className="text-xs text-gray-500 mb-2">Enter bills like: Jan-8200, Feb 5700. Or comma-separated: Mar-2818, Apr-2217.</p>
                        <textarea value={quickBillEntry} onChange={e => setQuickBillEntry(e.target.value)} rows={4} placeholder="Paste data here..." className="w-full p-2 border rounded-md text-sm mb-2"/>
                        <Button onClick={handleAddBillsFromQuickEntry} variant="secondary" className="w-full">Add Bills</Button>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-800 mb-2">Tariff Structure ({authority})</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <Input label="Fuel Surcharge (AED/kWh)" type="number" min="0" step="0.001" value={fuelSurcharge} onChange={handleFuelSurchargeChange} />
                            <Input label="Fixed Meter Charges (AED/Month)" type="number" min="0" step="1" value={meterCharges} onChange={e => setMeterCharges(Number(e.target.value))} />
                        </div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Rate Tiers (AED/kWh)</label>
                         <div className="hidden md:grid md:grid-cols-8 gap-2 text-sm font-medium text-gray-500 px-2 pb-1">
                            <div className="md:col-span-2">From</div>
                            <div className="md:col-span-1"></div>
                            <div className="md:col-span-2">To</div>
                            <div className="md:col-span-2">Rate</div>
                        </div>
                        <div className="space-y-2">
                             {tiers.map((tier, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-8 items-center gap-2 p-2 border rounded-md md:p-0 md:border-none">
                                    <div className="md:col-span-2">
                                        <Input label="From (kWh)" type="number" min="1" value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} disabled={index > 0} />
                                    </div>
                                    <div className="hidden md:flex md:col-span-1 items-center justify-center">-</div>
                                    <div className="md:col-span-2">
                                        <Input label="To (kWh)" type="number" min={tier.from} value={tier.to === Infinity ? '' : tier.to} placeholder="∞" onChange={(e) => updateTier(index, 'to', e.target.value)} disabled={tier.to === Infinity} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input label="Rate (AED/kWh)" type="number" min="0" step="0.01" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-1 flex justify-end">
                                        <Button variant="danger" size="sm" onClick={() => removeTier(index)} disabled={index === 0 && tiers.length === 1}><Trash2 size={16} /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" onClick={addTierRow} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Tier</Button>
                    </div>
                </div>
                 <div className="mt-8 pt-8 border-t text-center text-gray-500">
                    <HelpCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <h3 className="text-lg font-semibold">Get Started</h3>
                    <p>Enter your electricity bills above to calculate your solar savings potential.</p>
                </div>
            </Card>
        );
    }
    
    return (
        <Card title="Step 1: Electricity Bill Analysis">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Quick Bill Entry</h4>
                    <p className="text-xs text-gray-500 mb-2">Enter bills like: Jan-8200, Feb 5700. Or comma-separated: Mar-2818, Apr-2217.</p>
                    <textarea value={quickBillEntry} onChange={e => setQuickBillEntry(e.target.value)} rows={2} placeholder="Paste data here..." className="w-full p-2 border rounded-md text-sm mb-2"/>
                    <Button onClick={handleAddBillsFromQuickEntry} variant="secondary" className="w-full">Add Manual Bills</Button>

                    <div className="flex justify-between items-center mb-2 mt-6">
                        <h4 className="font-semibold text-gray-800">Added Bills ({bills.length})</h4>
                        <Button variant="ghost" size="sm" onClick={() => setBills([])} className="text-red-500"><XCircle className="h-4 w-4 mr-1"/> Clear All</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {bills.map((bill, index) => (
                            <div key={index} className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                                <p className="text-sm font-medium flex-1">{bill.month.slice(0,3)}: {bill.consumption}</p>
                                <Button variant="ghost" size="sm" onClick={() => removeBill(index)}><Trash2 size={14} className="text-red-500"/></Button>
                            </div>
                        ))}
                    </div>

                    {bills.length > 0 && bills.length < 12 && (
                       <div className="mt-4">
                           <Button onClick={onEstimateFullYear} className="w-full">
                               <Wand2 className="mr-2 h-4 w-4"/> Estimate Full Year from {bills.length} Bills
                           </Button>
                           {showEstimateWarning && (
                               <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-lg text-xs flex items-center gap-2">
                                   <AlertCircle className="h-4 w-4 flex-shrink-0"/>
                                   <p>Warning: Estimating from only winter months may be less accurate due to seasonal consumption changes.</p>
                               </div>
                           )}
                       </div>
                    )}
                 </div>
                 <div>
                     <h4 className="font-semibold text-gray-800 mb-2">Tariff Structure ({authority})</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                       <Input label="Fuel Surcharge (AED/kWh)" type="number" step={VALIDATION_RULES.fuelSurcharge.step} value={fuelSurcharge} onChange={handleFuelSurchargeChange} />
                       <Input label="Fixed Meter Charges (AED/Month)" type="number" min="0" step="1" value={meterCharges} onChange={e => setMeterCharges(Number(e.target.value))} />
                    </div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Rate Tiers (AED/kWh)</label>
                     <div className="hidden md:grid md:grid-cols-8 gap-2 text-sm font-medium text-gray-500 px-2 pb-1">
                        <div className="md:col-span-2">From</div>
                        <div className="md:col-span-1"></div>
                        <div className="md:col-span-2">To</div>
                        <div className="md:col-span-2">Rate</div>
                    </div>
                    <div className="space-y-2">
                        {tiers.map((tier, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-8 items-center gap-2 p-2 border rounded-md md:p-0 md:border-none">
                                <div className="md:col-span-2">
                                    <Input label="From (kWh)" type="number" min="1" value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} disabled={index > 0} />
                                </div>
                                <div className="hidden md:flex md:col-span-1 items-center justify-center">-</div>
                                <div className="md:col-span-2">
                                    <Input label="To (kWh)" type="number" min={tier.from} value={tier.to === Infinity ? '' : tier.to} placeholder="∞" onChange={(e) => updateTier(index, 'to', e.target.value)} disabled={tier.to === Infinity} />
                                </div>
                                <div className="md:col-span-2">
                                    <Input label="Rate (AED/kWh)" type="number" min="0" step="0.01" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} />
                                </div>
                                <div className="md:col-span-1 flex justify-end">
                                    <Button variant="danger" size="sm" onClick={() => removeTier(index)} disabled={index === 0 && tiers.length === 1}><Trash2 size={16} /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={addTierRow} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Tier</Button>
                 </div>
            </div>
             <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Daily Avg</p>
                    <p className="text-lg font-bold text-brand-primary">{dailyAvg.toFixed(0)} kWh</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Avg Monthly</p>
                    <p className="text-lg font-bold text-brand-primary">{avgMonthly.toLocaleString('en-US', {maximumFractionDigits:0})} kWh</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Total Annual</p>
                    <p className="text-lg font-bold text-brand-primary">{total.toLocaleString('en-US', {maximumFractionDigits:0})} kWh</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Summer Avg</p>
                    <p className="text-lg font-bold text-brand-primary">{summerAvg.toLocaleString('en-US', {maximumFractionDigits:0})} kWh/mo</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Winter Avg</p>
                    <p className="text-lg font-bold text-brand-primary">{winterAvg.toLocaleString('en-US', {maximumFractionDigits:0})} kWh/mo</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Summer Spike</p>
                    <p className="text-lg font-bold text-yellow-500">{summerSpike.toFixed(0)}%</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Base Load</p>
                    <p className="text-lg font-bold text-brand-primary">{baseLoad.toLocaleString('en-US', {maximumFractionDigits:0})} kWh</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Cooling Load</p>
                    <p className="text-lg font-bold text-brand-primary">{coolingLoad.toLocaleString('en-US', {maximumFractionDigits:0})} kWh</p>
                 </div>
             </div>
        </Card>
    );
};


const SystemParametersCard = ({ systemParams, setSystemParams, idealOutput, setIdealOutput, authority, dewaDaytimeConsumption, setDewaDaytimeConsumption }) => {
    const [isProductionCalcOpen, setIsProductionCalcOpen] = useState(false);
    
    const handleParamChange = (key, value, rule) => {
        let numValue = Number(value);
        if (isNaN(numValue)) return;
        numValue = Math.max(rule.min, Math.min(rule.max, numValue));
        setSystemParams(prev => ({ ...prev, [key]: numValue }));
    };

    return (
    <Card title="Step 2: System Parameters">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {authority === 'DEWA' && (
                 <Input 
                    label="Daytime Consumption (%)" 
                    type="number"
                    min="0" max="100"
                    value={dewaDaytimeConsumption} 
                    onChange={(e) => setDewaDaytimeConsumption(Number(e.target.value))}
                    helperText="Default 60% for typical residential usage. Affects financial and coverage calculations."
                />
            )}
            {authority === 'EtihadWE' && (
                <Input 
                    label="Daytime Use (%)" 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={systemParams.daytimeConsumption} 
                    onChange={e => setSystemParams({ ...systemParams, daytimeConsumption: Math.min(100, Number(e.target.value)) })} 
                    helperText="Daytime hours energy use. Affects savings & battery sizing."
                />
            )}
            {authority === 'EtihadWE' && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Battery Storage</label>
                    <CustomBatteryToggle enabled={systemParams.batteryEnabled} onChange={(val) => setSystemParams(prev => ({...prev, batteryEnabled: val}))} />
                </div>
            )}
            {authority === 'EtihadWE' && systemParams.batteryEnabled && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Battery Mode</label>
                    <div className="flex rounded-lg border p-1">
                        <Button onClick={() => setSystemParams(prev => ({...prev, batteryMode: 'night'}))} className="flex-1" variant={systemParams.batteryMode === 'night' ? 'primary' : 'ghost'}>Nighttime Backup</Button>
                        <Button onClick={() => setSystemParams(prev => ({...prev, batteryMode: 'unused'}))} className="flex-1" variant={systemParams.batteryMode === 'unused' ? 'primary' : 'ghost'}>Store Unused</Button>
                    </div>
                </div>
            )}
            <Input label="Available Space (m²)" type="number" min="0" value={systemParams.availableSpace} onChange={e => setSystemParams({ ...systemParams, availableSpace: Math.max(0, Number(e.target.value)) })} />
            <Input label="Peak Sun Hours (PSH)" type="number" step={VALIDATION_RULES.peakSunHours.step} value={systemParams.peakSunHours} onChange={e => handleParamChange('peakSunHours', e.target.value, VALIDATION_RULES.peakSunHours)} />
            <Input label="Panel Wattage (W)" type="number" min="1" max="1000" value={systemParams.panelWattage} onChange={e => setSystemParams({ ...systemParams, panelWattage: Math.min(1000, Math.max(1, Number(e.target.value))) })} />
            
             <Select label="Inverter Sizing Ratio" value={systemParams.inverterRatio} disabled={authority === 'DEWA'} onChange={e => setSystemParams({ ...systemParams, inverterRatio: Number(e.target.value) })}>
                <option value={0.85}>0.85 – Cost-focused residential</option>
                <option value={1.00}>1.00 – Net metering (DEWA)</option>
                <option value={1.05}>1.05 – Light oversize (buffering)</option>
                <option value={1.10}>1.10 – Commercial rooftops</option>
                <option value={1.15}>1.15 – Hybrid with battery</option>
                <option value={1.20}>1.20 – Industrial/export systems</option>
            </Select>

             <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Panel Orientation</label>
                 <div className="flex rounded-lg border p-1">
                    <Button onClick={() => setSystemParams({ ...systemParams, panelOrientation: 'Portrait' })} className="flex-1" variant={systemParams.panelOrientation === 'Portrait' ? 'primary' : 'ghost'}>Portrait</Button>
                    <Button onClick={() => setSystemParams({ ...systemParams, panelOrientation: 'Landscape' })} className="flex-1" variant={systemParams.panelOrientation === 'Landscape' ? 'primary' : 'ghost'}>Landscape</Button>
                </div>
                <p className="text-xs text-gray-500">Affects space required calculation.</p>
            </div>
            
             {authority === 'EtihadWE' && systemParams.batteryEnabled && (
                <>
                    <Input label="Usable DoD (%)" type="number" min="0" max="100" value={systemParams.usableDoD * 100} onChange={e => setSystemParams({ ...systemParams, usableDoD: Math.min(100, Number(e.target.value)) / 100 })} />
                    <Input label="Battery Efficiency (%)" type="number" min="0" max="100" value={systemParams.batteryEfficiency * 100} onChange={e => setSystemParams({ ...systemParams, batteryEfficiency: Math.min(100, Number(e.target.value)) / 100 })} />
                </>
            )}

            <div className="md:col-span-3 grid grid-cols-2 gap-4">
                 <div className="flex items-center gap-2">
                    <input type="checkbox" id="bifacial" checked={systemParams.isBifacialEnabled} onChange={e => setSystemParams({ ...systemParams, isBifacialEnabled: e.target.checked })} className="h-4 w-4 text-brand-primary rounded focus:ring-brand-primary" />
                    <label htmlFor="bifacial" className="text-sm font-medium text-gray-700">Bifacial Panels (+7% Boost)</label>
                </div>
                 <div className="flex items-center gap-2">
                    <input type="checkbox" id="ideal" checked={idealOutput} onChange={e => setIdealOutput(e.target.checked)} className="h-4 w-4 text-brand-primary rounded focus:ring-brand-primary" />
                    <label htmlFor="ideal" className="text-sm font-medium text-gray-700">Ideal Output (No Losses)</label>
                </div>
            </div>
             <div className="md:col-span-3 mt-4 pt-4 border-t">
                 <button onClick={() => setIsProductionCalcOpen(!isProductionCalcOpen)} className="text-sm font-medium text-brand-primary hover:underline flex items-center">
                    How is production calculated? 
                    {isProductionCalcOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </button>
                {isProductionCalcOpen && (
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-3">
                        <p>A system's final output is determined by its ideal potential minus several distinct types of losses, which are multiplied together:</p>
                        <ol className="space-y-3 list-decimal list-inside">
                            <li>
                                <strong>Inverter Clipping:</strong><br/>
                                <span className="text-xs">Energy is "clipped" or lost when the panels produce more power than the inverter can handle. This is controlled by the Inverter Sizing Ratio.</span>
                            </li>
                            <li>
                                <strong>System Component Efficiency ({SYSTEM_COMPONENT_EFFICIENCY * 100}%):</strong><br/>
                                <span className="text-xs">Accounts for energy lost within the physical equipment (inverter, wiring, etc.).</span>
                                <div className="pl-4 mt-2">
                                    <h5 className="font-semibold text-xs text-gray-600">System Component Efficiency Losses (Total: ~5%)</h5>
                                    <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 text-gray-600">
                                        <li>Inverter Losses: 2-3%</li>
                                        <li>DC Wiring Losses: 1-2%</li>
                                        <li>AC Wiring Losses: 0.5-1%</li>
                                        <li>Transformer Losses: 0.5-1% (if present)</li>
                                        <li>Monitoring/Controls: 0.2-0.5%</li>
                                    </ul>
                                </div>
                            </li>
                            <li>
                                <strong>Environmental & Soiling Factor ({ENVIRONMENTAL_FACTOR * 100}%):</strong><br/>
                                <span className="text-xs">Accounts for production loss due to dust, temperature, and other on-site conditions.</span>
                                <div className="pl-4 mt-2">
                                     <h5 className="font-semibold text-xs text-gray-600">Environmental & Soiling Factor Losses (Total: ~7%)</h5>
                                    <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 text-gray-600">
                                        <li>Temperature Losses: 3-5% (UAE's high heat significantly reduces panel efficiency)</li>
                                        <li>Soiling Losses: 2-4% (dust/sand accumulation - higher in UAE desert climate)</li>
                                        <li>Shading Losses: 0-2% (partial shading, inter-row shading)</li>
                                        <li>Mismatch Losses: 1-2% (panel variations, aging differences)</li>
                                        <li>Availability Losses: 0.5-1% (maintenance downtime, equipment failures)</li>
                                    </ul>
                                </div>
                            </li>
                            {systemParams.isBifacialEnabled && (
                                <li>
                                    <strong>Bifacial Boost (7%):</strong><br/>
                                    <span className="text-xs">An extra energy gain from light reflected onto the back of bifacial panels.</span>
                                </li>
                            )}
                        </ol>
                        <p className="font-mono bg-gray-200 p-2 rounded text-xs text-center mt-4">
                            Final Production = MIN(Unclipped Production, Inverter Limit) × System Efficiency × Environmental Factor {systemParams.isBifacialEnabled && '× Bifacial Boost'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    </Card>
)};

const RecommendedSystemCard = ({ systemRecommendation, authority, batteryEnabled, onAddBattery, tiers, fullYearConsumptionStats }) => {
    const [isUnusedSolarModalOpen, setIsUnusedSolarModalOpen] = useState(false);
    
    const showUnusedSolarWarning = authority === 'EtihadWE' && !batteryEnabled && systemRecommendation.annualProduction > 0 && systemRecommendation.unusedSolarKwh > 0;
    
    const handleAddAndClose = () => {
        onAddBattery(); // Calls handler in parent
        setIsUnusedSolarModalOpen(false); // Closes modal
    };

    const isWarning = systemRecommendation.sizingNote.includes('Warning:');
    
    return (
     <>
        <Card title="Recommended System" className="bg-gray-50">
            {showUnusedSolarWarning && (
                <button onClick={() => setIsUnusedSolarModalOpen(true)} className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    <AlertCircle size={14} /> UNUSED SOLAR
                </button>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-brand-primary rounded-lg text-white">
                    <h4 className="text-sm opacity-80">System Size</h4>
                    <p className="text-3xl font-bold">{systemRecommendation.actualSystemSize.toFixed(1)} <span className="text-lg opacity-80">kWp</span></p>
                </div>
                 <div className="p-4 bg-yellow-400 rounded-lg text-brand-primary">
                    <h4 className="text-sm font-semibold">Number of Panels</h4>
                    <p className="text-3xl font-bold">{systemRecommendation.panelCount}</p>
                </div>
                 <div className="p-4 bg-white border rounded-lg text-brand-primary">
                    <h4 className="text-sm text-gray-600">Space Required</h4>
                    <p className="text-3xl font-bold">~{systemRecommendation.spaceRequired.toFixed(0)} <span className="text-lg">m²</span></p>
                </div>
                 <div className="p-4 bg-yellow-400 rounded-lg text-brand-primary">
                    <h4 className="text-sm font-semibold">Annual Production</h4>
                    <p className="text-3xl font-bold">{systemRecommendation.annualProduction.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                </div>
                 <div className="p-4 bg-brand-primary rounded-lg text-white">
                    <h4 className="text-sm opacity-80">Inverter Capacity</h4>
                    <p className="text-3xl font-bold">{systemRecommendation.inverterCapacity.toFixed(2)} <span className="text-lg opacity-80">kW</span></p>
                </div>
                {authority === 'EtihadWE' && batteryEnabled && systemRecommendation.batteryCapacity > 0 && (
                    <div className="p-4 bg-brand-primary rounded-lg text-white">
                        <h4 className="text-sm opacity-80">Battery Capacity</h4>
                        <p className="text-3xl font-bold">{systemRecommendation.batteryCapacity.toFixed(1)} <span className="text-lg opacity-80">kWh</span></p>
                    </div>
                )}
            </div>
            {systemRecommendation.sizingNote && (
                <div className={`mt-4 p-2 rounded-lg text-center text-sm flex items-center justify-center gap-2 ${
                    isWarning ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                }`}>
                     {isWarning ? <AlertCircle className="h-5 w-5 flex-shrink-0" /> : <Info className="h-5 w-5 flex-shrink-0" />}
                     <p>{systemRecommendation.sizingNote}</p>
                </div>
             )}
        </Card>
        <UnusedSolarWarningModal 
            isOpen={isUnusedSolarModalOpen} 
            onClose={() => setIsUnusedSolarModalOpen(false)}
            unusedKwh={systemRecommendation.unusedSolarKwh}
            tiers={tiers}
            fullYearConsumptionStats={fullYearConsumptionStats}
            onAddBattery={handleAddAndClose}
        />
     </>
    );
};

const UnusedSolarWarningModal = ({ isOpen, onClose, unusedKwh, tiers, fullYearConsumptionStats, onAddBattery }) => {
    if (!isOpen) return null;

    const totalConsumption = fullYearConsumptionStats.total;
    const marginalRate = getMarginalRate(totalConsumption, tiers);
    const monetaryValue = unusedKwh * marginalRate;
    
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Unused Solar Energy Detected"
            footer={
                <Button onClick={onClose} variant="ghost">Close</Button>
            }
        >
             <div className="text-center">
                 <AlertCircle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
                <p className="text-gray-600 mb-4">
                    Your recommended solar system for EtihadWE is generating a significant amount of energy during the day that your home cannot use, and there is no net-metering to get credit for it.
                </p>
                <div className="grid grid-cols-2 gap-4 my-6">
                    <div className="p-4 bg-yellow-50 border rounded-lg">
                        <p className="text-sm text-gray-500">Wasted Energy</p>
                        <p className="text-2xl font-bold text-yellow-600">{unusedKwh.toLocaleString('en-US', {maximumFractionDigits:0})} kWh/yr</p>
                    </div>
                     <div className="p-4 bg-red-50 border rounded-lg">
                        <p className="text-sm text-gray-500">Lost Savings</p>
                        <p className="text-2xl font-bold text-red-600">~{monetaryValue.toLocaleString('en-US', {maximumFractionDigits:0})} AED/yr</p>
                    </div>
                </div>
                 <p className="text-gray-600 mb-4">
                    Adding a battery would allow you to store this excess energy and use it at night, maximizing your savings.
                </p>
                <Button onClick={onAddBattery} size="md">
                    <Battery className="mr-2 h-5 w-5"/> Add Battery Storage & Recalculate
                </Button>
            </div>
        </Modal>
    )
}

const SeasonalCoverageCard = ({ coverageData }) => {
    const { summerCoverage, winterCoverage, annualAverage } = coverageData;
    const Progress = ({ value, colorClass }) => (
        <div className="w-full bg-gray-200 rounded-full h-4">
            <div className={`h-4 rounded-full ${colorClass}`} style={{ width: `${Math.min(value, 100)}%` }}></div>
        </div>
    );
    return (
        <Card title="Seasonal Coverage Analysis">
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Summer Coverage</span>
                        <span className="text-sm font-bold text-yellow-500">{summerCoverage.toFixed(0)}%</span>
                    </div>
                    <Progress value={summerCoverage} colorClass="bg-yellow-400" />
                </div>
                 <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Winter Coverage</span>
                        <span className="text-sm font-bold text-blue-800">{winterCoverage.toFixed(0)}%</span>
                    </div>
                    <Progress value={winterCoverage} colorClass="bg-blue-800" />
                </div>
                 <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Annual Average</span>
                        <span className="text-sm font-bold text-green-600">{annualAverage.toFixed(0)}%</span>
                    </div>
                    <Progress value={annualAverage} colorClass="bg-green-500" />
                </div>
            </div>
        </Card>
    );
};

const FinancialRoiCard = ({ analysis, systemCost, setSystemCost, roiParams, setRoiParams, authority }) => {
    const [isDewaBreakdownOpen, setIsDewaBreakdownOpen] = useState(false);

    const handleParamChange = (key, value, rule) => {
        let numValue = Number(value);
        if (isNaN(numValue)) return;
        numValue = Math.max(rule.min, Math.min(rule.max, numValue));
        setRoiParams(prev => ({...prev, [key]: numValue / 100}));
    }
    
    const handleSystemCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setSystemCost('');
            return;
        }
        const num = Number(val);
        if (!isNaN(num) && num >= 0 && num <= 1000000000000) {
            setSystemCost(num);
        }
    };
    
    const systemCostNumber = systemCost === '' ? 0 : Number(systemCost);
    const systemCostError = systemCost !== '' && (systemCostNumber <= 0 || systemCostNumber > 1000000000000);
    const systemCostHelperText = systemCost === '' ? "System cost required for financial analysis" : (systemCostError ? "Maximum system cost is 1 Trillion AED." : "");

    return (
        <Card title="Step 3: Financial & ROI Analysis">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div>
                  <Input 
                    label="System Cost (AED)" 
                    type="number" min="0" max="1000000000000"
                    placeholder="Enter total system cost in AED" 
                    value={systemCost} 
                    onChange={handleSystemCostChange} 
                    error={systemCostError}
                    helperText={systemCostHelperText}
                  />
                </div>
                <Input label="Grid Price Escalation (%/yr)" type="number" step={VALIDATION_RULES.escalationRate.step} value={roiParams.escalationRate * 100} onChange={e => handleParamChange('escalationRate', e.target.value, VALIDATION_RULES.escalationRate)} />
                <Input label="Panel Degradation (Y1, %)" type="number" step={VALIDATION_RULES.firstYearDegradation.step} value={roiParams.firstYearDegradation * 100} onChange={e => handleParamChange('firstYearDegradation', e.target.value, VALIDATION_RULES.firstYearDegradation)} />
                <Input label="Panel Degradation (Annual, %)" type="number" step={VALIDATION_RULES.degradationRate.step} value={roiParams.degradationRate * 100} onChange={e => handleParamChange('degradationRate', e.target.value, VALIDATION_RULES.degradationRate)} />
                 <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="escalateFuel" checked={roiParams.escalateFuelSurcharge} onChange={e => setRoiParams({ ...roiParams, escalateFuelSurcharge: e.target.checked })} className="h-4 w-4 text-brand-primary rounded focus:ring-brand-primary" />
                    <label htmlFor="escalateFuel" className="text-sm font-medium text-gray-700">Escalate Fuel Surcharge</label>
                </div>
             </div>
             {analysis && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                     <div className="p-4 bg-green-100 rounded-lg">
                        <h4 className="text-sm text-green-800">First-Year Savings</h4>
                        <p className="text-2xl font-bold text-green-900">AED {analysis.firstYearSavings.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
                     </div>
                     <div className="p-4 bg-green-100 rounded-lg">
                        <h4 className="text-sm text-green-800">Avg Monthly Savings</h4>
                        <p className="text-2xl font-bold text-green-900">AED {analysis.avgMonthlySavings.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
                     </div>
                      <div className="p-4 bg-blue-100 rounded-lg">
                        <h4 className="text-sm text-blue-800">Payback Period</h4>
                        <p className="text-2xl font-bold text-brand-primary">{analysis.paybackPeriod.toFixed(1)} yrs</p>
                     </div>
                     <div className="p-4 bg-yellow-100 rounded-lg">
                        <h4 className="text-sm text-yellow-800">ROI %</h4>
                        <p className="text-2xl font-bold text-yellow-600">{analysis.roiPercentage.toFixed(0)}%</p>
                     </div>
                     <div className="p-4 bg-brand-primary rounded-lg text-white">
                        <h4 className="text-sm opacity-80">Bill Offset</h4>
                        <p className="text-2xl font-bold">{analysis.billOffsetPercentage.toFixed(0)}%</p>
                     </div>
                     <div className="p-4 bg-purple-100 rounded-lg col-span-1 sm:col-span-2 lg:col-span-2">
                        <h4 className="text-sm text-purple-800">25-Year Net Profit</h4>
                        <p className="text-2xl font-bold text-purple-900">AED {analysis.roi25YearNetProfit.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
                     </div>
                      <div className="p-4 bg-purple-100 rounded-lg col-span-1 sm:col-span-2 lg:col-span-1">
                        <h4 className="text-sm text-purple-800">25-Year Net Value</h4>
                        <p className="text-2xl font-bold text-purple-900">AED {analysis.roi25YearNetValue.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
                     </div>
                 </div>
            )}
            {analysis && authority === 'DEWA' && (
                <div className="mt-6 pt-4 border-t">
                    <h4 className="font-semibold text-gray-800 mb-2 text-center">DEWA Net Metering Breakdown (Year 1)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-gray-50">
                            <h5 className="font-semibold mb-2">Solar Energy Utilization</h5>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>Used Directly:</span> <strong>{analysis.dewa_year1_direct_use_kwh.toLocaleString('en-US', {maximumFractionDigits: 0})} kWh</strong></div>
                                <div className="flex justify-between"><span>Stored as Credits:</span> <strong>{analysis.dewa_year1_stored_as_credits_kwh.toLocaleString('en-US', {maximumFractionDigits: 0})} kWh</strong></div>
                                <div className="flex justify-between"><span>Used from Credits:</span> <strong>{analysis.dewa_year1_credits_used_kwh.toLocaleString('en-US', {maximumFractionDigits: 0})} kWh</strong></div>
                                <div className="flex justify-between border-t pt-1 mt-1 font-bold"><span>Total Solar Benefit:</span> <strong>{(analysis.dewa_year1_direct_use_kwh + analysis.dewa_year1_credits_used_kwh).toLocaleString('en-US', {maximumFractionDigits: 0})} kWh</strong></div>
                            </div>
                        </div>
                         <div className="p-4 border rounded-lg bg-gray-50">
                            <h5 className="font-semibold mb-2">Year-End Status</h5>
                             <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>Rollover Credits:</span> <strong>{analysis.dewa_year1_rollover_kwh.toLocaleString('en-US', {maximumFractionDigits: 0})} kWh</strong></div>
                                <div className="flex justify-between"><span>Est. Rollover Value:</span> <strong>AED {analysis.dewa_year1_rollover_value.toLocaleString('en-US', {maximumFractionDigits: 0})}</strong></div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <button onClick={() => setIsDewaBreakdownOpen(!isDewaBreakdownOpen)} className="text-sm font-medium text-brand-primary hover:underline flex items-center">
                            View 25-Year Net Metering Forecast
                            {isDewaBreakdownOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                        </button>
                        {isDewaBreakdownOpen && analysis.dewaYearlyBreakdown && (
                            <div className="mt-2 max-h-80 overflow-y-auto">
                                <Table headers={['Year', 'Direct Use', 'Stored', 'Used Credits', 'Rollover (kWh)', 'Rollover (AED)']}>
                                    {analysis.dewaYearlyBreakdown.map(item => (
                                        <tr key={item.year}>
                                            <td className="px-4 py-2">{item.year}</td>
                                            <td className="px-4 py-2">{item.direct_use_kwh.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                            <td className="px-4 py-2">{item.stored_as_credits_kwh.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                            <td className="px-4 py-2">{item.credits_used_kwh.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                            <td className="px-4 py-2">{item.rollover_kwh.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                            <td className="px-4 py-2">{item.rollover_value.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                        </tr>
                                    ))}
                                </Table>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {!analysis && (
                <div className="text-center py-12">
                    <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700">Enter System Cost</h3>
                    <p className="text-gray-500">Add your system cost to see detailed financial analysis and ROI calculations.</p>
                </div>
            )}
        </Card>
    );
};

const ConsumptionVsProductionCard = ({ monthlyProductionMap, fullYearConsumptionStats, bills }) => {
    const consumptionByMonth = useMemo(() => {
        const consumption = months.reduce((acc, month) => ({ ...acc, [month]: fullYearConsumptionStats.avgMonthly }), {} as { [key: string]: number });
        bills.forEach(b => { if (b.consumption > 0) consumption[b.month] = b.consumption });
        return consumption;
    }, [bills, fullYearConsumptionStats.avgMonthly]);

    const chartData = useMemo(() => months.map(month => ({
        month: month.substring(0, 3),
        Production: Math.round(monthlyProductionMap[month] || 0),
        Consumption: Math.round(consumptionByMonth[month] || 0),
    })), [monthlyProductionMap, consumptionByMonth]);

    return (
        <Card title="Monthly Consumption vs. Production">
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value.toLocaleString('en-US')} kWh`} />
                    <Legend />
                    <Bar dataKey="Consumption" fill="#003366" />
                    <Bar dataKey="Production" fill="#FFD700" />
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
};

const EnvironmentalImpactCard = ({ lifetimeProduction }) => {
    const co2SavedTonnes = (lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000;
    const carsOffRoad = Math.round(co2SavedTonnes / 4.6);
    const treesPlanted = Math.round(co2SavedTonnes * (1000 / 21.8));
    
    return (
        <Card title="Environmental Impact">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-blue-100 rounded-lg">
                    <Leaf className="mx-auto h-8 w-8 text-brand-primary mb-2" />
                    <p className="text-2xl font-bold text-blue-800">{co2SavedTonnes.toLocaleString('en-US', {maximumFractionDigits: 1})}</p>
                    <p className="text-sm text-gray-600">Tonnes CO₂ Saved (25 Yrs)</p>
                </div>
                 <div className="p-4 bg-green-100 rounded-lg">
                    <Trees className="mx-auto h-8 w-8 text-green-700 mb-2" />
                    <p className="text-2xl font-bold text-green-800">{treesPlanted.toLocaleString('en-US')}</p>
                    <p className="text-sm text-gray-600">Trees Planted Equiv.</p>
                </div>
                <div className="p-4 bg-yellow-100 rounded-lg">
                    <Car className="mx-auto h-8 w-8 text-yellow-600 mb-2" />
                    <p className="text-2xl font-bold text-yellow-600">{carsOffRoad.toLocaleString('en-US')}</p>
                    <p className="text-sm text-gray-600">Cars Off Road Equiv.</p>
                </div>
            </div>
             <p className="text-xs text-gray-500 text-center mt-4">Based on an emissions factor of {CO2_EMISSIONS_FACTOR_KG_PER_KWH} kg CO₂ per kWh for the UAE grid.</p>
        </Card>
    );
};

const EstimationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    bills: Bill[];
    setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
    onConfirm: () => void;
}> = ({ isOpen, onClose, bills: estimatedBills, setBills: setEstimatedBills, onConfirm }) => {
    
    const handleEstimatedBillChange = (month: string, value: string) => {
        const newConsumption = parseInt(value, 10);
        if (!isNaN(newConsumption)) {
            setEstimatedBills(currentBills => 
                currentBills.map(bill => 
                    bill.month === month ? { ...bill, consumption: newConsumption } : bill
                )
            );
        } else if (value === '') {
             setEstimatedBills(currentBills => 
                currentBills.map(bill => 
                    bill.month === month ? { ...bill, consumption: 0 } : bill
                )
            );
        }
    };
    
    const midPoint = Math.ceil(estimatedBills.length / 2);
    const firstColumnBills = estimatedBills.slice(0, midPoint);
    const secondColumnBills = estimatedBills.slice(midPoint);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Review and Adjust Estimated Annual Bills"
            footer={<>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={onConfirm}>Confirm & Apply</Button>
            </>}
        >
            <p className="text-sm text-gray-600 mb-4">
                We've estimated your full year's consumption based on the bills you provided. You can adjust any of the estimated values below before applying them. Original bills are shown with a white background.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {[firstColumnBills, secondColumnBills].map((column, colIndex) => (
                    <div key={colIndex} className="space-y-3">
                        {column.map(bill => (
                            <div key={bill.month} className="grid grid-cols-3 items-center gap-2">
                                <label htmlFor={`est-${bill.month}`} className="font-medium text-sm col-span-1">
                                    {bill.month}
                                </label>
                                <Input
                                    id={`est-${bill.month}`}
                                    type="number"
                                    min="0"
                                    value={bill.consumption}
                                    onChange={e => handleEstimatedBillChange(bill.month, e.target.value)}
                                    className={`col-span-2 ${bill.isEstimate ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </Modal>
    );
};


const FullCalculationBreakdown = ({ analysis, systemCost, systemRecommendation, idealOutput, roiParams, systemParams, authority, dewaDaytimeConsumption, city, fullYearConsumptionStats, tiers, environmentalAnalysis, fuelSurcharge, meterCharges, bills }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const Formula: React.FC<{title: string, formula: string, description?: string, values?: string}> = ({ title, formula, description, values }) => (
        <div className="mb-3 border-b border-gray-100 pb-3">
            <h5 className="font-bold text-gray-800">{title}</h5>
            {description && <p className="text-xs text-gray-600 mb-1">{description}</p>}
            <p className="font-mono bg-gray-200 p-2 rounded text-xs text-center">{formula}</p>
            {values && <p className="font-mono bg-gray-100 p-2 rounded text-xs text-center mt-1">{values}</p>}
        </div>
    );
    
    const { targetAnnualProduction, actualSystemSize, panelCount, spaceRequired } = systemRecommendation;
    const bifacialFactor = systemParams.isBifacialEnabled ? BIFACIAL_BOOST_FACTOR : 1;
    const systemCostNumber = Number(systemCost) || 0;
    const getDaytimeRatio = useCallback(() => authority === 'DEWA' ? dewaDaytimeConsumption / 100 : systemParams.daytimeConsumption / 100, [authority, dewaDaytimeConsumption, systemParams.daytimeConsumption]);
    const daytimeRatio = getDaytimeRatio();
    
    const tableHeaders = ['Month', 'Seasonal Factor', 'Days', 'Production (kWh)', 'Avg Consumption (kWh)', 'Excess/Deficit'];
    if (authority === 'EtihadWE') {
        tableHeaders.push('Unused Solar (kWh)');
    }

    const consumptionByMonth = useMemo(() => {
        const consumption = months.reduce((acc, month) => ({ ...acc, [month]: fullYearConsumptionStats.avgMonthly }), {} as { [key: string]: number });
        bills.forEach(b => { if (b.consumption > 0) consumption[b.month] = b.consumption });
        return consumption;
    }, [bills, fullYearConsumptionStats.avgMonthly]);


    return (
        <Card title="Full Calculation Breakdown">
             <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <p className="text-sm text-gray-600">View the detailed 25-year financial forecast and calculation logic.</p>
                <Button variant="ghost">
                    {isOpen ? 'Hide' : 'Show'} Details {isOpen ? <ChevronUp className="h-4 w-4 ml-2"/> : <ChevronDown className="h-4 w-4 ml-2"/>}
                </Button>
            </div>
            {isOpen && analysis && (
                <div className="mt-4 pt-4 border-t text-sm space-y-6">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-brand-primary mb-2">Key Financial Assumptions</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>System Cost:</span><strong>AED {systemCostNumber.toLocaleString('en-US')}</strong></div>
                                <div className="flex justify-between"><span>Peak Sun Hours:</span><strong>{systemParams.peakSunHours}</strong></div>
                                <div className="flex justify-between"><span>Panel Wattage:</span><strong>{systemParams.panelWattage}W</strong></div>
                                <div className="flex justify-between"><span>Inverter Ratio:</span><strong>{systemParams.inverterRatio}</strong></div>
                                <div className="flex justify-between"><span>Bifacial Panels:</span><strong>{systemParams.isBifacialEnabled ? 'Yes (+7%)' : 'No'}</strong></div>
                                <div className="flex justify-between"><span>First Year Degradation:</span><strong>{(roiParams.firstYearDegradation * 100).toFixed(1)}%</strong></div>
                                <div className="flex justify-between"><span>Annual Degradation:</span><strong>{(roiParams.degradationRate * 100).toFixed(2)}%</strong></div>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>Grid Price Escalation:</span><strong>{(roiParams.escalationRate * 100).toFixed(1)}%/year</strong></div>
                                <div className="flex justify-between"><span>Fuel Surcharge:</span><strong>{fuelSurcharge} AED/kWh</strong></div>
                                <div className="flex justify-between"><span>Fuel Escalation:</span><strong>{roiParams.escalateFuelSurcharge ? 'Yes' : 'No'}</strong></div>
                                <div className="flex justify-between"><span>Fixed Meter Charges:</span><strong>AED {meterCharges}/month</strong></div>
                                <div className="flex justify-between"><span>Authority:</span><strong>{authority}</strong></div>
                                <div className="flex justify-between"><span>City:</span><strong>{city}</strong></div>
                                <div className="flex justify-between"><span>Available Space:</span><strong>{systemParams.availableSpace} m²</strong></div>
                                <div className="flex justify-between"><span>Panel Orientation:</span><strong>{systemParams.panelOrientation}</strong></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h6 className="font-semibold">System Sizing Calculations</h6>
                            <div className="space-y-2 text-sm">
                                <Formula title="Ideal System Size (kWp)" 
                                    formula="Target Annual Production ÷ (PSH × 365 × Bifacial Factor × System Efficiency × Environmental Factor)"
                                    values={`${targetAnnualProduction.toLocaleString('en-US', {maximumFractionDigits:0})} ÷ (${systemParams.peakSunHours} × 365 × ${bifacialFactor} × ${SYSTEM_COMPONENT_EFFICIENCY} × ${ENVIRONMENTAL_FACTOR}) = ${systemRecommendation.actualSystemSize.toFixed(2)} kWp`}
                                />
                                <Formula title="Panel Count" 
                                    formula="CEIL(System Size × 1000 ÷ Panel Wattage)"
                                    values={`CEIL(${systemRecommendation.actualSystemSize.toFixed(2)} × 1000 ÷ ${systemParams.panelWattage}) = ${systemRecommendation.panelCount} panels`}
                                />
                                <Formula title="Space Required (m²)" 
                                    formula="Panel Count × Space Per Panel"
                                    values={`${systemRecommendation.panelCount} × ${systemParams.panelOrientation === 'Portrait' ? SPACE_PER_PANEL_PORTRAIT : SPACE_PER_PANEL_LANDSCAPE} = ${systemRecommendation.spaceRequired.toFixed(1)} m²`}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <h6 className="font-semibold">Production Calculations</h6>
                            <div className="space-y-2 text-sm">
                                <Formula title="Total Efficiency Factor" 
                                    formula="System Efficiency × Environmental Factor × Bifacial Factor"
                                    values={`${SYSTEM_COMPONENT_EFFICIENCY} × ${ENVIRONMENTAL_FACTOR} × ${bifacialFactor} = ${(SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR * bifacialFactor).toFixed(4)} (${((SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR * bifacialFactor) * 100).toFixed(2)}%)`}
                                />
                                <Formula title="Monthly Production (kWh) - Example for January" 
                                    formula="Size × PSH × Days × Seasonal Factor × Total Efficiency"
                                    values={`${actualSystemSize.toFixed(2)} × ${systemParams.peakSunHours} × 31 × ${(CITY_SEASONAL_FACTORS[city]['January'] || 0).toFixed(3)} × ${(bifacialFactor * SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR).toFixed(3)} = ${(systemRecommendation.monthlyProductionMap['January'] || 0).toFixed(0)} kWh`}
                                />
                                <Formula title="Inverter Clipping - Example for January" 
                                    formula="MIN(Unclipped Production, Inverter Limit)"
                                    description="Limits production when panels exceed inverter capacity"
                                    values={`Unclipped: ${((actualSystemSize * systemParams.peakSunHours * 31 * (CITY_SEASONAL_FACTORS[city]['January'] || 0) * bifacialFactor * SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR)).toFixed(0)} kWh, Inverter Limit: ${(systemRecommendation.inverterCapacity * systemParams.peakSunHours * 31).toFixed(0)} kWh, Final: ${(systemRecommendation.monthlyProductionMap['January'] || 0).toFixed(0)} kWh`}
                                />
                            </div>
                        </div>
                    </div>
                    
                    
                    <div>
                        <h6 className="font-semibold">System Efficiency Breakdown</h6>
                        <div className="space-y-2 text-sm">
                            <Formula title="Total Efficiency Factor" 
                                formula="System Efficiency × Environmental Factor × Bifacial Factor"
                                values={`${SYSTEM_COMPONENT_EFFICIENCY} × ${ENVIRONMENTAL_FACTOR} × ${bifacialFactor} = ${(SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR * bifacialFactor).toFixed(4)} (${((SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR * bifacialFactor) * 100).toFixed(2)}%)`}
                            />
                            <Formula title="Space Utilization" 
                                formula="Required Space ÷ Available Space × 100"
                                values={`${systemRecommendation.spaceRequired.toFixed(1)} ÷ ${systemParams.availableSpace} × 100 = ${((systemRecommendation.spaceRequired / systemParams.availableSpace) * 100).toFixed(1)}%`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h6 className="font-semibold">Financial Calculations</h6>
                            <div className="space-y-2 text-sm">
                                <Formula title="Tiered Billing - Example for Average Monthly Consumption" 
                                    formula="Σ (kWh in Tier × Rate) + (Total kWh × Fuel Surcharge) + Fixed Meter Charges"
                                    description="Calculates electricity bill using progressive tier structure"
                                    values={`For ${fullYearConsumptionStats.avgMonthly.toFixed(0)} kWh: Tier charges + Fuel (${fullYearConsumptionStats.avgMonthly.toFixed(0)} × ${fuelSurcharge}) + Meter (${meterCharges}) = Total Bill`}
                                />
                                <Formula title="Annual Degradation with Examples" 
                                    formula="(1 - Y1 Degradation) × (1 - Annual Rate)^(Year-1)"
                                    values={`Year 1: (1 - ${roiParams.firstYearDegradation}) × (1 - ${roiParams.degradationRate})^0 = ${((1 - roiParams.firstYearDegradation)).toFixed(4)}, Year 25: (1 - ${roiParams.firstYearDegradation}) × (1 - ${roiParams.degradationRate})^24 = ${((1 - roiParams.firstYearDegradation) * Math.pow(1 - roiParams.degradationRate, 24)).toFixed(4)}`}
                                />
                                <Formula title="Escalated Rates with Examples" 
                                    formula="Base Rate × (1 + Escalation Rate)^(Year-1)"
                                    values={`Year 1: Base Rate × 1.0, Year 10: Base Rate × ${Math.pow(1 + roiParams.escalationRate, 9).toFixed(3)}, Year 25: Base Rate × ${Math.pow(1 + roiParams.escalationRate, 24).toFixed(3)}`}
                                />
                                <Formula title="Fixed Monthly Charges Impact" 
                                    formula="Monthly Meter Charges × 12 months × 25 years"
                                    description="Fixed charges applied regardless of consumption"
                                    values={`AED ${meterCharges}/month × 12 × 25 = AED ${(meterCharges * 12 * 25).toLocaleString('en-US')} over 25 years`}
                                />
                            </div>
                        </div>
                        <div>
                            <h6 className="font-semibold">ROI & Payback</h6>
                            <div className="space-y-2 text-sm">
                                <Formula title="25-Year ROI %" 
                                    formula="(Total 25-Year Savings - System Cost) ÷ System Cost × 100"
                                    values={`(${analysis.roi25YearNetProfit.toLocaleString('en-US',{maximumFractionDigits:0})} - ${systemCost}) ÷ ${systemCost} × 100 = ${analysis.roiPercentage.toFixed(1)}%`}
                                />
                                <Formula title="Payback Period Calculation" 
                                    formula="Year + |Last Negative Balance| ÷ Next Year Cash Flow"
                                    description="Exact year when cumulative savings equal system cost"
                                    values={analysis.paybackPeriod > 0 ? `Payback occurs in year ${Math.floor(analysis.paybackPeriod)} + ${(analysis.paybackPeriod % 1).toFixed(2)} = ${analysis.paybackPeriod.toFixed(2)} years` : 'Calculating payback period...'}
                                />
                                <Formula title="Bill Offset %" 
                                    formula="First Year Savings ÷ Original First Year Bill × 100"
                                    values={`${analysis.firstYearSavings.toLocaleString('en-US',{maximumFractionDigits:0})} ÷ ${analysis.totalOriginalBillYear1.toLocaleString('en-US',{maximumFractionDigits:0})} × 100 = ${analysis.billOffsetPercentage.toFixed(1)}%`}
                                />
                            </div>
                        </div>
                    </div>
                    
                    
                    {authority === 'DEWA' && (
                        <div>
                            <h6 className="font-semibold">DEWA Net Metering Details</h6>
                            <div className="space-y-2 text-sm">
                                <Formula title="Credit Expiry Period" 
                                    formula="12 months rolling basis"
                                    description="Credits expire after 12 months if unused"
                                />
                                <Formula title="Daytime Self Consumption" 
                                    formula="MIN(Monthly Production, Monthly Daytime Load)"
                                    values={`Daytime Load = Monthly Consumption × ${dewaDaytimeConsumption}%`}
                                />
                                <Formula title="Monthly Export to Grid" 
                                    formula="MAX(0, Monthly Production - Monthly Daytime Load)"
                                    description="Excess solar stored as credits"
                                />
                            </div>
                        </div>
                    )}

                    {authority === 'EtihadWE' && (
                        <div>
                            <h6 className="font-semibold">EtihadWE System Details</h6>
                            <div className="space-y-2 text-sm">
                                <Formula title="Daytime Usage Parameter" 
                                    formula={`${systemParams.daytimeConsumption}% of total consumption`}
                                    description="Used for system sizing and savings calculation"
                                />
                                {systemParams.batteryEnabled && (
                                    <>
                                        <Formula title="Battery Mode" 
                                            formula={systemParams.batteryMode === 'night' ? 'Nighttime Backup' : 'Store Unused Solar'}
                                            description={systemParams.batteryMode === 'night' ? 'System sized for 100% consumption' : 'System sized for daytime usage only'}
                                        />
                                        <Formula title="Battery Capacity" 
                                            formula={`${systemRecommendation.batteryCapacity.toFixed(1)} kWh`}
                                            values={`Usable DoD: ${(systemParams.usableDoD * 100).toFixed(0)}%, Efficiency: ${(systemParams.batteryEfficiency * 100).toFixed(0)}%`}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <h6 className="font-semibold">Environmental Impact Calculations</h6>
                        <div className="space-y-2 text-sm">
                            <Formula title="Lifetime Production" 
                                formula="Σ (Annual Production × Degradation Factor) over 25 years"
                                values={`${environmentalAnalysis.lifetimeProduction.toLocaleString('en-US', {maximumFractionDigits:0})} kWh total`}
                            />
                            <Formula title="CO₂ Emissions Saved" 
                                formula="Lifetime Production × CO₂ Factor ÷ 1000"
                                values={`${environmentalAnalysis.lifetimeProduction.toLocaleString('en-US',{maximumFractionDigits:0})} × ${CO2_EMISSIONS_FACTOR_KG_PER_KWH} ÷ 1000 = ${((environmentalAnalysis.lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000).toFixed(1)} tonnes`}
                            />
                            <Formula title="Trees Planted Equivalent" 
                                formula="CO₂ Saved × (1000 ÷ 21.8 kg CO₂ per tree)"
                                values={`${((environmentalAnalysis.lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000).toFixed(1)} × (1000 ÷ 21.8) = ${Math.round(((environmentalAnalysis.lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000) * (1000 / 21.8)).toLocaleString('en-US')} trees`}
                            />
                            <Formula title="Cars Off Road Equivalent" 
                                formula="CO₂ Saved ÷ 4.6 tonnes per car per year"
                                values={`${((environmentalAnalysis.lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000).toFixed(1)} ÷ 4.6 = ${Math.round(((environmentalAnalysis.lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000) / 4.6).toLocaleString('en-US')} cars`}
                            />
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-lg text-brand-primary mb-2">25-Year Financial Forecast</h4>
                        <div className="max-h-96 overflow-y-auto">
                            <Table headers={['Year', 'Degradation', 'Annual Savings (AED)', 'Cash Flow (AED)', 'Cumulative Profit (AED)']}>
                                 <tr>
                                    <td className="px-4 py-2 font-bold">0</td>
                                    <td className="px-4 py-2 font-bold">-</td>
                                    <td className="px-4 py-2 font-bold">-</td>
                                    <td className="px-4 py-2 font-bold text-red-600">({(Number(systemCost) || 0).toLocaleString('en-US')})</td>
                                    <td className="px-4 py-2 font-bold text-red-600">({(Number(systemCost) || 0).toLocaleString('en-US')})</td>
                                 </tr>
                                {analysis.yearlyBreakdown.map(item => (
                                    <tr key={item.year}>
                                        <td className="px-4 py-2">{item.year}</td>
                                        <td className="px-4 py-2">{(item.degradation * 100).toFixed(2)}%</td>
                                        <td className="px-4 py-2">{item.savings.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
                                        <td className="px-4 py-2">{item.cashFlow.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
                                        <td className={`px-4 py-2 font-semibold ${item.cumulativeCashFlow > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.cumulativeCashFlow < 0 ? `(${Math.abs(item.cumulativeCashFlow).toLocaleString('en-US', {maximumFractionDigits: 0})})` : item.cumulativeCashFlow.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
                                    </tr>
                                ))}
                            </Table>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold text-lg text-brand-primary mb-2">Monthly Production Breakdown</h4>
                        <div className="max-h-80 overflow-y-auto">
                            <Table headers={tableHeaders}>
                                {months.map(month => {
                                    const monthlyProd = systemRecommendation.monthlyProductionMap[month] || 0;
                                    const monthlyConsumptionForTable = consumptionByMonth[month] || 0;
                                    const seasonalFactor = CITY_SEASONAL_FACTORS[city][month] || 1;
                                    const excess = monthlyProd - monthlyConsumptionForTable;
                                    const unusedSolar = authority === 'EtihadWE' ? Math.max(0, monthlyProd - (monthlyConsumptionForTable * daytimeRatio)) : 0;
                                    return (
                                        <tr key={month}>
                                            <td className="px-4 py-2">{month}</td>
                                            <td className="px-4 py-2">{seasonalFactor.toFixed(3)}</td>
                                            <td className="px-4 py-2">{DAYS_IN_MONTH[month]}</td>
                                            <td className="px-4 py-2">{monthlyProd.toFixed(0)}</td>
                                            <td className="px-4 py-2">{monthlyConsumptionForTable.toFixed(0)}</td>
                                            <td className={`px-4 py-2 ${excess > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {excess > 0 ? '+' : ''}{excess.toFixed(0)}
                                            </td>
                                            {authority === 'EtihadWE' && (
                                                <td className="px-4 py-2 text-orange-600">{unusedSolar.toFixed(0)}</td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </Table>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};


// --- MAIN CALCULATOR COMPONENT ---
const CalculatorPage = () => {
    // --- STATE MANAGEMENT ---
    // Core Project Info
    const [projectName, setProjectName] = useState('');
    const [city, setCity] = useState('Ajman');
    const [authority, setAuthority] = useState<'DEWA' | 'EtihadWE'>('EtihadWE');
    const [dewaDaytimeConsumption, setDewaDaytimeConsumption] = useState(60);

    // Bill & Tariff States
    const [bills, setBills] = useState<Bill[]>([]);
    const defaultDewaTiers = [{ from: 1, to: 2000, rate: 0.23 }, { from: 2001, to: 4000, rate: 0.28 }, { from: 4001, to: 6000, rate: 0.32 }, { from: 6001, to: Infinity, rate: 0.38 }];
    const defaultEtihadweTiers = [{ from: 1, to: 2000, rate: 0.23 }, { from: 2001, to: 4000, rate: 0.28 }, { from: 4001, to: 6000, rate: 0.32 }, { from: 6001, to: Infinity, rate: 0.38 }];
    const [tiers, setTiers] = useState<Tier[]>(defaultEtihadweTiers);
    const [fuelSurcharge, setFuelSurcharge] = useState(0.05);
    const [meterCharges, setMeterCharges] = useState(10);
    
    // System & ROI Parameters
    const [systemCost, setSystemCost] = useState<number | ''>('');
    const [idealOutput, setIdealOutput] = useState(false);
    const [systemParams, setSystemParams] = useState({
        daytimeConsumption: 60,
        availableSpace: 100,
        peakSunHours: 5.5,
        panelWattage: 610,
        isBifacialEnabled: true,
        inverterRatio: 1.0,
        panelOrientation: 'Portrait',
        batteryEnabled: false,
        usableDoD: 1.0,
        batteryEfficiency: 0.90,
        batteryMode: 'night',
    });
    const [roiParams, setRoiParams] = useState({
        escalationRate: 0.015,
        firstYearDegradation: 0.02,
        degradationRate: 0.005,
        escalateFuelSurcharge: false,
    });
    
    // UI & Other States
    const [notifications, setNotifications] = useState<ToastNotification[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
    const [estimatedBillsForModal, setEstimatedBillsForModal] = useState<Bill[]>([]);
    const [isProgressIndicatorVisible, setIsProgressIndicatorVisible] = useState(true);

    const addNotification = useCallback((toast: Omit<ToastNotification, 'id'>) => {
        const newToast = { ...toast, id: Date.now() };
        setNotifications(prev => [...prev, newToast]);
    }, []);

    const dismissNotification = useCallback((id: number) => {
        setNotifications(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- DERIVED STATE & MEMOIZED CALCULATIONS ---
    const getDaytimeRatio = useCallback(() => authority === 'DEWA' ? dewaDaytimeConsumption / 100 : systemParams.daytimeConsumption / 100, [authority, dewaDaytimeConsumption, systemParams.daytimeConsumption]);

    const fullYearConsumptionStats = useMemo(() => {
        const UaeSummerMonths = ['May', 'June', 'July', 'August', 'September'];
        const UaeWinterMonths = ['October', 'November', 'December', 'January', 'February', 'March', 'April'];
        
        const summerBills = bills.filter(b => UaeSummerMonths.includes(b.month));
        const winterBills = bills.filter(b => UaeWinterMonths.includes(b.month));

        const avgSummer = summerBills.length > 0 ? summerBills.reduce((acc, b) => acc + b.consumption, 0) / summerBills.length : 0;
        const avgWinter = winterBills.length > 0 ? winterBills.reduce((acc, b) => acc + b.consumption, 0) / winterBills.length : 0;
        
        let total = 0;
        if (bills.length === 12) {
            total = bills.reduce((acc, b) => acc + b.consumption, 0);
        } else if (bills.length > 0) {
            if (avgSummer > 0 && avgWinter > 0) {
                total = (avgSummer * UaeSummerMonths.length) + (avgWinter * UaeWinterMonths.length);
            } else if (avgSummer > 0) {
                total = avgSummer * 12; // Estimate from summer
            } else {
                total = avgWinter * 12; // Estimate from winter
            }
        }
        
        const avgMonthly = total / 12;
        const dailyAvg = total / 365;

        return {
            total,
            avgMonthly,
            dailyAvg,
            summerAvg: avgSummer || avgMonthly,
            winterAvg: avgWinter || avgMonthly,
            summerSpike: avgWinter > 0 ? ((avgSummer - avgWinter) / avgWinter) * 100 : 0,
            baseLoad: avgWinter || avgMonthly,
            coolingLoad: avgWinter > 0 ? avgSummer - avgWinter : 0,
        };
    }, [bills]);

    const systemRecommendation = useMemo(() => {
        let sizingNote = '';
        let targetConsumption = fullYearConsumptionStats.total;
        const daytimeRatio = getDaytimeRatio();

        if (authority === 'DEWA') {
            targetConsumption = fullYearConsumptionStats.total * 1.0;
            sizingNote = 'System sized for 100% of annual consumption to maximize net metering credits.';
        } else { // EtihadWE
            if (systemParams.batteryEnabled) {
                if (systemParams.batteryMode === 'night') {
                    targetConsumption = fullYearConsumptionStats.total;
                    sizingNote = 'System sized for 100% of annual consumption to provide nighttime backup.';
                } else { // 'unused' mode
                    const daytimeTarget = fullYearConsumptionStats.total * daytimeRatio;
                    targetConsumption = daytimeTarget;
                    sizingNote = `System sized for ${systemParams.daytimeConsumption}% daytime consumption + battery to store unused solar.`;
                }
            } else {
                targetConsumption = fullYearConsumptionStats.total * daytimeRatio;
                sizingNote = `System sized to match your ${systemParams.daytimeConsumption}% daytime consumption. Consider adding a battery to store unused solar.`;
            }
        }

        const bifacialFactor = systemParams.isBifacialEnabled ? BIFACIAL_BOOST_FACTOR : 1;
        const efficiency = SYSTEM_COMPONENT_EFFICIENCY * ENVIRONMENTAL_FACTOR;
        const totalEfficiencyFactorForSizing = idealOutput ? bifacialFactor : efficiency * bifacialFactor;
        
        const annualProductionHours = systemParams.peakSunHours * 365;
        const targetAnnualProduction = targetConsumption;
        const idealSystemSize = targetAnnualProduction / (annualProductionHours * totalEfficiencyFactorForSizing);
        
        const finalSystemSize = idealSystemSize;
        
        const panelCount = Math.ceil((finalSystemSize * 1000) / systemParams.panelWattage);
        const actualSystemSize = (panelCount * systemParams.panelWattage) / 1000;
        
        const spacePerPanel = systemParams.panelOrientation === 'Portrait' ? SPACE_PER_PANEL_PORTRAIT : SPACE_PER_PANEL_LANDSCAPE;
        const spaceRequired = panelCount * spacePerPanel;

        if (spaceRequired > systemParams.availableSpace && systemParams.availableSpace > 0) {
            sizingNote += ` | Warning: Required space (~${spaceRequired.toFixed(0)}m²) exceeds available space (${systemParams.availableSpace}m²).`;
        }

        const inverterCapacity = actualSystemSize * systemParams.inverterRatio;
        
        const monthlyProductionMap: { [key: string]: number } = {};
        let totalUnusedSolar = 0;

        const totalEfficiencyFactorForProd = idealOutput ? bifacialFactor : efficiency * bifacialFactor;

        const seasonalFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
        const totalFactor = Object.values(seasonalFactors).reduce((s, f) => s + f, 0);

        const consumptionByMonthForUnused = months.reduce((acc, month) => ({ ...acc, [month]: fullYearConsumptionStats.avgMonthly }), {} as { [key:string]: number });
        bills.forEach(b => { if (b.consumption > 0) consumptionByMonthForUnused[b.month] = b.consumption });

        months.forEach(month => {
            const seasonalFactorNormalized = seasonalFactors[month] / (totalFactor / 12);
            const daysInMonth = DAYS_IN_MONTH[month];
            const unclippedDcKwh = actualSystemSize * systemParams.peakSunHours * daysInMonth * seasonalFactorNormalized;
            const unclippedAcKwh = unclippedDcKwh * totalEfficiencyFactorForProd;
            const maxInverterAcKwh = inverterCapacity * systemParams.peakSunHours * daysInMonth;
            const monthlyProd = Math.min(unclippedAcKwh, maxInverterAcKwh);
            monthlyProductionMap[month] = monthlyProd;

            if (authority === 'EtihadWE' && !systemParams.batteryEnabled) {
                const monthlyConsumption = consumptionByMonthForUnused[month];
                const monthlyDaytimeConsumption = monthlyConsumption * daytimeRatio;
                const monthlyUnused = Math.max(0, monthlyProd - monthlyDaytimeConsumption);
                totalUnusedSolar += monthlyUnused;
            }
        });

        const annualProduction = Object.values(monthlyProductionMap).reduce((sum, prod) => sum + prod, 0);
        
        let batteryCapacity = 0;
        if (authority === 'EtihadWE' && systemParams.batteryEnabled) {
            const avgDailyConsumption = fullYearConsumptionStats.total / 365;
            if (systemParams.batteryMode === 'night') {
                const avgNighttimeLoad = avgDailyConsumption * (1 - daytimeRatio);
                batteryCapacity = avgNighttimeLoad > 0 ? avgNighttimeLoad / (systemParams.usableDoD * systemParams.batteryEfficiency) : 0;
            } else { // 'unused' mode
                let maxMonthlyExcess = 0;
                months.forEach(month => {
                    const monthlyProd = monthlyProductionMap[month] || 0;
                    const monthlyConsumption = consumptionByMonthForUnused[month];
                    const monthlyDaytimeConsumption = monthlyConsumption * daytimeRatio;
                    const monthlyExcess = Math.max(0, monthlyProd - monthlyDaytimeConsumption);
                    maxMonthlyExcess = Math.max(maxMonthlyExcess, monthlyExcess);
                });
                const maxDailyExcess = maxMonthlyExcess / 30; // Use average days for sizing
                batteryCapacity = maxDailyExcess > 0 ? maxDailyExcess / (systemParams.usableDoD * systemParams.batteryEfficiency) : 0;
            }
        }
        
        return {
            targetAnnualProduction,
            actualSystemSize,
            panelCount,
            spaceRequired,
            annualProduction,
            inverterCapacity,
            sizingNote,
            monthlyProductionMap,
            batteryCapacity,
            unusedSolarKwh: totalUnusedSolar,
        };
    }, [systemParams, fullYearConsumptionStats, bills, authority, city, idealOutput, getDaytimeRatio]);

    const coverageData = useMemo(() => {
        const UaeSummerMonths = ['May', 'June', 'July', 'August', 'September'];
        const UaeWinterMonths = ['October', 'November', 'December', 'January', 'February', 'March', 'April'];
        
        const consumption = months.reduce((acc, month) => ({ ...acc, [month]: fullYearConsumptionStats.avgMonthly }), {} as { [key: string]: number });
        bills.forEach(b => { if (b.consumption > 0) consumption[b.month] = b.consumption });
        
        let summerCoverageTotal = 0, winterCoverageTotal = 0;
        let summerMonthsWithData = 0, winterMonthsWithData = 0;
        
        const daytimeRatio = getDaytimeRatio();

        months.forEach(month => {
            const production = systemRecommendation.monthlyProductionMap[month] || 0;
            const monthlyConsumption = consumption[month] || 0;
            if (monthlyConsumption <= 0) return;
            
            let coveredKwh = 0;
            if (authority === 'DEWA') {
                // For DEWA, all production contributes to offsetting the bill via net metering.
                // So, the covered kWh is simply the lesser of production or consumption for that month.
                coveredKwh = Math.min(production, monthlyConsumption);
            } else { // EtihadWE
                if (systemParams.batteryEnabled) {
                    const daytimeLoad = monthlyConsumption * daytimeRatio;
                    const nighttimeLoad = monthlyConsumption * (1 - daytimeRatio);
                    const solarDirectlyUsed = Math.min(production, daytimeLoad);
                    const excessSolar = Math.max(0, production - solarDirectlyUsed);
                    const stored = Math.min(excessSolar, systemRecommendation.batteryCapacity * 30 * systemParams.usableDoD);
                    const discharged = Math.min(nighttimeLoad, stored * systemParams.batteryEfficiency);
                    coveredKwh = solarDirectlyUsed + discharged;
                } else {
                     coveredKwh = Math.min(production, monthlyConsumption * daytimeRatio);
                }
            }
            const coverage = (coveredKwh / monthlyConsumption) * 100;
            
            if (UaeSummerMonths.includes(month)) {
                summerCoverageTotal += coverage;
                summerMonthsWithData++;
            }
            if (UaeWinterMonths.includes(month)) {
                winterCoverageTotal += coverage;
                winterMonthsWithData++;
            }
        });
        
        const summerCoverage = summerMonthsWithData > 0 ? summerCoverageTotal / summerMonthsWithData : 0;
        const winterCoverage = winterMonthsWithData > 0 ? winterCoverageTotal / winterMonthsWithData : 0;
        const annualAverage = (summerCoverage * UaeSummerMonths.length + winterCoverage * UaeWinterMonths.length) / 12;

        return { summerCoverage, winterCoverage, annualAverage };
    }, [systemRecommendation.monthlyProductionMap, systemRecommendation.batteryCapacity, bills, fullYearConsumptionStats.avgMonthly, authority, getDaytimeRatio, systemParams]);
    
    const financialAnalysis = useMemo(() => {
        setIsCalculating(true);
        if (systemCost === '' || Number(systemCost) <= 0 || bills.length === 0) {
            setIsCalculating(false);
            return null;
        }
        const analysis = calculateFinancialAnalysis({
            systemCost: Number(systemCost),
            bills, authority, dewaDaytimeConsumption,
            monthlyProductionMap: systemRecommendation.monthlyProductionMap,
            systemRecommendation,
            meterCharges, roiParams, systemParams, tiers, fuelSurcharge,
            fullYearConsumptionStats
        });
        setIsCalculating(false);
        return analysis;
    }, [systemCost, bills, authority, dewaDaytimeConsumption, systemRecommendation, meterCharges, roiParams, systemParams, tiers, fuelSurcharge, fullYearConsumptionStats]);

    const environmentalAnalysis = useMemo(() => {
        if (!financialAnalysis) return { lifetimeProduction: 0 };
        const lifetimeProduction = financialAnalysis.yearlyBreakdown.reduce((acc, item) => acc + (systemRecommendation.annualProduction * item.degradation), 0);
        return { lifetimeProduction };
    }, [financialAnalysis, systemRecommendation.annualProduction]);
    
    // --- EVENT HANDLERS ---
    const handleAddBatteryFromWarning = () => {
        setSystemParams(prev => ({ 
            ...prev, 
            batteryEnabled: true,
            batteryMode: 'unused' 
        }));
    };

    const handleEstimateFullYear = () => {
        if (bills.length === 0) {
            addNotification({ message: 'Please enter at least one bill to estimate.', type: 'error' });
            return;
        }
        const tempBills: Bill[] = months.map(month => {
            const existingBill = bills.find(b => b.month === month);
            if (existingBill) return { ...existingBill, isEstimate: false };
            return { month, consumption: 0, isEstimate: true };
        });
        
        const UaeSummerMonths = ['May', 'June', 'July', 'August', 'September'];
        const summerBills = bills.filter(b => UaeSummerMonths.includes(b.month));
        const winterBills = bills.filter(b => !UaeSummerMonths.includes(b.month));
        
        const avgSummer = summerBills.length > 0 ? summerBills.reduce((acc, b) => acc + b.consumption, 0) / summerBills.length : 0;
        const avgWinter = winterBills.length > 0 ? winterBills.reduce((acc, b) => acc + b.consumption, 0) / winterBills.length : 0;
        
        const seasonalFactors = CITY_SEASONAL_FACTORS[city];
        
        if (avgSummer > 0 && avgWinter > 0) {
            // Both seasons available, best case
            const baseConsumption = (avgSummer + avgWinter) / 2;
            tempBills.forEach(b => {
                if (b.isEstimate) b.consumption = Math.round(baseConsumption * seasonalFactors[b.month]);
            });
        } else if (avgSummer > 0) {
            const avgSummerFactor = UaeSummerMonths.reduce((sum, m) => sum + seasonalFactors[m], 0) / UaeSummerMonths.length;
            const baseConsumption = avgSummer / avgSummerFactor;
            tempBills.forEach(b => {
                if (b.isEstimate) b.consumption = Math.round(baseConsumption * seasonalFactors[b.month]);
            });
        } else if (avgWinter > 0) {
            const avgWinterFactor = months.filter(m => !UaeSummerMonths.includes(m)).reduce((sum, m) => sum + seasonalFactors[m], 0) / (12 - UaeSummerMonths.length);
            const baseConsumption = avgWinter / avgWinterFactor;
            tempBills.forEach(b => {
                if (b.isEstimate) b.consumption = Math.round(baseConsumption * seasonalFactors[b.month]);
            });
        } else {
             // Fallback if something goes wrong
            tempBills.forEach(b => { if(b.isEstimate) b.consumption = 1000; });
        }
        
        setEstimatedBillsForModal(tempBills);
        setIsEstimateModalOpen(true);
    };

    const handleConfirmEstimation = () => {
        setBills(estimatedBillsForModal);
        setIsEstimateModalOpen(false);
    };
    
    const handleSaveProject = () => {
        const jsonReplacer = (key: any, value: any) => (value === Infinity ? "Infinity" : value);
        const projectData = {
            // config
            projectName, city, authority, dewaDaytimeConsumption,
            bills, tiers, fuelSurcharge, meterCharges, systemCost, idealOutput,
            systemParams, roiParams,
            // results (if available)
            results: financialAnalysis ? {
                financialAnalysis,
                systemRecommendation,
                coverageData,
                environmentalAnalysis,
                fullYearConsumptionStats
            } : null
        };
        const blob = new Blob([JSON.stringify(projectData, jsonReplacer, 2)], { type: 'application/json' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${projectName.replace(/ /g, '_')}_solar_analysis.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addNotification({ message: 'Project configuration and results saved!', type: 'success' });
    };

    const handleLoadProject = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const result = event.target?.result;
                        if (typeof result !== 'string') {
                            addNotification({ message: 'Error: Could not read file content.', type: 'error' });
                            return;
                        }

                        const jsonReviver = (key: any, value: any) => (value === "Infinity" ? Infinity : value);
                        const data = JSON.parse(result, jsonReviver);
                        
                        setProjectName(data.projectName || 'My Solar Project');
                        setCity(data.city || 'Dubai');
                        setAuthority(data.authority || 'DEWA');
                        setDewaDaytimeConsumption(data.dewaDaytimeConsumption || 60);
                        setBills(data.bills || []);
                        setTiers(data.tiers || (data.authority === 'DEWA' ? defaultDewaTiers : defaultEtihadweTiers));
                        setFuelSurcharge(data.fuelSurcharge || (data.authority === 'DEWA' ? 0.06 : 0.05));
                        setMeterCharges(data.meterCharges ?? 10);
                        setSystemCost(data.systemCost || '');
                        setIdealOutput(data.idealOutput || false);
                        
                        // Merge params to keep defaults for newly added keys
                        setSystemParams(prev => ({ ...prev, ...(data.systemParams || {})}));
                        setRoiParams(prev => ({ ...prev, ...(data.roiParams || {})}));

                        addNotification({ message: 'Project loaded successfully!', type: 'success' });
                    } catch (err) {
                        addNotification({ message: 'Error parsing project file.', type: 'error' });
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const copyReport = () => {
        if (!financialAnalysis) {
            addNotification({ message: 'Please complete the analysis by providing a system cost to generate a report.', type: 'error' });
            return;
        }

        const reportParts = [];
        const today = new Date();
        const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        
        reportParts.push(`Date: ${formattedDate}`);
        reportParts.push('');

        reportParts.push('CONSUMPTION ANALYSIS');
        reportParts.push('--------------------');
        reportParts.push(`Annual Consumption: ${fullYearConsumptionStats.total.toLocaleString('en-US', {maximumFractionDigits:0})} kWh`);
        const avgMonthlyBill = financialAnalysis.totalOriginalBillYear1 / 12;
        reportParts.push(`Avg Monthly Bill: AED ${avgMonthlyBill.toLocaleString('en-US', {maximumFractionDigits:0})}`);
        reportParts.push(`Summer Avg: ${fullYearConsumptionStats.summerAvg.toLocaleString('en-US', {maximumFractionDigits:0})} kWh/month`);
        reportParts.push(`Winter Avg: ${fullYearConsumptionStats.winterAvg.toLocaleString('en-US', {maximumFractionDigits:0})} kWh/month`);
        reportParts.push(`Daily Avg: ${fullYearConsumptionStats.dailyAvg.toFixed(0)} kWh`);
        reportParts.push(`Summer Spike: ${fullYearConsumptionStats.summerSpike.toFixed(0)}%`);
        reportParts.push('');

        reportParts.push('RECOMMENDED SYSTEM');
        reportParts.push('------------------');
        reportParts.push(`System Size: ${systemRecommendation.actualSystemSize.toFixed(1)} kWp`);
        const bifacialText = systemParams.isBifacialEnabled ? ' (Bifacial)' : '';
        reportParts.push(`Number of Panels: ${systemRecommendation.panelCount} × ${systemParams.panelWattage}W${bifacialText}`);
        reportParts.push(`Annual Production: ${systemRecommendation.annualProduction.toLocaleString('en-US', {maximumFractionDigits:0})} kWh`);
        reportParts.push(`System Coverage: ${coverageData.annualAverage.toFixed(1)}%`);
        reportParts.push(`Space Required: ~${systemRecommendation.spaceRequired.toFixed(0)} m²`);
        reportParts.push(`Inverter Capacity: ${systemRecommendation.inverterCapacity.toFixed(2)} kW`);
        if (authority === 'EtihadWE' && systemParams.batteryEnabled && systemRecommendation.batteryCapacity > 0) {
            reportParts.push(`Battery Capacity: ${systemRecommendation.batteryCapacity.toFixed(1)} kWh`);
        }
        reportParts.push('');

        reportParts.push('FINANCIAL ANALYSIS');
        reportParts.push('------------------');
        reportParts.push(`System Cost: AED ${Number(systemCost).toLocaleString('en-US')}`);
        reportParts.push(`First-Year Savings: AED ${financialAnalysis.firstYearSavings.toLocaleString('en-US', {maximumFractionDigits:0})}`);
        reportParts.push(`Avg Monthly Savings: AED ${financialAnalysis.avgMonthlySavings.toLocaleString('en-US', {maximumFractionDigits:0})}`);
        reportParts.push(`Payback Period: ${financialAnalysis.paybackPeriod.toFixed(1)} years`);
        reportParts.push(`25-Year Net Profit: AED ${financialAnalysis.roi25YearNetProfit.toLocaleString('en-US', {maximumFractionDigits:0})}`);
        reportParts.push(`25 Year Net Value: AED ${financialAnalysis.roi25YearNetValue.toLocaleString('en-US', {maximumFractionDigits:0})}`);
        reportParts.push(`ROI: ${financialAnalysis.roiPercentage.toFixed(0)}%`);
        reportParts.push(`Bill Offset: ${financialAnalysis.billOffsetPercentage.toFixed(0)}%`);
        reportParts.push('');

        const co2SavedTonnes = (environmentalAnalysis.lifetimeProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH) / 1000;
        const treesPlanted = Math.round(co2SavedTonnes * (1000 / 21.8));
        const carsOffRoad = (co2SavedTonnes / 4.6).toFixed(1);
        reportParts.push('ENVIRONMENTAL IMPACT');
        reportParts.push('--------------------');
        reportParts.push(`25-Year CO₂ Savings: ${co2SavedTonnes.toFixed(1)} Tonnes`);
        reportParts.push(`(Equivalent to planting approx. ${treesPlanted.toLocaleString('en-US')} trees &`);
        reportParts.push(`${carsOffRoad} Cars Off Road Equiv.)`);
        
        navigator.clipboard.writeText(reportParts.join('\n'));
        addNotification({ message: 'Report copied to clipboard!', type: 'success' });
    };

    // --- EFFECTS ---
    useEffect(() => {
        setFuelSurcharge(authority === 'DEWA' ? 0.06 : 0.05);
        setTiers(authority === 'DEWA' ? defaultDewaTiers : defaultEtihadweTiers);
        setSystemParams(prev => ({
            ...prev,
            batteryEnabled: authority === 'EtihadWE' ? prev.batteryEnabled : false,
            inverterRatio: authority === 'DEWA' ? 1.0 : 1.05,
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authority]);

    // Apply AI-generated config from session storage
    useEffect(() => {
        const aiConfig = sessionStorage.getItem('aiProjectConfig');
        if (aiConfig) {
            try {
                const jsonReviver = (key, value) => (value === "Infinity" ? Infinity : value);
                const data = JSON.parse(aiConfig, jsonReviver);

                setProjectName(data.projectName || 'AI Generated Project');
                setCity(data.city || 'Dubai');
                setAuthority(data.authority || 'DEWA');
                setBills(data.bills || []);
                if (data.roiParams?.systemCost) {
                    setSystemCost(data.roiParams.systemCost);
                }
                if(data.batteryEnabled) {
                     setSystemParams(prev => ({...prev, batteryEnabled: true}));
                }
                if (data.tiers) setTiers(data.tiers);
                if (data.fuelSurcharge) setFuelSurcharge(data.fuelSurcharge);
                if (data.meterCharges) setMeterCharges(data.meterCharges);
                
                addNotification({ message: 'AI Assistant configuration applied!', type: 'success'});
            } catch (error) {
                 addNotification({ message: 'Failed to apply AI configuration.', type: 'error'});
            }
            sessionStorage.removeItem('aiProjectConfig');
        }
    }, [addNotification]);
    
    // Derived UI states
    const showEstimateWarning = bills.length > 0 && bills.length < 12 && !bills.some(b => ['May', 'June', 'July', 'August', 'September'].includes(b.month));
    const showAnalysisCards = bills.length > 0;
    const showFullFinancialAnalysis = showAnalysisCards && systemCost !== '' && Number(systemCost) > 0;
    const currentStep = useMemo(() => {
        if (bills.length === 0) return 0;
        if (!systemCost || Number(systemCost) <= 0) return 1;
        return 2;
    }, [bills.length, systemCost]);
    
    // --- RENDER ---
    return (
        <div className="space-y-6">
            <ToastContainer notifications={notifications} onDismiss={dismissNotification} />
            
            {isProgressIndicatorVisible && (
                 <div className="flex items-center justify-center mb-6">
                    <div className="flex items-center space-x-2 md:space-x-4">
                        {['Bills', 'System', 'Results'].map((name, index) => (
                            <React.Fragment key={name}>
                                <div className="flex items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                        index <= currentStep ? 'bg-brand-primary text-white' : 'bg-gray-300 text-gray-600'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <span className="ml-2 text-sm font-medium hidden md:block">{name}</span>
                                </div>
                                {index < 2 && <ChevronRight className="h-5 w-5 text-gray-400" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            <ProjectConfigurationCard 
                projectName={projectName} setProjectName={setProjectName} 
                authority={authority} setAuthority={setAuthority}
                city={city} setCity={setCity}
                handleSaveProject={handleSaveProject} handleLoadProject={handleLoadProject}
                copyReport={copyReport}
            />

            <BillAnalysisCard 
                bills={bills} setBills={setBills}
                tiers={tiers} setTiers={setTiers}
                fuelSurcharge={fuelSurcharge} setFuelSurcharge={setFuelSurcharge}
                meterCharges={meterCharges} setMeterCharges={setMeterCharges}
                fullYearConsumptionStats={fullYearConsumptionStats}
                onEstimateFullYear={handleEstimateFullYear}
                showEstimateWarning={showEstimateWarning}
                addNotification={addNotification}
                authority={authority}
            />

            {showAnalysisCards && (
            <>
                <SystemParametersCard 
                    systemParams={systemParams} setSystemParams={setSystemParams} 
                    idealOutput={idealOutput} setIdealOutput={setIdealOutput} 
                    authority={authority}
                    dewaDaytimeConsumption={dewaDaytimeConsumption}
                    setDewaDaytimeConsumption={setDewaDaytimeConsumption}
                />
                <RecommendedSystemCard 
                    systemRecommendation={systemRecommendation} 
                    authority={authority} 
                    batteryEnabled={systemParams.batteryEnabled}
                    onAddBattery={handleAddBatteryFromWarning}
                    tiers={tiers}
                    fullYearConsumptionStats={fullYearConsumptionStats}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ConsumptionVsProductionCard monthlyProductionMap={systemRecommendation.monthlyProductionMap} fullYearConsumptionStats={fullYearConsumptionStats} bills={bills} />
                    <SeasonalCoverageCard coverageData={coverageData} />
                </div>
                 <FinancialRoiCard 
                    analysis={financialAnalysis} 
                    systemCost={systemCost} setSystemCost={setSystemCost}
                    roiParams={roiParams} setRoiParams={setRoiParams}
                    authority={authority}
                />
                {showFullFinancialAnalysis && <EnvironmentalImpactCard lifetimeProduction={environmentalAnalysis.lifetimeProduction} />}
                {showFullFinancialAnalysis && (
                    <FullCalculationBreakdown 
                        analysis={financialAnalysis}
                        systemCost={systemCost}
                        systemRecommendation={systemRecommendation}
                        idealOutput={idealOutput}
                        roiParams={roiParams}
                        systemParams={systemParams}
                        authority={authority}
                        dewaDaytimeConsumption={dewaDaytimeConsumption}
                        city={city}
                        fullYearConsumptionStats={fullYearConsumptionStats}
                        tiers={tiers}
                        bills={bills}
                        environmentalAnalysis={environmentalAnalysis}
                        fuelSurcharge={fuelSurcharge}
                        meterCharges={meterCharges}
                    />
                )}
            </>
            )}
            
            <EstimationModal 
                isOpen={isEstimateModalOpen}
                onClose={() => setIsEstimateModalOpen(false)}
                bills={estimatedBillsForModal}
                setBills={setEstimatedBillsForModal}
                onConfirm={handleConfirmEstimation}
            />
        </div>
    );
};

export default CalculatorPage;