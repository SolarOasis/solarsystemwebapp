import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { Sun, Battery, TrendingUp, AlertCircle, Trash2, PlusCircle, XCircle, Wand2, Info, Upload, Copy, Save, Leaf, ChevronDown, ChevronUp, Car, Trees } from 'lucide-react';
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

interface FinancialAnalysis {
  annualSavings: number;
  monthlySavings: number;
  paybackPeriod: number;
  roi25YearNetProfit: number;
  roi25YearNetValue: number;
  roiPercentage: number;
  netMeteringCreditsValue: number;
  billOffsetPercentage: number;
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
const REAL_WORLD_LOSS_FACTOR = 0.93; // Represents a 7% loss
const CO2_EMISSIONS_FACTOR_KG_PER_KWH = 0.7;
const BIFACIAL_BOOST_FACTOR = 1.07; // 7% boost for bifacial panels

const months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];

const calculateBillAmountForConsumption = (
  consumption: number, 
  tiers: Tier[], 
  fuelSurcharge: number, 
  options: { 
    escalate?: boolean;
    escalateFuelSurcharge?: boolean;
    escalationRate?: number;
    year?: number;
  } = {}
): number => {
    if (consumption <= 0) return 0;
    
    const { 
        escalate = false,
        escalateFuelSurcharge = false,
        escalationRate = 0,
        year = 1
    } = options;
    
    const escalationFactor = escalate ? Math.pow(1 + escalationRate, year - 1) : 1;
    let totalTierAmount = 0;
    let remainingConsumption = consumption;
    
    const finalTiers = escalate 
        ? tiers.map(t => ({...t, rate: t.rate * escalationFactor}))
        : tiers;
    
    // Assuming tiers are sorted by `from`
    for (const tier of finalTiers) {
        if (remainingConsumption <= 0) break;
        
        const tierStart = tier.from === 0 ? 0 : tier.from - 1;
        const tierLimit = tier.to === Infinity ? Infinity : tier.to;
        
        const consumptionInThisTier = Math.min(
            remainingConsumption,
            tierLimit - tierStart
        );

        totalTierAmount += consumptionInThisTier * tier.rate;
        remainingConsumption -= consumptionInThisTier;
    }
    
    const finalFuelSurcharge = escalateFuelSurcharge ? fuelSurcharge * escalationFactor : fuelSurcharge;
    return totalTierAmount + (consumption * finalFuelSurcharge);
};


