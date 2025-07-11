
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { Sun, Battery, TrendingUp, FileText, AlertCircle, Trash2, PlusCircle, Download, XCircle, Wand2, Info } from 'lucide-react';
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
  to: number;
  rate: number;
}

interface SeasonalAnalysis {
  summerAvg: number;
  winterAvg: number;
  spikePercentage: number;
  baseLoad: number;
  coolingLoad: number;
}

interface SystemRecommendation {
  systemSize: number;
  panelCount: number;
  spaceRequired: number;
  annualProduction: number;
  inverterCapacity: number;
  batteryCapacity: number;
  summerCoverage: number;
  winterCoverage: number;
  annualCoverage: number;
  dailyAvgConsumption: number;
}

interface FinancialAnalysis {
  annualSavings: number;
  paybackPeriod: number;
  roi25Year: number;
  netMeteringCredits: number;
  roiPercentage: number;
}

// Constants
const UAE_SEASONAL_FACTORS: { [key: string]: number } = {
  'January': 0.75, 'February': 0.70, 'March': 0.80, 'April': 0.95,
  'May': 1.15, 'June': 1.35, 'July': 1.50, 'August': 1.45,
  'September': 1.25, 'October': 1.05, 'November': 0.85, 'December': 0.80,
};

const CITY_SEASONAL_FACTORS: { [city: string]: { [month: string]: number } } = {
  'Dubai': { January: 0.72, February: 0.77, March: 0.91, April: 1.05, May: 1.18, June: 1.25, July: 1.28, August: 1.22, September: 1.10, October: 0.94, November: 0.83, December: 0.75 },
  'Ajman': { January: 0.73, February: 0.78, March: 0.92, April: 1.05, May: 1.17, June: 1.24, July: 1.27, August: 1.22, September: 1.11, October: 0.95, November: 0.83, December: 0.74 },
  'Sharjah': { January: 0.72, February: 0.77, March: 0.90, April: 1.04, May: 1.18, June: 1.25, July: 1.28, August: 1.21, September: 1.10, October: 0.93, November: 0.82, December: 0.74 },
  'Abu Dhabi': { January: 0.74, February: 0.79, March: 0.91, April: 1.05, May: 1.17, June: 1.24, July: 1.26, August: 1.22, September: 1.10, October: 0.95, November: 0.84, December: 0.75 },
  'Ras Al Khaimah': { January: 0.71, February: 0.76, March: 0.89, April: 1.03, May: 1.17, June: 1.25, July: 1.28, August: 1.23, September: 1.12, October: 0.95, November: 0.83, December: 0.73 },
  'Fujairah': { January: 0.69, February: 0.74, March: 0.86, April: 1.00, May: 1.14, June: 1.23, July: 1.27, August: 1.21, September: 1.10, October: 0.94, November: 0.81, December: 0.71 },
  'Umm Al Quwain': { January: 0.72, February: 0.77, March: 0.91, April: 1.04, May: 1.16, June: 1.24, July: 1.27, August: 1.22, September: 1.11, October: 0.94, November: 0.83, December: 0.74 }
};

const months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];