const CalculatorPage: React.FC = () => {
  // Project Configuration
  const [authority, setAuthority] = useState<'DEWA' | 'EtihadWE'>('EtihadWE');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(true);
  const [projectName, setProjectName] = useState<string>('Villa Project');
  const [city, setCity] = useState('Dubai');

  // Bill Inputs
  const [bills, setBills] = useState<Bill[]>([]);
  const [billInput, setBillInput] = useState<string>('');
  const [tiers, setTiers] = useState<Tier[]>([
    { from: 1, to: 2000, rate: 0.23 },
    { from: 2001, to: 4000, rate: 0.28 },
    { from: 4001, to: 6000, rate: 0.32 },
    { from: 6001, to: Infinity, rate: 0.38 }
  ]);
  const [pendingEstimates, setPendingEstimates] = useState<Bill[]>([]);
  const [fuelSurcharge, setFuelSurcharge] = useState<number>(0.05);

  // System Parameters
  const [daytimeConsumption, setDaytimeConsumption] = useState<number>(55);
  const [availableSpace, setAvailableSpace] = useState<number>(100);
  const [peakSunHours, setPeakSunHours] = useState<number>(5.5);
  const [systemEfficiency, setSystemEfficiency] = useState<number>(95);
  const [panelWattage, setPanelWattage] = useState<number>(610);
  const [batteryEfficiency, setBatteryEfficiency] = useState(0.90);
  const [usableDoD, setUsableDoD] = useState(1.0);
  const [showIdealOutput, setShowIdealOutput] = useState(false);
  const [isBifacialEnabled, setIsBifacialEnabled] = useState(true);
  const [inverterRatio, setInverterRatio] = useState(1.05);
  const [batteryMode, setBatteryMode] = useState<'night' | 'unused'>('night');

  // ROI Inputs
  const [systemCost, setSystemCost] = useState<string>('');
  const [firstYearDegradation, setFirstYearDegradation] = useState(0.02);
  const [degradationRate, setDegradationRate] = useState(0.005);
  const [escalationRate, setEscalationRate] = useState(0.015);
  const [escalateFuelSurcharge, setEscalateFuelSurcharge] = useState<boolean>(false);
  const [creditExpiryMonths, setCreditExpiryMonths] = useState(12);
  
  // Calculated Values
  const [financialAnalysis, setFinancialAnalysis] = useState<FinancialAnalysis>({ annualSavings: 0, monthlySavings: 0, paybackPeriod: 0, roi25YearNetProfit: 0, roi25YearNetValue: 0, roiPercentage: 0, netMeteringCreditsValue: 0, billOffsetPercentage: 0 });

  // UI State
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showLossesExplanation, setShowLossesExplanation] = useState(false);

  const loadProjectData = useCallback((data: any) => {
    const auth = data.authority || 'EtihadWE';
    setProjectName(data.projectName || '');
    setCity(data.city || 'Dubai');
    setAuthority(auth);
    setBatteryEnabled(data.batteryEnabled ?? true);
    setBills(data.bills || []);
    setTiers(data.tiers || [
        { from: 1, to: 2000, rate: 0.23 },
        { from: 2001, to: 4000, rate: 0.28 },
        { from: 4001, to: 6000, rate: 0.32 },
        { from: 6001, to: Infinity, rate: 0.38 }
    ]);
    setFuelSurcharge(data.fuelSurcharge ?? (auth === 'DEWA' ? 0.06 : 0.05));
    setDaytimeConsumption(data.daytimeConsumption || 55);
    setAvailableSpace(data.availableSpace || 100);
    setPeakSunHours(data.peakSunHours || 5.5);
    setSystemEfficiency(data.systemEfficiency || 95);
    setPanelWattage(data.panelWattage || 610);
    setSystemCost(data.systemCost || '');
    setFirstYearDegradation(data.firstYearDegradation || 0.02);
    setDegradationRate(data.degradationRate || 0.005);
    setEscalationRate(data.escalationRate || 0.015);
    setBatteryEfficiency(data.batteryEfficiency || 0.90);
    setUsableDoD(data.usableDoD || 1.0);
    setInverterRatio(data.inverterRatio || (auth === 'DEWA' ? 1.0 : 1.05));
    setBatteryMode(data.batteryMode || 'night');
    setIsBifacialEnabled(data.isBifacialEnabled ?? true);
    setEscalateFuelSurcharge(data.escalateFuelSurcharge ?? false);
    setCreditExpiryMonths(data.creditExpiryMonths || 12);
  }, []);

  // Check for AI config on initial load
  useEffect(() => {
    const aiConfigString = sessionStorage.getItem('aiProjectConfig');
    if (aiConfigString) {
      try {
        const data = JSON.parse(aiConfigString);
        loadProjectData(data);
        alert('Project configuration applied from AI Assistant!');
      } catch (error) {
        console.error("Failed to parse AI configuration:", error);
        alert('Could not apply the AI configuration due to an error.');
      } finally {
        sessionStorage.removeItem('aiProjectConfig');
      }
    }
  }, [loadProjectData]);

  // Dynamic defaults
  useEffect(() => {
    setInverterRatio(authority === 'DEWA' ? 1.0 : 1.05);
    setFuelSurcharge(authority === 'DEWA' ? 0.06 : 0.05);
  }, [authority]);

  const idealBatteryEfficiency = showIdealOutput ? 1 : batteryEfficiency;
  const idealUsableDoD = showIdealOutput ? 1 : usableDoD;

  const calculateBillAmount = useCallback((consumption: number): number => {
    return calculateBillAmountForConsumption(consumption, tiers, fuelSurcharge);
  }, [tiers, fuelSurcharge]);
  
  const getAverageRate = useCallback((consumption: number): number => {
    if (consumption <= 0) return tiers[0]?.rate || 0;
    const tierBill = calculateBillAmountForConsumption(consumption, tiers, 0); // Exclude fuel surcharge for pure rate
    return tierBill / consumption;
  }, [tiers]);

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newFrom = lastTier.to === Infinity ? (lastTier.from + 2000) : (lastTier.to + 1);
    setTiers([...tiers.slice(0, -1), 
      { from: lastTier.from, to: newFrom - 1, rate: lastTier.rate },
      { from: newFrom, to: Infinity, rate: parseFloat((lastTier.rate + 0.05).toFixed(2)) }
    ]);
  };

  const updateTier = (index: number, field: keyof Tier, value: string) => {
    const newTiers = [...tiers];
    let numValue: number | typeof Infinity = field === 'rate' ? parseFloat(value) : parseInt(value, 10);
    
    if (isNaN(numValue as number)) {
      if (field === 'to') numValue = Infinity;
      else return; // Don't update if 'from' or 'rate' is not a number
    }

    (newTiers[index] as any)[field] = numValue;

    // Ensure from values are consistent after a 'to' is changed
    if (field === 'to' && index < newTiers.length - 1) {
       const nextTierFrom = numValue === Infinity ? newTiers[index].from + 2001 : (numValue as number) + 1;
       newTiers[index+1].from = nextTierFrom;
    }
    setTiers(newTiers);
  };
  
  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      const newTiers = tiers.filter((_, i) => i !== index);
      if(newTiers.length > 0 && index > 0 && newTiers[index-1]) {
        newTiers[index-1].to = Infinity;
      }
      setTiers(newTiers);
    }
  };

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
  }, [billInput, parseBillInput]);

  const removeBill = (index: number) => setBills(bills.filter((_, i) => i !== index));
  
  const handleBillInputKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBills();
    }
  };

  const handleEstimateFromPartialData = useCallback(() => {
    if (bills.length === 0 || bills.length >= 12) return;
    const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
    const totalBaseConsumption = bills.reduce((sum, bill) => sum + (bill.consumption / cityFactors[bill.month]), 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;
    const userProvidedMonths = new Set(bills.map(b => b.month));
    const estimatedBills = months.filter(month => !userProvidedMonths.has(month)).map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * cityFactors[month]);
        return { month, consumption: estimatedConsumption, amount: calculateBillAmount(estimatedConsumption), isEstimated: true };
    });
    setPendingEstimates(estimatedBills);
  }, [bills, calculateBillAmount, city]);
  
  const seasonalAnalysis = useMemo(() => {
    if (bills.length > 0) {
      const summerMonths = ['May', 'June', 'July', 'August', 'September'];
      const winterMonths = months.filter(m => !summerMonths.includes(m));
      const summerBills = bills.filter(bill => summerMonths.includes(bill.month));
      const winterBills = bills.filter(bill => winterMonths.includes(bill.month));
      const summerAvg = summerBills.length > 0 ? summerBills.reduce((sum, bill) => sum + bill.consumption, 0) / summerBills.length : 0;
      const winterAvg = winterBills.length > 0 ? winterBills.reduce((sum, bill) => sum + bill.consumption, 0) / winterBills.length : 0;
      const spikePercentage = winterAvg > 0 ? ((summerAvg - winterAvg) / winterAvg) * 100 : 0;
      return { summerAvg: Math.round(summerAvg), winterAvg: Math.round(winterAvg), spikePercentage: Math.round(spikePercentage), baseLoad: Math.round(winterAvg), coolingLoad: Math.round(summerAvg - winterAvg) };
    }
    return { summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0 };
  }, [bills]);

  const fullYearConsumptionStats = useMemo(() => {
    if (bills.length === 0) return { totalAnnual: 0, avgMonthly: 0 };

    const consumptionByMonth: { [key: string]: number } = {};
    if (bills.length === 12) {
      bills.forEach(b => consumptionByMonth[b.month] = b.consumption);
    } else {
      const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
      const totalProvidedConsumption = bills.reduce((sum, bill) => sum + bill.consumption, 0);
      const totalProvidedFactor = bills.reduce((sum, bill) => sum + (cityFactors[bill.month] || 1), 0);
      const baseConsumption = totalProvidedFactor > 0 ? totalProvidedConsumption / totalProvidedFactor : (bills.reduce((s,b)=>s+b.consumption, 0) / bills.length || 0);
      
      months.forEach(month => {
        const userBill = bills.find(b => b.month === month);
        consumptionByMonth[month] = userBill ? userBill.consumption : Math.round(baseConsumption * (cityFactors[month] || 1));
      });
    }
    const totalAnnual = Object.values(consumptionByMonth).reduce((sum, c) => sum + c, 0);
    const avgMonthly = totalAnnual / 12;
    return { totalAnnual, avgMonthly };
  }, [bills, city]);

  const systemMetrics = useMemo(() => {
    if (fullYearConsumptionStats.totalAnnual === 0) return { systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, actualSystemSize: 0 };
    
    let targetConsumption = fullYearConsumptionStats.totalAnnual / 365;

    if (authority === 'EtihadWE') {
        if (batteryEnabled && batteryMode === 'night') {
            targetConsumption = fullYearConsumptionStats.totalAnnual / 365;
        } else {
            targetConsumption = (fullYearConsumptionStats.totalAnnual / 365) * (daytimeConsumption / 100);
        }
    }
    
    // Effective production factor combines all boosts and losses
    const bifacialBoost = isBifacialEnabled ? BIFACIAL_BOOST_FACTOR : 1.0;
    const adjustedEfficiency = showIdealOutput ? 1 : systemEfficiency / 100;
    const adjustedLosses = showIdealOutput ? 1 : REAL_WORLD_LOSS_FACTOR;
    const effectiveProductionFactor = adjustedLosses * adjustedEfficiency * bifacialBoost;
    
    const requiredDailyProduction = targetConsumption;
    const requiredSystemSize = (requiredDailyProduction / peakSunHours) / effectiveProductionFactor;

    const panelCount = Math.ceil((requiredSystemSize * 1000) / panelWattage);
    const actualSystemSize = (panelCount * panelWattage) / 1000;
    const spaceRequired = panelCount * 2.1;
    
    const rawProduction = actualSystemSize * peakSunHours * 365;
    const annualProduction = rawProduction * effectiveProductionFactor;
    
    return { 
        systemSize: Math.round(actualSystemSize * 10) / 10, 
        panelCount, 
        spaceRequired: Math.round(spaceRequired), 
        annualProduction: Math.round(annualProduction), 
        actualSystemSize 
    };
  }, [fullYearConsumptionStats.totalAnnual, authority, batteryEnabled, batteryMode, daytimeConsumption, peakSunHours, systemEfficiency, panelWattage, showIdealOutput, isBifacialEnabled]);

  const monthlyProductionMap = useMemo(() => {
    const { annualProduction } = systemMetrics;
    if (annualProduction === 0) return months.reduce((acc, month) => ({ ...acc, [month]: 0 }), {});
    
    const seasonalFactors = CITY_SEASONAL_FACTORS[city];
    const totalFactor = months.reduce((sum, m) => sum + seasonalFactors[m], 0);
    return months.reduce((acc, month) => {
      const factor = seasonalFactors[month];
      acc[month] = (annualProduction * (factor / totalFactor));
      return acc;
    }, {} as { [key: string]: number });
  }, [systemMetrics.annualProduction, city]);

  const systemRecommendation = useMemo(() => {
    const { actualSystemSize, annualProduction } = systemMetrics;
    const { totalAnnual, avgMonthly } = fullYearConsumptionStats;
    const avgDaily = totalAnnual > 0 ? totalAnnual / 365 : 0;
    const inverterCapacity = Math.ceil(actualSystemSize * inverterRatio * 10) / 10;
    let batteryCapacity = 0;
    
    const unusedSolar = (() => {
      if (systemMetrics.annualProduction === 0 || totalAnnual === 0) return 0;
      let totalSelfConsumed = 0;
      const fullYearBills = months.map(month => {
        return bills.find(b => b.month === month) || { month, consumption: avgMonthly, amount: 0, isEstimated: true };
      });
      for (const bill of fullYearBills) {
          const monthlyProd = monthlyProductionMap[bill.month] || 0;
          let usedThisMonth = authority === 'EtihadWE'
            ? Math.min(monthlyProd, bill.consumption * (daytimeConsumption / 100))
            : Math.min(monthlyProd, bill.consumption);
          totalSelfConsumed += usedThisMonth;
      }
      return Math.round(systemMetrics.annualProduction - totalSelfConsumed);
    })();


    if (authority === 'EtihadWE' && batteryEnabled) {
        if (batteryMode === 'night') {
            const nightConsumption = avgDaily * (1 - daytimeConsumption / 100);
            batteryCapacity = Math.ceil(nightConsumption / (idealBatteryEfficiency * idealUsableDoD));
        } else if (batteryMode === 'unused') {
            batteryCapacity = Math.ceil((unusedSolar / 365) / (idealBatteryEfficiency * idealUsableDoD));
        }
    }
    
    const summerAvgConsumption = seasonalAnalysis.summerAvg > 0 ? seasonalAnalysis.summerAvg : avgMonthly;
    const winterAvgConsumption = seasonalAnalysis.winterAvg > 0 ? seasonalAnalysis.winterAvg : avgMonthly;
    
    const getMonthlyProduction = (month: string) => monthlyProductionMap[month] || 0;
    
    const summerMonths = ['May', 'June', 'July', 'August', 'September'];
    const summerProductionAvg = summerMonths.reduce((sum, m) => sum + getMonthlyProduction(m), 0) / summerMonths.length;
    
    const winterMonths = months.filter(m => !summerMonths.includes(m));
    const winterProductionAvg = winterMonths.reduce((sum, m) => sum + getMonthlyProduction(m), 0) / winterMonths.length;

    const summerCoverage = summerAvgConsumption > 0 ? (summerProductionAvg / summerAvgConsumption) * 100 : 100;
    const winterCoverage = winterAvgConsumption > 0 ? (winterProductionAvg / winterAvgConsumption) * 100 : 100;
    const annualCoverage = totalAnnual > 0 ? (annualProduction / totalAnnual) * 100 : 100;

    return {
        ...systemMetrics,
        inverterCapacity,
        batteryCapacity,
        summerCoverage: Math.min(Math.round(summerCoverage), 100),
        winterCoverage: Math.min(Math.round(winterCoverage), 100),
        annualCoverage: Math.min(Math.round(annualCoverage), 100),
        dailyAvgConsumption: Math.round(avgDaily),
        unusedSolar,
    };
  }, [systemMetrics, fullYearConsumptionStats, seasonalAnalysis, authority, batteryEnabled, batteryMode, daytimeConsumption, idealBatteryEfficiency, inverterRatio, idealUsableDoD, monthlyProductionMap, bills]);

  useEffect(() => {
    const parsedSystemCost = parseFloat(systemCost);
    if (isNaN(parsedSystemCost) || parsedSystemCost <= 0 || bills.length === 0 || systemRecommendation.annualProduction === 0) {
      setFinancialAnalysis({ annualSavings: 0, monthlySavings: 0, paybackPeriod: 0, roi25YearNetProfit: 0, roi25YearNetValue: 0, roiPercentage: 0, netMeteringCreditsValue: 0, billOffsetPercentage: 0 });
      return;
    }

    const SYSTEM_LIFESPAN_YEARS = 25;
    const initialInvestment = parsedSystemCost;
    const maintenanceCostPerYear = initialInvestment * 0.01;
    
    const consumptionByMonth: { [key: string]: number } = {};
    const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
    if (bills.length === 12) {
      bills.forEach(b => consumptionByMonth[b.month] = b.consumption);
    } else {
      const totalProvidedConsumption = bills.reduce((sum, bill) => sum + bill.consumption, 0);
      const totalProvidedFactor = bills.reduce((sum, bill) => sum + (cityFactors[bill.month] || 1), 0);
      const baseConsumption = totalProvidedFactor > 0 ? totalProvidedConsumption / totalProvidedFactor : (fullYearConsumptionStats.avgMonthly || 0);
      
      months.forEach(month => {
        const userBill = bills.find(b => b.month === month);
        consumptionByMonth[month] = userBill ? userBill.consumption : Math.round(baseConsumption * (cityFactors[month] || 1));
      });
    }

    let cumulativeCashFlow = -initialInvestment, paybackPeriodYears = 0, firstYearAnnualSavings = 0;
    let creditQueue: { year: number, monthIndex: number, kwh: number }[] = [];
    let totalOriginalBillYear1 = 0;

    for (let year = 1; year <= SYSTEM_LIFESPAN_YEARS; year++) {
      let yearlySavings = 0;
      
      let degradationFactor = 1;
      if (year === 2) {
        degradationFactor = 1 - firstYearDegradation;
      } else if (year > 2) {
        degradationFactor = (1 - firstYearDegradation) * Math.pow(1 - degradationRate, year - 2);
      }
      
      months.forEach((monthName, monthIndex) => {
          const currentMonthAbsolute = (year - 1) * 12 + monthIndex;
          // Expire credits that are older than the expiry period
          creditQueue = creditQueue.filter(credit => 
              currentMonthAbsolute - ((credit.year - 1) * 12 + credit.monthIndex) < creditExpiryMonths
          );

          const monthlyConsumption = consumptionByMonth[monthName];
          const monthlyProduction = (monthlyProductionMap[monthName] || 0) * degradationFactor;
          const originalBill = calculateBillAmountForConsumption(monthlyConsumption, tiers, fuelSurcharge, {
            escalate: true,
            escalateFuelSurcharge,
            escalationRate,
            year
          });
          if (year === 1) totalOriginalBillYear1 += originalBill;

          let newBill = 0;
          
          if (authority === 'DEWA') {
              const netKwh = monthlyProduction - monthlyConsumption;
              if (netKwh >= 0) { 
                  creditQueue.push({ year, monthIndex, kwh: netKwh });
                  newBill = 0; 
              } else {
                  let deficit = Math.abs(netKwh);
                  for (const credit of creditQueue) {
                      if (deficit === 0) break;
                      const drawAmount = Math.min(deficit, credit.kwh);
                      credit.kwh -= drawAmount;
                      deficit -= drawAmount;
                  }
                  creditQueue = creditQueue.filter(c => c.kwh > 0);
                  newBill = calculateBillAmountForConsumption(deficit, tiers, fuelSurcharge, {
                    escalate: true,
                    escalateFuelSurcharge,
                    escalationRate,
                    year
                  });
              }
              yearlySavings += originalBill - newBill;

          } else { // EtihadWE
              let savedKwh = 0;
              let monthlyServiceChargeSavings = 0;

              if (batteryEnabled) {
                  const daytimeLoadKwh = monthlyConsumption * (daytimeConsumption / 100);
                  const nighttimeLoadKwh = monthlyConsumption * (1 - daytimeConsumption / 100);

                  const solarUsedForDaytime = Math.min(monthlyProduction, daytimeLoadKwh);
                  const excessSolarAfterDaytime = monthlyProduction - solarUsedForDaytime;
                  
                  const batteryCapacityKwh = systemRecommendation.batteryCapacity;
                  // Daily discharge limit based on battery size and DoD
                  const maxDailyDischarge = batteryCapacityKwh * idealUsableDoD;
                  // Total potential storage for the month cannot exceed the total discharge capacity over the month
                  const potentialMonthlyStorage = maxDailyDischarge * 30.4;

                  const chargedToBattery = Math.min(excessSolarAfterDaytime, potentialMonthlyStorage);
                  const energyFromBattery = chargedToBattery * idealBatteryEfficiency;
                  
                  const nightLoadCoveredByBattery = Math.min(nighttimeLoadKwh, energyFromBattery);

                  savedKwh = solarUsedForDaytime + nightLoadCoveredByBattery;
              } else { // No battery
                  const daytimeLoadKwh = monthlyConsumption * (daytimeConsumption / 100);
                  savedKwh = Math.min(monthlyProduction, daytimeLoadKwh);
              }
              
              newBill = calculateBillAmountForConsumption(monthlyConsumption - savedKwh, tiers, fuelSurcharge, {
                  escalate: true,
                  escalateFuelSurcharge,
                  escalationRate,
                  year
              });
              monthlyServiceChargeSavings = savedKwh * ETISALAT_SERVICE_CHARGE_PER_KWH;
              yearlySavings += (originalBill - newBill) + monthlyServiceChargeSavings;
          }
      });

      if (year === 1) firstYearAnnualSavings = yearlySavings;
      const yearlyCashFlow = yearlySavings - maintenanceCostPerYear;
      if (paybackPeriodYears === 0 && (cumulativeCashFlow + yearlyCashFlow) > 0) {
        paybackPeriodYears = (year - 1) + (yearlyCashFlow > 0 ? Math.abs(cumulativeCashFlow) / yearlyCashFlow : 0);
      }
      cumulativeCashFlow += yearlyCashFlow;
    }
    
    const firstYearExcessKwh = authority === 'DEWA' ? creditQueue.reduce((acc, credit) => acc + credit.kwh, 0) : 0;
    const totalAnnualConsumption = Object.values(consumptionByMonth).reduce((sum, c) => sum + c, 0);
    const avgMonthlyConsumptionForRate = totalAnnualConsumption / 12;
    const averageRateForCredits = getAverageRate(avgMonthlyConsumptionForRate);
    const netMeteringCreditsValue = firstYearExcessKwh * averageRateForCredits;

    const netProfit = Math.round(cumulativeCashFlow);
    const roiPercentage = initialInvestment > 0 ? (netProfit / initialInvestment) * 100 : 0;
    const billOffsetPercentage = totalOriginalBillYear1 > 0 ? (firstYearAnnualSavings / totalOriginalBillYear1) * 100 : 0;
    const netValue = netProfit + initialInvestment;

    setFinancialAnalysis({ 
        annualSavings: Math.round(firstYearAnnualSavings), 
        monthlySavings: Math.round(firstYearAnnualSavings / 12),
        paybackPeriod: paybackPeriodYears > 0 ? parseFloat(paybackPeriodYears.toFixed(1)) : 0, 
        roi25YearNetProfit: netProfit,
        roi25YearNetValue: netValue,
        roiPercentage: Math.round(roiPercentage),
        netMeteringCreditsValue: Math.round(netMeteringCreditsValue),
        billOffsetPercentage: Math.round(billOffsetPercentage)
    });
  }, [systemCost, bills, city, systemRecommendation.annualProduction, systemRecommendation.batteryCapacity, authority, batteryEnabled, daytimeConsumption, monthlyProductionMap, firstYearDegradation, degradationRate, escalationRate, idealBatteryEfficiency, batteryMode, fullYearConsumptionStats, getAverageRate, tiers, fuelSurcharge, escalateFuelSurcharge, creditExpiryMonths, idealUsableDoD]);

  const environmentalAnalysis = useMemo(() => {
    const annualProduction = systemRecommendation.annualProduction;
    const annualCo2SavingsKg = annualProduction * CO2_EMISSIONS_FACTOR_KG_PER_KWH;
    const lifetimeCo2SavingsKg = annualCo2SavingsKg * 25;
    const annualTreesPlanted = annualCo2SavingsKg / 21.77; // Avg CO2 sequestered by a mature tree annually
    return {
      annualCo2SavingsKg,
      lifetimeCo2SavingsKg,
      lifetimeTreesPlanted: annualTreesPlanted * 25,
      lifetimeCarsOffRoad: Math.ceil(lifetimeCo2SavingsKg / 4600),
    };
  }, [systemRecommendation.annualProduction]);

  const generateMonthlyData = () => months.map(month => ({ 
      month: month.substring(0, 3), 
      Consumption: bills.find(b => b.month === month)?.consumption || fullYearConsumptionStats.avgMonthly, 
      Production: Math.round(monthlyProductionMap[month] || 0) 
  }));
  
  const copyReport = () => {
    const totalAnnualConsumption = fullYearConsumptionStats.totalAnnual;
    const coveragePercent = totalAnnualConsumption > 0 ? (systemRecommendation.annualProduction / totalAnnualConsumption) * 100 : 0;

    let summary = `SOLAR OASIS - PROJECT REPORT
============================
Project: ${projectName || 'N/A'}
Authority: ${authority}
Date: ${new Date().toLocaleDateString()}

CONSUMPTION ANALYSIS
--------------------
Annual Consumption: ${totalAnnualConsumption.toLocaleString(undefined, {maximumFractionDigits:0})} kWh
Avg Monthly Bill: AED ${(calculateBillAmount(fullYearConsumptionStats.avgMonthly)).toLocaleString(undefined, {maximumFractionDigits:0})}
Summer Avg: ${seasonalAnalysis.summerAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/month
Winter Avg: ${seasonalAnalysis.winterAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/month

RECOMMENDED SYSTEM
------------------
System Size: ${systemRecommendation.systemSize} kWp
Number of Panels: ${systemRecommendation.panelCount} × ${panelWattage}W (Bifacial)
Annual Production: ${systemRecommendation.annualProduction.toLocaleString()} kWh
System Coverage: ${coveragePercent.toFixed(1)}%
Bill Offset: ${financialAnalysis.billOffsetPercentage.toFixed(0)}%
${batteryEnabled ? `Battery Capacity: ${systemRecommendation.batteryCapacity} kWh` : ''}

FINANCIAL ANALYSIS
------------------
System Cost: AED ${parseFloat(systemCost).toLocaleString()}
First-Year Savings: AED ${financialAnalysis.annualSavings.toLocaleString()}
Avg Monthly Savings: AED ${financialAnalysis.monthlySavings.toLocaleString()}
Payback Period: ${financialAnalysis.paybackPeriod} years
25-Year Net Profit: AED ${financialAnalysis.roi25YearNetProfit.toLocaleString()}
ROI: ${financialAnalysis.roiPercentage.toFixed(0)}%
${authority === 'DEWA' ? `Projected Net-Metering Credits (Y1): AED ${financialAnalysis.netMeteringCreditsValue.toLocaleString()}` : ''}

ENVIRONMENTAL IMPACT
--------------------
25-Year CO₂ Savings: ${(environmentalAnalysis.lifetimeCo2SavingsKg / 1000).toLocaleString(undefined, {maximumFractionDigits:1})} Tonnes
(Equivalent to planting approx. ${environmentalAnalysis.lifetimeTreesPlanted.toLocaleString(undefined, {maximumFractionDigits:0})} trees or taking ${environmentalAnalysis.lifetimeCarsOffRoad.toLocaleString()} cars off the road)
`
    navigator.clipboard.writeText(summary).then(() => alert('Report copied to clipboard!'));
  };

  const fullCalculationBreakdown = useMemo(() => {
    let text = `FULL CALCULATION BREAKDOWN\n============================\n`;
    if (!systemCost || bills.length === 0) {
      return text + "Please enter bills and system cost to see the full breakdown.";
    }
    
    text += `[INPUTS]\n`;
    text += `- Authority: ${authority}, Battery: ${batteryEnabled ? 'Yes' : 'No'}\n`;
    text += `- System Cost: AED ${systemCost}\n`;
    text += `- Bills entered: ${bills.length}\n`;
    text += `- Panel Wattage: ${panelWattage}W, System Efficiency: ${systemEfficiency}%, PSH: ${peakSunHours}\n`;
    text += `- Bifacial Panels: ${isBifacialEnabled ? 'Yes (7% Boost)' : 'No'}\n`;
    text += `- Degradation: ${firstYearDegradation * 100}% (Y1), ${degradationRate * 100}%/yr after\n`;
    text += `- Escalation Rate: ${escalationRate * 100}%/yr\n`;
    if (batteryEnabled) {
      text += `- Battery Params: Efficiency ${batteryEfficiency * 100}%, DoD ${usableDoD * 100}%\n`;
    }
    text += `\n`;

    text += `[CONSUMPTION]\n`;
    text += `- Total Annual Consumption: ${fullYearConsumptionStats.totalAnnual.toFixed(0)} kWh\n`;
    text += `- Average Daily Consumption: ${(fullYearConsumptionStats.totalAnnual / 365).toFixed(0)} kWh\n\n`;

    text += `[SYSTEM SIZING]\n`;
    text += `- Target Daily Production: ${(fullYearConsumptionStats.totalAnnual / 365 * (authority === 'EtihadWE' && !batteryEnabled ? daytimeConsumption/100 : 1)).toFixed(2)} kWh\n`;
    text += `- Required System Size (Ideal): ${((fullYearConsumptionStats.totalAnnual / 365 * (authority === 'EtihadWE' && !batteryEnabled ? daytimeConsumption/100 : 1)) / peakSunHours).toFixed(2)} kWp\n`;
    text += `- Actual System Size (kWp): ${systemRecommendation.actualSystemSize} kWp (${systemRecommendation.panelCount} panels)\n`;
    text += `- Ideal Annual Production: ${(systemRecommendation.actualSystemSize * peakSunHours * 365).toFixed(0)} kWh\n`;
    text += `- Final Annual Production (after losses, efficiency & boost): ${systemRecommendation.annualProduction.toFixed(0)} kWh\n\n`;
    
    text += `[FINANCIALS - Year 1]\n`;
    text += `- First Year Savings: AED ${financialAnalysis.annualSavings.toFixed(2)}\n`;
    text += `- Maintenance (1%): AED ${(parseFloat(systemCost || '0') * 0.01).toFixed(2)}\n\n`;

    text += `[COVERAGE & MONTHLY DATA - Year 1]\n`;
    months.forEach(m => {
        const cons = bills.find(b => b.month === m)?.consumption || fullYearConsumptionStats.avgMonthly;
        const prod = monthlyProductionMap[m] || 0;
        text += `- ${m.substring(0,3)}: Cons ${cons.toFixed(0)}, Prod ${prod.toFixed(0)}, Coverage: ${(cons > 0 ? prod/cons*100 : 0).toFixed(0)}%\n`;
    });
    text += `\n[END OF BREAKDOWN]`;
    
    return text;

  }, [authority, batteryEnabled, systemCost, bills, panelWattage, systemEfficiency, peakSunHours, isBifacialEnabled, fullYearConsumptionStats, systemRecommendation, financialAnalysis, monthlyProductionMap, daytimeConsumption, firstYearDegradation, degradationRate, escalationRate, batteryEfficiency, usableDoD]);


  const saveProject = () => {
    const projectData = { 
        projectName, city, authority, batteryEnabled, bills, tiers, fuelSurcharge,
        daytimeConsumption, availableSpace, peakSunHours, systemEfficiency, panelWattage, 
        systemCost, firstYearDegradation, degradationRate, escalationRate, batteryEfficiency, usableDoD,
        inverterRatio, batteryMode, isBifacialEnabled, escalateFuelSurcharge, creditExpiryMonths
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const linkElement = document.createElement('a');
    linkElement.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    linkElement.download = `${projectName.replace(/\s/g, '_') || 'solar_project'}_${new Date().toISOString().split('T')[0]}.json`;
    linkElement.click();
  };

   const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          loadProjectData(data);
          alert('Project imported successfully!');
        } catch (err) {
          alert('Failed to import project. Please check the file format.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-start">
         <Button asChild variant="ghost">
            <label htmlFor="import-project" className="cursor-pointer flex items-center text-brand-primary font-semibold">
                <Upload size={16} className="mr-2"/> Import Project
            </label>
         </Button>
        <input type="file" id="import-project" className="hidden" accept=".json" onChange={importProject}/>
      </div>

      <Card title="Project Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Villa Solar Project" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City / Emirate</label>
              <Select value={city} onChange={(e) => setCity(e.target.value)}>
                {Object.keys(CITY_SEASONAL_FACTORS).map(cityOption => (
                  <option key={cityOption} value={cityOption}>{cityOption}</option>
                ))}
              </Select>
            </div>
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
      
      <Card title="Electricity Bill Analysis">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="bill-input" className="block text-sm font-medium text-gray-700 mb-1">Quick Bill Entry</label>
            <textarea id="bill-input" value={billInput} onChange={(e) => setBillInput(e.target.value)} onKeyPress={handleBillInputKeyPress}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm h-28"
              placeholder="Enter bills like:&#10;Jan-8200&#10;Feb-5700&#10;Or comma-separated: Mar-2818, Apr-2217" />
            <Button onClick={addBills} className="mt-2 w-full" variant="secondary">Add Bills</Button>
          </div>
          <div className="space-y-4">
              <Input label="Fuel Surcharge (AED/kWh)" type="number" value={fuelSurcharge} onChange={(e) => setFuelSurcharge(parseFloat(e.target.value) || 0)} step="0.01"/>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-medium text-gray-700">Rate Tiers (AED/kWh)</h3><Button onClick={addTier} size="sm" variant="ghost" aria-label="Add Tier"><PlusCircle size={16} /></Button></div>
                <div className="space-y-2">
                  {tiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-1 text-xs">
                      <Input type="number" value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} className="w-16" aria-label="Tier From" disabled={index > 0} />
                      <span>-</span>
                      <Input type="number" value={tier.to === Infinity ? '' : tier.to} onChange={(e) => updateTier(index, 'to', e.target.value)} className="w-16" placeholder={tier.to === Infinity ? '∞' : 'To'} aria-label="Tier To" disabled={index === tiers.length - 1} />
                      <Input type="number" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} className="w-16" step="0.01" placeholder="Rate" aria-label="Tier Rate"/>
                      <Button onClick={() => removeTier(index)} size="sm" variant="danger" aria-label="Remove Tier"><Trash2 size={14} /></Button>
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
                 {!bills.some(b => ['May', 'June', 'July', 'August', 'September'].includes(b.month)) && (
                    <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded-md mb-3">
                        <strong>Note:</strong> The estimation is based on non-summer months. The projected annual consumption may be underestimated as it does not account for higher summer usage.
                    </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                  {pendingEstimates.map((bill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm w-12">{bill.month}</span>
                      <input type="number" value={bill.consumption}
                        onChange={(e) => {
                          const newEstimates = [...pendingEstimates];
                          newEstimates[index].consumption = parseFloat(e.target.value) || 0;
                          setPendingEstimates(newEstimates);
                        }}
                        className="w-24 px-2 py-1 border rounded-md text-sm shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-4">
                  <Button onClick={() => {
                    setBills(prev => [...prev.filter(b => !b.isEstimated), ...pendingEstimates].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month)));
                    setPendingEstimates([]);
                  }} variant="primary">Apply Estimates</Button>
                  <Button onClick={() => setPendingEstimates([])} variant="ghost">Cancel</Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mt-6 p-4 rounded-lg bg-brand-light">
              {[
                  { key: 'Daily Avg', value: `${systemRecommendation.dailyAvgConsumption.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` },
                  { key: 'Avg Monthly', value: `${fullYearConsumptionStats.avgMonthly.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` },
                  { key: 'Total Annual', value: `${fullYearConsumptionStats.totalAnnual.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` },
                  { key: 'Summer Avg', value: `${seasonalAnalysis.summerAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/mo` }, 
                  { key: 'Winter Avg', value: `${seasonalAnalysis.winterAvg.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/mo` },
                  { key: 'Summer Spike', value: `${seasonalAnalysis.spikePercentage.toLocaleString(undefined, {maximumFractionDigits:0})}%` },
                  { key: 'Base Load', value: `${seasonalAnalysis.baseLoad.toLocaleString(undefined, {maximumFractionDigits:0})} kWh`},
                  { key: 'Cooling Load', value: `${seasonalAnalysis.coolingLoad.toLocaleString(undefined, {maximumFractionDigits:0})} kWh`},
              ].map(({key, value}) => (
                <div key={key}>
                  <p className="text-sm text-brand-primary">{key}</p>
                  <p className={`text-xl font-semibold ${key === 'Summer Spike' ? 'text-brand-secondary' : 'text-brand-dark'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="System Parameters">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start">
            {authority === 'EtihadWE' && (
                <Input label="Daytime Use (%)" type="number" value={daytimeConsumption} onChange={(e) => setDaytimeConsumption(parseInt(e.target.value) || 0)} min="0" max="100" />
            )}
            <Input label="Available Space (m²)" type="number" value={availableSpace} onChange={(e) => setAvailableSpace(parseFloat(e.target.value) || 0)} />
            <Input label="Peak Sun Hours" type="number" value={peakSunHours} onChange={(e) => setPeakSunHours(parseFloat(e.target.value) || 0)} step={0.1} />
            <Input label="System Efficiency (%)" type="number" value={systemEfficiency} onChange={(e) => setSystemEfficiency(parseFloat(e.target.value) || 0)} />
            <Input label="Panel Wattage (W)" type="number" value={panelWattage} onChange={(e) => setPanelWattage(parseFloat(e.target.value) || 0)} />
            <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Inverter Sizing Ratio</label>
                <Select value={inverterRatio} onChange={(e) => setInverterRatio(parseFloat(e.target.value))} className="w-full text-sm" >
                    <option value={0.85}>0.85 – Cost-focused residential</option>
                    <option value={1.0}>1.00 – Net metering (DEWA)</option>
                    <option value={1.05}>1.05 – Light oversize (buffering)</option>
                    <option value={1.1}>1.10 – Commercial rooftops</option>
                    <option value={1.15}>1.15 – Hybrid with battery</option>
                    <option value={1.2}>1.20 – Industrial/export systems</option>
                </Select>
            </div>
        </div>
        {authority === 'EtihadWE' && batteryEnabled && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-start mt-4 pt-4 border-t border-gray-200">
                 <Input label="Battery Efficiency (%)" type="number" value={batteryEfficiency * 100} onChange={(e) => setBatteryEfficiency(parseFloat(e.target.value) / 100 || 0)} min="0" max="100" />
                 <Input label="Battery Usable DoD (%)" type="number" value={usableDoD * 100} onChange={(e) => setUsableDoD(parseFloat(e.target.value) / 100 || 0)} min="0" max="100" />
            </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <input type="checkbox" id="bifacial-toggle" checked={isBifacialEnabled} onChange={(e) => setIsBifacialEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                    <label htmlFor="bifacial-toggle" className="text-sm text-gray-600">Bifacial Panels (+7% Boost)</label>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="ideal-output-toggle" checked={showIdealOutput} onChange={(e) => setShowIdealOutput(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                    <label htmlFor="ideal-output-toggle" className="text-sm text-gray-600">Ideal Output (No Losses)</label>
                </div>
            </div>
            <div>
                 <button onClick={() => setShowLossesExplanation(!showLossesExplanation)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    How is production calculated? {showLossesExplanation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showLossesExplanation && (
                    <div className="mt-2 p-3 bg-gray-50 border rounded-lg text-xs text-gray-700 space-y-3">
                        <p>A system's final output is determined by its ideal potential minus several distinct types of losses, which are multiplied together:</p>
                        
                        <div>
                            <h4 className="font-semibold text-gray-800">1. System Component Efficiency ({systemEfficiency}%)</h4>
                            <p className="mb-1">Accounts for energy lost within the physical equipment. It's an aggregate of:</p>
                            <ul className="list-disc list-inside ml-4">
                                <li><strong>Inverter Losses (~1.4%):</strong> Energy lost when converting DC power from panels to usable AC power.</li>
                                <li><strong>Wiring & Mismatch (~1.5%):</strong> Losses from cables and minor variations between panels.</li>
                                <li><strong>Connectors & Other (~0.2%):</strong> Minor losses from system connections.</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-800">2. Environmental & Soiling Factor ({Math.round(REAL_WORLD_LOSS_FACTOR * 100)}%)</h4>
                            <p className="mb-1">Accounts for production loss due to on-site environmental conditions:</p>
                            <ul className="list-disc list-inside ml-4">
                                <li><strong>Soiling (Dust):</strong> Dust and dirt on the panel surface blocking sunlight.</li>
                                <li><strong>Temperature Derating:</strong> High temperatures reducing panel efficiency.</li>
                                <li><strong>Ambient Conditions:</strong> Minor shading, cloudiness, and other atmospheric effects.</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-800">3. Bifacial Boost ({isBifacialEnabled ? '7%' : '0%'})</h4>
                            <p>An extra energy gain from light reflected onto the back of bifacial panels.</p>
                        </div>

                        <p className="font-semibold mt-3 pt-2 border-t">Final Production = Ideal Production &times; System Efficiency &times; Environmental Factor &times; Bifacial Boost</p>
                    </div>
                )}
            </div>
        </div>
      </Card>
      
      {bills.length > 0 && (
        <>
        <Card title="Recommended System">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemRecommendation.systemSize} kWp</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary text-center"><p className="text-sm text-brand-primary">Number of Panels</p><p className="text-2xl font-bold text-brand-primary">{systemRecommendation.panelCount}</p></div>
            <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">Annual Production</p><p className="text-2xl font-bold">{systemRecommendation.annualProduction.toLocaleString()} kWh</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary text-center"><p className="text-sm text-brand-primary">Inverter Capacity</p><p className="text-2xl font-bold text-brand-primary">{systemRecommendation.inverterCapacity} kW</p></div>
          </div>
          
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
                <div><p className="text-sm text-gray-600">Annual Average</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-green-500" style={{width: `${systemRecommendation.annualCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-green-600">{systemRecommendation.annualCoverage}%</p></div>
            </div>
          </div>
          {systemRecommendation.spaceRequired > availableSpace && (<div className="bg-red-100 border border-red-300 rounded-lg p-4 flex items-center gap-2 text-sm mt-4"><AlertCircle className="w-5 h-5 text-red-600" /><p className="text-red-800">Warning: Required space ({systemRecommendation.spaceRequired} m²) exceeds available space ({availableSpace} m²).</p></div>)}
        </Card>

        <Card title="Financial & ROI Analysis">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2 gap-4 mb-6">
            <Input label="System Cost (AED)" type="number" value={systemCost} onChange={(e) => setSystemCost(e.target.value)} placeholder="Enter total cost..." />
            <Input label="Price Escalation (%/yr)" type="number" value={escalationRate * 100} onChange={(e) => setEscalationRate(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
          </div>

          <div className="p-4 rounded-lg bg-gray-50 border grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-6 items-start">
             <Input label="First Year Degradation (%)" type="number" value={firstYearDegradation * 100} onChange={(e) => setFirstYearDegradation(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
             <Input label="Annual Degradation (%)" type="number" value={degradationRate * 100} onChange={(e) => setDegradationRate(parseFloat(e.target.value) / 100 || 0)} step="0.01" />
             <div className="flex items-center gap-2 pt-7">
                <input type="checkbox" id="escalate-fuel-toggle" checked={escalateFuelSurcharge} onChange={(e) => setEscalateFuelSurcharge(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <label htmlFor="escalate-fuel-toggle" className="text-sm text-gray-600">Escalate Fuel Surcharge</label>
            </div>
             {authority === 'DEWA' && <Input label="Credit Expiry (Months)" type="number" value={creditExpiryMonths} onChange={(e) => setCreditExpiryMonths(parseInt(e.target.value) || 12)} />}
          </div>

          {systemCost && parseFloat(systemCost) > 0 && (<>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="bg-green-100 border border-green-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">First-Year Savings</p><p className="text-xl font-bold text-green-700">AED {financialAnalysis.annualSavings.toLocaleString()}</p></div>
              <div className="bg-green-100 border border-green-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Avg Monthly Savings</p><p className="text-xl font-bold text-green-700">AED {financialAnalysis.monthlySavings.toLocaleString()}</p></div>
              <div className="bg-blue-100 border border-blue-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">Payback Period</p><p className="text-xl font-bold text-blue-700">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} yrs` : 'N/A'}</p></div>
              <div className="bg-amber-100 border border-amber-200 p-4 rounded-lg text-center"><p className="text-sm text-gray-600">ROI %</p><p className="text-xl font-bold text-amber-700">{financialAnalysis.roiPercentage}%</p></div>
              <div className="p-4 rounded-lg text-white bg-brand-primary text-center"><p className="text-sm opacity-90">Bill Offset</p><p className="text-2xl font-bold">{financialAnalysis.billOffsetPercentage}%</p></div>
              <div className="bg-purple-100 border border-purple-200 p-4 rounded-lg text-center col-span-2 lg:col-span-2"><p className="text-sm text-gray-600">25-Year Net Profit</p><p className="text-xl font-bold text-purple-700">AED {financialAnalysis.roi25YearNetProfit.toLocaleString()}</p></div>
              <div className="bg-purple-100 border border-purple-200 p-4 rounded-lg text-center col-span-2 lg:col-span-3"><p className="text-sm text-gray-600">25-Year Net Value</p><p className="text-xl font-bold text-purple-700">AED {financialAnalysis.roi25YearNetValue.toLocaleString()}</p></div>
            </div>
            
            {authority === 'DEWA' && financialAnalysis.netMeteringCreditsValue > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 my-4 text-sm text-center">
                    <p className="text-green-800">
                        Projected First-Year Net-Metering Credits: <strong>AED {financialAnalysis.netMeteringCreditsValue.toLocaleString()}</strong>
                        <br />
                        <span className="text-xs">This value represents the excess energy sent to the grid, which will roll over to offset future bills (expires after {creditExpiryMonths} months).</span>
                    </p>
                </div>
            )}

            <div className="mt-6"><h3 className="text-lg font-semibold mb-3 text-brand-primary">Monthly Consumption vs. Production</h3><ResponsiveContainer width="100%" height={300}><BarChart data={generateMonthlyData()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Consumption" fill="#003366" /><Bar dataKey="Production" fill="#FFD700" /></BarChart></ResponsiveContainer></div>
          </>)}
        </Card>
        
        <Card title="Environmental Impact">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-blue-100 border border-blue-200 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                    <Leaf size={32} className="text-brand-primary"/>
                    <div>
                        <p className="text-xl font-bold text-brand-primary">{(environmentalAnalysis.lifetimeCo2SavingsKg / 1000).toLocaleString(undefined, {maximumFractionDigits: 1})} T</p>
                        <p className="text-sm text-blue-800">CO₂ Saved (25 Yrs)</p>
                        <p className="text-xs text-blue-600">({(environmentalAnalysis.annualCo2SavingsKg / 1000).toLocaleString(undefined, {maximumFractionDigits: 1})} T/yr)</p>
                    </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                     <Trees size={32} className="text-green-600"/>
                    <div>
                        <p className="text-xl font-bold text-green-700">{environmentalAnalysis.lifetimeTreesPlanted.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                        <p className="text-sm text-gray-600">Trees Planted Equiv. (25 Yrs)</p>
                    </div>
                </div>
                <div className="bg-yellow-100 border border-yellow-200 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
                     <Car size={32} className="text-yellow-500"/>
                    <div>
                        <p className="text-xl font-bold text-brand-secondary">{environmentalAnalysis.lifetimeCarsOffRoad.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                        <p className="text-sm text-yellow-800">Cars Off Road Equiv. (25 Yrs)</p>
                    </div>
                </div>
            </div>
            <p className="text-xs text-center text-gray-500 mt-4">Based on an emissions factor of {CO2_EMISSIONS_FACTOR_KG_PER_KWH} kg CO₂ per kWh for the UAE grid.</p>
        </Card>
        
        <Card title="Export & Save">
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={copyReport} disabled={!systemCost || bills.length === 0}><Copy className="w-5 h-5 mr-2" /> Copy Report</Button>
            <Button onClick={saveProject} disabled={bills.length === 0} variant="secondary"><Save className="w-5 h-5 mr-2" /> Save Project</Button>
          </div>
        </Card>
        
        {bills.length > 0 && (
            <Card>
                <button onClick={() => setShowBreakdown(!showBreakdown)} className="w-full flex justify-between items-center text-left font-semibold text-gray-700">
                    <span>Full Calculation Breakdown</span>
                    {showBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {showBreakdown && (
                    <textarea
                        readOnly
                        value={fullCalculationBreakdown}
                        className="w-full h-96 mt-4 p-2 font-mono text-xs bg-gray-900 text-green-400 rounded-lg border border-gray-700"
                    />
                )}
            </Card>
        )}
        </>
      )}
    </div>
  );
};

export default CalculatorPage;