const CalculatorPage: React.FC = () => {
  // Project Configuration
  const [authority, setAuthority] = useState<string>('DEWA');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [location, setLocation] = useState<string>('Dubai, UAE');
  const [city, setCity] = useState('Dubai');

  // Bill Inputs
  const [bills, setBills] = useState<Bill[]>([]);
  const [billInput, setBillInput] = useState<string>('');
  const [rateStructure, setRateStructure] = useState<string>('flat');
  const [electricityRate, setElectricityRate] = useState<number>(0.38);
  const [tiers, setTiers] = useState<Tier[]>([
    { from: 0, to: 2000, rate: 0.23 },
    { from: 2001, to: 4000, rate: 0.28 },
    { from: 4001, to: 6000, rate: 0.32 },
    { from: 6001, to: Infinity, rate: 0.38 }
  ]);

  // System Parameters
  const [daytimeConsumption, setDaytimeConsumption] = useState<number>(60);
  const [availableSpace, setAvailableSpace] = useState<number>(100);
  const [peakSunHours, setPeakSunHours] = useState<number>(5.5);
  const [systemEfficiency, setSystemEfficiency] = useState<number>(85);
  const [panelWattage, setPanelWattage] = useState<number>(550);
  const [batteryEfficiency, setBatteryEfficiency] = useState(0.95);
  const [usableDoD, setUsableDoD] = useState(0.9);
  const [showIdealOutput, setShowIdealOutput] = useState(false);
  const [inverterRatio, setInverterRatio] = useState(1.1);
  const [batteryMode, setBatteryMode] = useState<'night' | 'unused'>('night');

  // ROI Inputs
  const [systemCost, setSystemCost] = useState<string>('');
  const [degradationRate, setDegradationRate] = useState(0.007);
  const [escalationRate, setEscalationRate] = useState(0.02);
  
  // Calculated Values
  const [financialAnalysis, setFinancialAnalysis] = useState<FinancialAnalysis>({ annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0, roiPercentage: 0 });

  const calculateBillAmount = useCallback((consumption: number): number => {
    if (consumption <= 0) return 0;
    if (rateStructure === 'flat') {
      return consumption * electricityRate;
    } else {
      let totalAmount = 0;
      let remainingConsumption = consumption;
      for (const tier of tiers) {
        if (remainingConsumption <= 0) break;
        const tierStart = tier.from > 0 ? tier.from -1 : 0;
        const tierConsumption = tier.to === Infinity ? remainingConsumption : Math.min(remainingConsumption, tier.to - tierStart);
        totalAmount += Math.max(0, tierConsumption) * tier.rate;
        remainingConsumption -= tierConsumption;
      }
      return totalAmount;
    }
  }, [rateStructure, electricityRate, tiers]);
  
  const getAverageRate = useCallback((consumption: number): number => {
    if (consumption === 0) return rateStructure === 'flat' ? electricityRate : tiers[0]?.rate || 0;
    if (rateStructure === 'flat') return electricityRate;
    return calculateBillAmount(consumption) / consumption;
  }, [rateStructure, electricityRate, tiers, calculateBillAmount]);

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
    const numValue = field === 'rate' ? parseFloat(value) : parseInt(value, 10);
    if (field === 'to' && index < tiers.length - 1) newTiers[index + 1].from = numValue + 1;
    (newTiers[index] as any)[field] = numValue;
    setTiers(newTiers);
  };
  
  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      const newTiers = tiers.filter((_, i) => i !== index);
      if(newTiers.length > 0 && index > 0 && newTiers[index-1]) newTiers[index-1].to = Infinity;
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
  }, [calculateBillAmount, bills, months]);

  const addBills = useCallback(() => {
    const newBills = parseBillInput(billInput);
    if (newBills.length > 0) {
      setBills(prevBills => [...prevBills, ...newBills].filter((bill, index, self) => 
        index === self.findIndex((b) => b.month === bill.month)
      ).sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month)));
      setBillInput('');
    }
  }, [billInput, parseBillInput, months]);

  const removeBill = (index: number) => setBills(bills.filter((_, i) => i !== index));
  
  const handleBillInputKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBills();
    }
  };

  const handleEstimateFromPartialData = useCallback(() => {
    if (bills.length === 0 || bills.length >= 12) return;
    const totalBaseConsumption = bills.reduce((sum, bill) => sum + (bill.consumption / UAE_SEASONAL_FACTORS[bill.month]), 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;
    const userProvidedMonths = new Set(bills.map(b => b.month));
    const estimatedBills = months.filter(month => !userProvidedMonths.has(month)).map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * UAE_SEASONAL_FACTORS[month]);
        return { month, consumption: estimatedConsumption, amount: calculateBillAmount(estimatedConsumption), isEstimated: true };
    });
    setBills([...bills.map(b => ({ ...b, isEstimated: false })), ...estimatedBills].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month)));
  }, [bills, calculateBillAmount, months]);
  
  const seasonalAnalysis = useMemo<SeasonalAnalysis>(() => {
    if (bills.length > 0) {
      const summerMonths = ['May', 'June', 'July', 'August', 'September'];
      const winterMonths = ['October', 'November', 'December', 'January', 'February', 'March', 'April'];
      const summerBills = bills.filter(bill => summerMonths.includes(bill.month));
      const winterBills = bills.filter(bill => winterMonths.includes(bill.month));
      const summerAvg = summerBills.length > 0 ? summerBills.reduce((sum, bill) => sum + bill.consumption, 0) / summerBills.length : 0;
      const winterAvg = winterBills.length > 0 ? winterBills.reduce((sum, bill) => sum + bill.consumption, 0) / winterBills.length : 0;
      const spikePercentage = winterAvg > 0 ? ((summerAvg - winterAvg) / winterAvg) * 100 : 0;
      return { summerAvg: Math.round(summerAvg), winterAvg: Math.round(winterAvg), spikePercentage: Math.round(spikePercentage), baseLoad: Math.round(winterAvg), coolingLoad: Math.round(summerAvg - winterAvg) };
    }
    return { summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0 };
  }, [bills]);

  const consumptionStats = useMemo(() => {
    if (bills.length === 0) return { avgMonthly: 0, avgDaily: 0, totalAnnual: 0 };
    const avgMonthly = bills.reduce((sum, b) => sum + b.consumption, 0) / bills.length;
    const avgDaily = avgMonthly / 30;
    const totalAnnual = avgMonthly * 12;
    return { avgMonthly, avgDaily, totalAnnual };
  }, [bills]);

  const systemMetrics = useMemo(() => {
    if (consumptionStats.avgDaily === 0) return { systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, actualSystemSize: 0 };
    let targetConsumption = consumptionStats.avgDaily;
    if (authority === 'FEWA' && !batteryEnabled) {
        targetConsumption = consumptionStats.avgDaily * (daytimeConsumption / 100);
    }
    const realWorldLosses = 0.90;
    const systemSize = (targetConsumption / (peakSunHours * (systemEfficiency / 100)));
    const panelCount = Math.ceil((systemSize * 1000) / panelWattage);
    const actualSystemSize = (panelCount * panelWattage) / 1000;
    const spaceRequired = panelCount * 2.1;
    const rawProduction = actualSystemSize * peakSunHours * 365;
    const adjustedEfficiency = showIdealOutput ? 1 : systemEfficiency / 100;
    const adjustedLosses = showIdealOutput ? 1 : realWorldLosses;
    const annualProduction = rawProduction * adjustedEfficiency * adjustedLosses;
    return { 
        systemSize: Math.round(actualSystemSize * 10) / 10, 
        panelCount, 
        spaceRequired: Math.round(spaceRequired), 
        annualProduction: Math.round(annualProduction), 
        actualSystemSize 
    };
  }, [consumptionStats, authority, batteryEnabled, daytimeConsumption, peakSunHours, systemEfficiency, panelWattage, showIdealOutput]);

  const unusedSolar = useMemo(() => {
    const unused = Math.max(0, systemMetrics.annualProduction - consumptionStats.totalAnnual);
    return Math.round(unused);
  }, [systemMetrics.annualProduction, consumptionStats.totalAnnual]);

  const systemRecommendation = useMemo<SystemRecommendation>(() => {
    const { actualSystemSize, annualProduction } = systemMetrics;
    const { avgMonthly, avgDaily } = consumptionStats;
    const inverterCapacity = Math.ceil(actualSystemSize * inverterRatio * 10) / 10;
    let batteryCapacity = 0;
    if (authority === 'FEWA' && batteryEnabled) {
        if (batteryMode === 'night') {
            const nightConsumption = avgDaily * (1 - daytimeConsumption / 100);
            batteryCapacity = Math.ceil(nightConsumption / (batteryEfficiency * usableDoD));
        } else if (batteryMode === 'unused') {
            batteryCapacity = Math.ceil((unusedSolar / 365) / (batteryEfficiency * usableDoD));
        }
    }
    const monthlyProduction = annualProduction / 12;
    const summerCoverage = seasonalAnalysis.summerAvg > 0 ? (monthlyProduction / seasonalAnalysis.summerAvg) * 100 : 100;
    const winterCoverage = seasonalAnalysis.winterAvg > 0 ? (monthlyProduction / seasonalAnalysis.winterAvg) * 100 : 100;
    const annualCoverage = avgMonthly > 0 ? (annualProduction / (avgMonthly * 12)) * 100 : 100;
    return {
        ...systemMetrics,
        inverterCapacity,
        batteryCapacity,
        summerCoverage: Math.min(Math.round(summerCoverage), 100),
        winterCoverage: Math.min(Math.round(winterCoverage), 100),
        annualCoverage: Math.min(Math.round(annualCoverage), 100),
        dailyAvgConsumption: Math.round(avgDaily),
    };
  }, [systemMetrics, consumptionStats, seasonalAnalysis, authority, batteryEnabled, batteryMode, daytimeConsumption, batteryEfficiency, usableDoD, inverterRatio, unusedSolar]);

  const calculateBillAmountWithEscalation = useCallback((consumption: number, year: number, escRate: number): number => {
    if (consumption <= 0) return 0;
    const escalationFactor = Math.pow(1 + escRate, year - 1);
    if (rateStructure === 'flat') return consumption * (electricityRate * escalationFactor);
    let totalAmount = 0;
    let remainingConsumption = consumption;
    for (const tier of tiers) {
        if (remainingConsumption <= 0) break;
        const tierStart = tier.from > 0 ? tier.from - 1 : 0;
        const tierConsumption = tier.to === Infinity ? remainingConsumption : Math.min(remainingConsumption, tier.to - tierStart);
        totalAmount += Math.max(0, tierConsumption) * (tier.rate * escalationFactor);
        remainingConsumption -= tierConsumption;
    }
    return totalAmount;
  }, [rateStructure, electricityRate, tiers]);

  const monthlyProductionMap = useMemo(() => {
    const { annualProduction } = systemRecommendation;
    if (annualProduction === 0) return months.reduce((acc, month) => ({ ...acc, [month]: 0 }), {});
    
    const seasonalFactors = CITY_SEASONAL_FACTORS[city];
    const totalFactor = months.reduce((sum, m) => sum + seasonalFactors[m], 0);
    return months.reduce((acc, month) => {
      const factor = seasonalFactors[month];
      acc[month] = (annualProduction * (factor / totalFactor));
      return acc;
    }, {} as { [key: string]: number });
  }, [systemRecommendation.annualProduction, city]);

  useEffect(() => {
    if (!systemCost || bills.length === 0 || systemRecommendation.annualProduction === 0) {
      setFinancialAnalysis({ annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0, roiPercentage: 0 });
      return;
    }

    const SYSTEM_LIFESPAN_YEARS = 25;
    const initialInvestment = parseFloat(systemCost);
    const maintenanceCostPerYear = initialInvestment * 0.01;
    const avgMonthlyConsumption = bills.reduce((sum, bill) => sum + bill.consumption, 0) / bills.length;
    const consumptionByMonth = months.reduce((acc, month) => {
        acc[month] = bills.find(b => b.month === month)?.consumption || avgMonthlyConsumption;
        return acc;
    }, {} as {[key: string]: number});

    let cumulativeCashFlow = -initialInvestment, paybackPeriodYears = 0, firstYearAnnualSavings = 0, netMeteringCreditsKwh = 0;

    for (let year = 1; year <= SYSTEM_LIFESPAN_YEARS; year++) {
      let yearlySavings = 0;
      const degradationFactor = Math.pow(1 - degradationRate, year - 1);
      for (const monthName of months) {
          const monthlyConsumption = consumptionByMonth[monthName];
          const monthlyProduction = (monthlyProductionMap[monthName] || 0) * degradationFactor;
          const originalBill = calculateBillAmountWithEscalation(monthlyConsumption, year, escalationRate);
          let newBill = 0;
          let monthlyServiceChargeSavings = 0;

          if (authority === 'DEWA') {
              const netKwh = monthlyProduction - monthlyConsumption;
              if (netKwh >= 0) { 
                  netMeteringCreditsKwh += netKwh; 
                  newBill = 0; 
              } else {
                  const drawnFromCredits = Math.min(Math.abs(netKwh), netMeteringCreditsKwh);
                  netMeteringCreditsKwh -= drawnFromCredits;
                  newBill = calculateBillAmountWithEscalation(Math.abs(netKwh) - drawnFromCredits, year, escalationRate);
              }
          } else { // FEWA
              let savedKwh = 0;
              if (batteryEnabled) {
                  savedKwh = Math.min(monthlyProduction * batteryEfficiency, monthlyConsumption);
                  newBill = calculateBillAmountWithEscalation(monthlyConsumption - savedKwh, year, escalationRate);
              } else { // FEWA no battery
                  const daytimeLoadKwh = monthlyConsumption * (daytimeConsumption / 100);
                  savedKwh = Math.min(monthlyProduction, daytimeLoadKwh);
                  newBill = calculateBillAmountWithEscalation(monthlyConsumption - savedKwh, year, escalationRate);
              }
              // Add the 5 fils/kWh service charge saving for every self-consumed kWh
              monthlyServiceChargeSavings = savedKwh * 0.05;
          }
          yearlySavings += (originalBill - newBill) + monthlyServiceChargeSavings;
      }
      if (year === 1) firstYearAnnualSavings = yearlySavings;
      const yearlyCashFlow = yearlySavings - maintenanceCostPerYear;
      if (paybackPeriodYears === 0 && (cumulativeCashFlow + yearlyCashFlow) > 0) paybackPeriodYears = (year - 1) + (Math.abs(cumulativeCashFlow) / yearlyCashFlow);
      cumulativeCashFlow += yearlyCashFlow;
    }
    
    const totalAnnualConsumption = avgMonthlyConsumption * 12;
    const excessProduction = Math.max(0, systemRecommendation.annualProduction - totalAnnualConsumption);
    const netMeteringCreditsValue = excessProduction * getAverageRate(avgMonthlyConsumption);
    const netProfit = Math.round(cumulativeCashFlow + initialInvestment);
    const roiPercentage = initialInvestment > 0 ? (netProfit / initialInvestment) * 100 : 0;
    
    setFinancialAnalysis({ 
        annualSavings: Math.round(firstYearAnnualSavings), 
        paybackPeriod: paybackPeriodYears > 0 ? Math.round(paybackPeriodYears * 10) / 10 : 0, 
        roi25Year: netProfit, 
        netMeteringCredits: Math.round(netMeteringCreditsValue),
        roiPercentage: Math.round(roiPercentage)
    });
  }, [systemCost, bills, systemRecommendation.annualProduction, authority, batteryEnabled, daytimeConsumption, getAverageRate, calculateBillAmountWithEscalation, monthlyProductionMap, degradationRate, escalationRate, batteryEfficiency]);

  const generateMonthlyData = () => months.map(month => ({ 
      month: month.substring(0, 3), 
      consumption: bills.find(b => b.month === month)?.consumption || 0, 
      production: Math.round(monthlyProductionMap[month] || 0) 
  }));
  
  const copyReport = () => {
    const reportData = { projectName: projectName || 'Solar Project', location, authority, batteryEnabled, seasonalAnalysis, systemRecommendation, financialAnalysis, systemCost };
    const totalAnnualConsumption = consumptionStats.totalAnnual;
    const annualProduction = reportData.systemRecommendation.annualProduction;
    const coveragePercent = totalAnnualConsumption > 0 ? (annualProduction / totalAnnualConsumption) * 100 : 0;
    const roi25Year = reportData.financialAnalysis.roi25Year;
    const cost = parseFloat(reportData.systemCost);
    const roiPercent = cost > 0 ? (roi25Year / cost) * 100 : 0;

    let summary = `SOLAR OASIS - PROJECT REPORT
============================
Project: ${reportData.projectName}
Location: ${reportData.location}
Authority: ${reportData.authority}
Date: ${new Date().toLocaleDateString()}

CONSUMPTION ANALYSIS
--------------------
Annual Consumption: ${totalAnnualConsumption.toLocaleString()} kWh
Summer Average: ${reportData.seasonalAnalysis.summerAvg} kWh/month
Winter Average: ${reportData.seasonalAnalysis.winterAvg} kWh/month
Summer Spike: ${reportData.seasonalAnalysis.spikePercentage}%

RECOMMENDED SYSTEM
------------------
System Size: ${reportData.systemRecommendation.systemSize} kWp
Number of Panels: ${reportData.systemRecommendation.panelCount} × ${panelWattage}W
Annual Production: ${reportData.systemRecommendation.annualProduction.toLocaleString()} kWh
Coverage: ${coveragePercent.toFixed(1)}%
${reportData.batteryEnabled ? `Battery Capacity: ${reportData.systemRecommendation.batteryCapacity} kWh` : ''}

FINANCIAL ANALYSIS
------------------
System Cost: AED ${cost.toLocaleString()}
First-Year Savings: AED ${reportData.financialAnalysis.annualSavings.toLocaleString()}
Payback Period: ${reportData.financialAnalysis.paybackPeriod} years
25-Year Net Profit: AED ${reportData.financialAnalysis.roi25Year.toLocaleString()}
25-Year ROI: ${roiPercent.toFixed(0)}%`.trim();
    
    const footnotes = [];
    
    footnotes.push(`Financials include ${(degradationRate * 100).toFixed(1)}% annual degradation and 1% annual maintenance.`);

    if (coveragePercent < 80 && coveragePercent > 0) {
        footnotes.push(`To increase coverage, adding battery storage or utilizing more roof space may be required.`);
    }

    if (showIdealOutput) {
        footnotes.push("Values assume ideal conditions with no system losses. Actual output may vary.");
    }

    if (footnotes.length > 0) {
        summary += `\n\n----------------------------\nNotes:\n- ${footnotes.join('\n- ')}`;
    }

    navigator.clipboard.writeText(summary).then(() => alert('Report copied to clipboard!'));
  };

  const saveProject = () => {
    const projectData = { 
        projectName, location, city, authority, batteryEnabled, bills, 
        rateStructure, electricityRate, tiers, daytimeConsumption, 
        availableSpace, peakSunHours, systemEfficiency, panelWattage, 
        systemCost, degradationRate, escalationRate, batteryEfficiency, usableDoD,
        inverterRatio, batteryMode
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const linkElement = document.createElement('a');
    linkElement.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    linkElement.download = `${projectName.replace(/\s/g, '_') || 'solar_project'}_${new Date().toISOString().split('T')[0]}.json`;
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <Card title="Project Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Villa Solar Project" />
            <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <Select value={city} onChange={(e) => setCity(e.target.value)}>
                {['Dubai', 'Ajman', 'Sharjah', 'Abu Dhabi', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'].map(cityOption => (
                  <option key={cityOption} value={cityOption}>{cityOption}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authority</label>
              <div className="flex gap-2">
                {['DEWA', 'FEWA'].map(auth => (
                  <Button key={auth} onClick={() => { setAuthority(auth); if (auth === 'DEWA') setBatteryEnabled(false); }} variant={authority === auth ? 'primary' : 'ghost'} className="w-full">{auth}</Button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Battery Storage</label>
              <Button onClick={() => setBatteryEnabled(!batteryEnabled)} disabled={authority === 'DEWA'} variant={batteryEnabled ? 'secondary' : 'ghost'} className="w-full"><Battery className="w-4 h-4 mr-2" />{batteryEnabled ? 'Enabled' : 'Disabled'}</Button>
              {batteryEnabled && authority === 'FEWA' && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Battery Usage Mode</label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setBatteryMode('night')} variant={batteryMode === 'night' ? 'secondary' : 'ghost'} className="w-full text-xs">Nighttime Backup</Button>
                    <Button size="sm" onClick={() => setBatteryMode('unused')} variant={batteryMode === 'unused' ? 'secondary' : 'ghost'} className="w-full text-xs">Store Unused</Button>
                  </div>
                </div>
              )}
            </div>
        </div>
      </Card>
      
      <Card title="Electricity Bill Analysis">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="bill-input" className="block text-sm font-medium text-gray-700 mb-1">Quick Bill Entry</label>
            <textarea id="bill-input" value={billInput} onChange={(e) => setBillInput(e.target.value)} onKeyPress={handleBillInputKeyPress}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm h-28"
              placeholder="Enter bills like:&#10;Jan-2000&#10;Feb-2100&#10;Or comma-separated: Mar-1950, Apr-1980" />
            <Button onClick={addBills} className="mt-2 w-full" variant="secondary">Add Bills</Button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Structure</label>
            <div className="flex gap-2 mb-2"><Button onClick={() => setRateStructure('flat')} variant={rateStructure === 'flat' ? 'primary': 'ghost'} className="w-1/2">Flat</Button><Button onClick={() => setRateStructure('tiered')} variant={rateStructure === 'tiered' ? 'primary': 'ghost'} className="w-1/2">Tiered</Button></div>
            {rateStructure === 'flat' ? (
              <Input label="Rate (AED/kWh)" type="number" value={electricityRate} onChange={(e) => setElectricityRate(parseFloat(e.target.value) || 0)} step="0.01" />
            ) : (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-medium text-gray-700">Rate Tiers</h3><Button onClick={addTier} size="sm" variant="ghost" aria-label="Add Tier"><PlusCircle size={16} /></Button></div>
                <div className="space-y-2">
                  {tiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-1 text-xs">
                      <Input type="number" value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} className="w-16" aria-label="Tier From" disabled={index === 0} />
                      <span>-</span>
                      <Input type="number" value={tier.to === Infinity ? '' : tier.to} onChange={(e) => updateTier(index, 'to', e.target.value)} className="w-16" placeholder={tier.to === Infinity ? '∞' : 'To'} aria-label="Tier To" disabled={index === tiers.length - 1} />
                      <Input type="number" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} className="w-16" step="0.01" placeholder="Rate" aria-label="Tier Rate"/>
                      <Button onClick={() => removeTier(index)} size="sm" variant="danger" aria-label="Remove Tier"><Trash2 size={14} /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {bills.length > 0 && (
          <div className="p-4 bg-white rounded-xl shadow-lg mt-6">
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 p-4 rounded-lg bg-brand-light">
              {Object.entries({ 
                  'Daily Avg': `${systemRecommendation.dailyAvgConsumption} kWh/day`,
                  'Summer Avg': `${seasonalAnalysis.summerAvg} kWh/month`, 
                  'Winter Avg': `${seasonalAnalysis.winterAvg} kWh/month`, 
                  'Summer Spike': `${seasonalAnalysis.spikePercentage}%`, 
                  'Base Load': `${seasonalAnalysis.baseLoad} kWh`, 
                  'Cooling Load': `${seasonalAnalysis.coolingLoad} kWh` 
              }).map(([key, value]) => (
                <div key={key}>
                  <p className="text-sm text-brand-primary">{key}</p>
                  <p className={`text-xl font-semibold ${key === 'Summer Spike' ? 'text-amber-500' : 'text-brand-dark'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      <Card title="System Parameters">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
            {authority === 'FEWA' && !batteryEnabled && (
                <div className="flex items-end gap-1">
                    <Input label="Daytime Use (%)" type="number" value={daytimeConsumption} onChange={(e) => setDaytimeConsumption(parseInt(e.target.value) || 0)} min="0" max="100" />
                    <span title="This is the percentage of your daily energy used during sunlight hours. Only this portion benefits from solar if no battery is installed.">
                        <Info className="w-5 h-5 text-gray-400 cursor-help mb-2" />
                    </span>
                </div>
            )}
            {authority === 'FEWA' && batteryEnabled && (
              <>
                <Input label="Battery Efficiency (%)" type="number" value={batteryEfficiency * 100} onChange={(e) => setBatteryEfficiency(parseFloat(e.target.value) / 100 || 0)} min="0" max="100" />
                <Input label="Usable DoD (%)" type="number" value={usableDoD * 100} onChange={(e) => setUsableDoD(parseFloat(e.target.value) / 100 || 0)} min="0" max="100" />
              </>
            )}
            <Input label="Available Space (m²)" type="number" value={availableSpace} onChange={(e) => setAvailableSpace(parseFloat(e.target.value) || 0)} />
            <Input label="Peak Sun Hours" type="number" value={peakSunHours} onChange={(e) => setPeakSunHours(parseFloat(e.target.value) || 0)} step={0.1} />
            <Input label="System Efficiency (%)" type="number" value={systemEfficiency} onChange={(e) => setSystemEfficiency(parseFloat(e.target.value) || 0)} />
            <Input label="Panel Wattage (W)" type="number" value={panelWattage} onChange={(e) => setPanelWattage(parseFloat(e.target.value) || 0)} />
            <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inverter Sizing Ratio
                    <span className="text-gray-400 text-xs ml-1" title="Controls how much larger the inverter is compared to the PV array. Higher ratios reduce clipping risk, lower ratios save cost.">ℹ️</span>
                </label>
                <Select
                    value={inverterRatio}
                    onChange={(e) => setInverterRatio(parseFloat(e.target.value))}
                    className="w-full text-sm"
                >
                    <option value={0.85}>0.85 – Cost-focused residential</option>
                    <option value={1.0}>1.00 – Net metering (DEWA)</option>
                    <option value={1.05}>1.05 – Light oversize (buffering)</option>
                    <option value={1.1}>1.10 – Commercial rooftops</option>
                    <option value={1.15}>1.15 – Hybrid with battery</option>
                    <option value={1.2}>1.20 – Industrial/export systems</option>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                    {inverterRatio === 0.85 && 'Use for budget residential with minor clipping.'}
                    {inverterRatio === 1.0 && 'Ideal for DEWA and net metering setups.'}
                    {inverterRatio === 1.05 && 'Adds flexibility under cloud cover.'}
                    {inverterRatio === 1.1 && 'Common for commercial PV systems.'}
                    {inverterRatio === 1.15 && 'Supports hybrid inverters + battery.'}
                    {inverterRatio === 1.2 && 'Used for export-heavy or hybrid setups.'}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
            <input type="checkbox" id="ideal-output-toggle" checked={showIdealOutput} onChange={(e) => setShowIdealOutput(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
            <label htmlFor="ideal-output-toggle" className="text-sm text-gray-600">Show ideal system output (no efficiency or real-world losses)</label>
        </div>
      </Card>
      {bills.length > 0 && (
        <>
        <Card title="Recommended System">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg text-white bg-brand-primary"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemRecommendation.systemSize} kWp</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary"><p className="text-sm text-brand-primary">Number of Panels</p><p className="text-2xl font-bold text-brand-primary">{systemRecommendation.panelCount}</p></div>
            <div className="p-4 rounded-lg text-white bg-brand-primary"><p className="text-sm opacity-90">Space Required</p><p className="text-2xl font-bold">{systemRecommendation.spaceRequired} m²</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary"><p className="text-sm text-brand-primary">Annual Production</p><p className="text-2xl font-bold text-brand-primary">{systemRecommendation.annualProduction.toLocaleString()} kWh</p></div>
          </div>
          {unusedSolar > 0 && (
            <div className="text-sm text-amber-600 my-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              Estimated unused solar: <strong>{unusedSolar.toLocaleString()} kWh/year</strong>. This energy could be stored with a battery or exported.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6"><div className="text-center"><p className="text-sm text-gray-600">Inverter Capacity</p><p className="text-xl font-semibold text-brand-primary">{systemRecommendation.inverterCapacity} kW</p></div>{batteryEnabled && authority === 'FEWA' && (<div className="text-center"><p className="text-sm text-gray-600">Battery Capacity</p><p className="text-xl font-semibold text-brand-primary">{systemRecommendation.batteryCapacity} kWh</p></div>)}</div>
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
          <div className="mb-6"><Input label="System Cost (AED)" type="number" value={systemCost} onChange={(e) => setSystemCost(e.target.value)} className="max-w-xs" placeholder="e.g. 25000" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-2xl">
            <Input label="Panel Degradation (% per year)" type="number" value={degradationRate * 100} onChange={(e) => setDegradationRate(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
            <Input label="Price Escalation (% per year)" type="number" value={escalationRate * 100} onChange={(e) => setEscalationRate(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
          </div>

          {systemCost && (<>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-100 border border-green-200 p-4 rounded-lg"><p className="text-sm text-gray-600">First-Year Savings</p><p className="text-2xl font-bold text-green-700">AED {financialAnalysis.annualSavings.toLocaleString()}</p></div>
              <div className="bg-blue-100 border border-blue-200 p-4 rounded-lg"><p className="text-sm text-gray-600">Payback Period</p><p className="text-2xl font-bold text-blue-700">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} years` : 'N/A'}</p></div>
              <div className="bg-purple-100 border border-purple-200 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year Net Profit</p><p className="text-2xl font-bold text-purple-700">AED {financialAnalysis.roi25Year.toLocaleString()}</p></div>
              <div className="bg-amber-100 border border-amber-200 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year ROI</p><p className="text-2xl font-bold text-amber-700">{financialAnalysis.roiPercentage.toLocaleString()}%</p></div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3"><Info className="w-5 h-5 text-blue-600 mt-1 shrink-0"/><p className="text-sm text-blue-800"><strong>What is 25-Year Net Profit?</strong> This is your total estimated profit over 25 years after subtracting the system's initial cost and an estimated 1% annual maintenance fee. It accounts for panel degradation and grid electricity price increases.</p></div>
            {authority === 'DEWA' && financialAnalysis.netMeteringCredits > 0 && (<div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-sm"><p className="text-green-800">Your system is projected to generate <strong>AED {financialAnalysis.netMeteringCredits.toLocaleString()}</strong> in excess credits in the first year, which will roll over to offset future bills.</p></div>)}
            <div className="mt-6"><h3 className="text-lg font-semibold mb-3 text-brand-primary">Monthly Consumption vs. Production</h3><ResponsiveContainer width="100%" height={300}><BarChart data={generateMonthlyData()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="consumption" fill="#f87171" name="Consumption (kWh)" /><Bar dataKey="production" fill="#34d399" name="Production (kWh)" /></BarChart></ResponsiveContainer></div>
          </>)}
        </Card>
        <Card title="Export & Save">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={copyReport} disabled={!systemCost || bills.length === 0}><FileText className="w-5 h-5 mr-2" /> Copy Report</Button>
            <Button onClick={saveProject} disabled={!systemCost || bills.length === 0} variant="secondary"><Download className="w-5 h-5 mr-2" /> Save Project</Button>
          </div>
        </Card>
        </>
      )}
    </div>
  );
};

export default CalculatorPage;
