
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { Sun, Battery, TrendingUp, FileText, AlertCircle, Trash2, PlusCircle, Download, XCircle, Wand2, Info, Upload, ChevronsDown, ChevronsUp, Leaf, Car, TreePine, Printer, Copy, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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

const months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];

const CO2_SAVED_PER_KWH = 0.82; // kg
const CO2_PER_TREE_YEAR = 21; // kg
const CO2_PER_CAR_YEAR_TONS = 4.6;

const CalculatorPage: React.FC = () => {
  // Project Configuration
  const [authority, setAuthority] = useState<string>('DEWA');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [city, setCity] = useState('Dubai');
  const [panelOrientation, setPanelOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Bill Inputs
  const [bills, setBills] = useState<Bill[]>([]);
  const [billInput, setBillInput] = useState<string>('');
  const [tiers, setTiers] = useState<Tier[]>([
    { from: 0, to: 2000, rate: 0.23 },
    { from: 2001, to: 4000, rate: 0.28 },
    { from: 4001, to: 6000, rate: 0.32 },
    { from: 6001, to: Infinity, rate: 0.38 }
  ]);
  const [pendingEstimates, setPendingEstimates] = useState<Bill[]>([]);
  const [estimationWarning, setEstimationWarning] = useState('');

  // System Parameters
  const [daytimeConsumption, setDaytimeConsumption] = useState<number>(55);
  const [availableSpace, setAvailableSpace] = useState<number>(100);
  const [peakSunHours, setPeakSunHours] = useState<number>(5.5);
  const [panelWattage, setPanelWattage] = useState<number>(610);
  const [systemEfficiencyInput, setSystemEfficiencyInput] = useState<number>(93);
  const [useBifacial, setUseBifacial] = useState(true);
  const [showIdealOutput, setShowIdealOutput] = useState(false);
  
  // Battery Parameters
  const [batteryEfficiency, setBatteryEfficiency] = useState(0.95);
  const [usableDoD, setUsableDoD] = useState(0.9);
  const [batteryMode, setBatteryMode] = useState<'night' | 'unused'>('night');

  // ROI Inputs
  const [systemCost, setSystemCost] = useState<string>('');
  const [degradationRate, setDegradationRate] = useState(0.007);
  const [escalationRate, setEscalationRate] = useState(0.025);
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState(0.06);
  
  // UI/Dev view state
  const [showDebug, setShowDebug] = useState(false);
  const [monthlySavings, setMonthlySavings] = useState<Record<string, number>>({});
  const [showVisualEquivalents, setShowVisualEquivalents] = useState(false);
  const [showLossBreakdown, setShowLossBreakdown] = useState(false);

  const defaultTiers = useMemo(() => ({
    'DEWA': [
        { from: 0, to: 2000, rate: 0.23 },
        { from: 2001, to: 4000, rate: 0.28 },
        { from: 4001, to: 6000, rate: 0.32 },
        { from: 6001, to: Infinity, rate: 0.38 }
    ],
    'EtihadWE': [
        { from: 0, to: 2000, rate: 0.23 },
        { from: 2001, to: 4000, rate: 0.28 },
        { from: 4001, to: 6000, rate: 0.32 },
        { from: 6001, to: Infinity, rate: 0.38 }
    ]
  }), []);

  useEffect(() => {
    if (tiers.length === 0) {
        setTiers(defaultTiers[authority as keyof typeof defaultTiers] || defaultTiers['DEWA']);
    }
  }, [tiers, authority, defaultTiers]);

  useEffect(() => {
    if (authority === 'DEWA') {
        setFuelSurchargeRate(0.06);
        setTiers(defaultTiers.DEWA);
    } else if (authority === 'EtihadWE') {
        setFuelSurchargeRate(0.05);
        setTiers(defaultTiers.EtihadWE);
    }
  }, [authority, defaultTiers]);

  const idealBatteryEfficiency = showIdealOutput ? 1 : batteryEfficiency;
  const idealUsableDoD = showIdealOutput ? 1 : usableDoD;
  const systemEfficiency = showIdealOutput ? 1 : (systemEfficiencyInput / 100);

  const calculateBillAmount = useCallback((consumption: number, currentTiers: Tier[]): number => {
    if (consumption <= 0) return 0;
    let totalAmount = 0;
    let remainingConsumption = consumption;
    for (const tier of currentTiers) {
        if (remainingConsumption <= 0) break;
        const tierStart = tier.from > 0 ? tier.from - 1 : 0;
        const tierConsumption = tier.to === Infinity ? remainingConsumption : Math.min(remainingConsumption, tier.to - tierStart);
        totalAmount += Math.max(0, tierConsumption) * tier.rate;
        remainingConsumption -= tierConsumption;
    }
    return totalAmount;
  }, []);

  const addTier = () => {
    if (tiers.length === 0) {
        setTiers([{from: 0, to: Infinity, rate: 0.23}]);
        return;
    }
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
    
    if (field === 'to' && index < tiers.length - 1) {
      newTiers[index + 1].from = numValue + 1;
    }
    (newTiers[index] as any)[field] = numValue;
    setTiers(newTiers);
  };
  
  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      const newTiers = tiers.filter((_, i) => i !== index);
      if(newTiers.length > 0 && index > 0 && newTiers[index-1]) {
        newTiers[index-1].to = Infinity;
      }
      setTiers(newTiers);
    } else {
        setTiers([]); // Allow clearing all tiers
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
            newBills.push({
              month,
              consumption,
              amount: calculateBillAmount(consumption, tiers),
              isEstimated: false
            });
            existingMonths.add(month);
          }
        }
      }
    });
    return newBills;
  }, [calculateBillAmount, bills, months, tiers]);

  const addBills = useCallback(() => {
    const newBills = parseBillInput(billInput);
    if (newBills.length > 0) {
      setBills(prevBills => [...prevBills, ...newBills].filter((bill, index, self) => 
        index === self.findIndex((b) => b.month === bill.month)
      ).sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month)));
      setBillInput('');
    }
  }, [billInput, parseBillInput, months]);

  const handleBillInputKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBills();
    }
  };

  const handleEstimateFromPartialData = useCallback(() => {
    if (bills.length === 0 || bills.length >= 12) return;
    
    const hasSummerBill = bills.some(b => ['May', 'June', 'July', 'August', 'September'].includes(b.month));
    if (!hasSummerBill) {
        setEstimationWarning('⚠️ This estimate may be low — please include at least one summer bill for accuracy.');
    } else {
        setEstimationWarning('');
    }

    const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];

    const totalBaseConsumption = bills.reduce((sum, bill) => {
      return sum + (bill.consumption / cityFactors[bill.month]);
    }, 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;

    const userProvidedMonths = new Set(bills.map(b => b.month));

    const estimatedBills = months
      .filter(month => !userProvidedMonths.has(month))
      .map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * cityFactors[month]);
        return {
          month,
          consumption: estimatedConsumption,
          amount: calculateBillAmount(estimatedConsumption, tiers),
          isEstimated: true,
        };
      });

    setPendingEstimates(estimatedBills);
  }, [bills, city, tiers, calculateBillAmount]);

  const consumptionStats = useMemo(() => {
    if (bills.length === 0) return { summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0, annualConsumption: 0, dailyAvg: 0, monthlyAvg: 0 };

    const annualConsumption = bills.reduce((sum, b) => sum + b.consumption, 0);
    const summerMonths = ['May', 'June', 'July', 'August', 'September'];
    const winterBills = bills.filter(bill => !summerMonths.includes(bill.month));
    const summerBills = bills.filter(bill => summerMonths.includes(bill.month));
    
    const summerAvg = summerBills.length > 0 ? summerBills.reduce((sum, bill) => sum + bill.consumption, 0) / summerBills.length : 0;
    const winterAvg = winterBills.length > 0 ? winterBills.reduce((sum, bill) => sum + bill.consumption, 0) / winterBills.length : 0;
    const spikePercentage = winterAvg > 0 ? ((summerAvg - winterAvg) / winterAvg) * 100 : 0;
    
    return {
        annualConsumption,
        dailyAvg: annualConsumption / 365,
        monthlyAvg: annualConsumption / 12,
        summerAvg: Math.round(summerAvg),
        winterAvg: Math.round(winterAvg),
        spikePercentage: Math.round(spikePercentage),
        baseLoad: Math.round(winterAvg),
        coolingLoad: Math.round(summerAvg - winterAvg)
    };
  }, [bills]);

    const systemMetrics = useMemo(() => {
    if (consumptionStats.annualConsumption === 0) return { systemSize: 0, panelCount: 0, inverterCapacity: 0, spaceRequired: 0, annualProduction: 0, adjustedProduction: 0 };
    
    let requiredAnnualProduction = consumptionStats.annualConsumption;
    if (authority === 'EtihadWE') {
        requiredAnnualProduction *= (daytimeConsumption / 100);
    }
    
    const rawSystemSize = requiredAnnualProduction / (peakSunHours * 365 * systemEfficiency * (useBifacial ? 1.07 : 1));
    const panelCount = Math.ceil((rawSystemSize * 1000) / panelWattage);
    const actualSystemSize = (panelCount * panelWattage) / 1000;
    
    const inverterCapacity = Math.ceil(actualSystemSize * 1.1 * 10) / 10;
    
    // Panel dimensions approx 2.172m x 1.134m
    const panelArea = panelOrientation === 'portrait' ? (2.172 * 1.134) : (1.134 * 2.172);
    const spaceRequired = panelCount * panelArea * 1.2; // Add 20% for spacing

    const annualProduction = actualSystemSize * peakSunHours * 365;
    let adjustedProduction = annualProduction * systemEfficiency;
    if (useBifacial) {
      adjustedProduction *= 1.07;
    }

    return {
        systemSize: Math.round(actualSystemSize * 10) / 10,
        panelCount,
        inverterCapacity,
        spaceRequired,
        annualProduction,
        adjustedProduction: Math.round(adjustedProduction),
    };
  }, [consumptionStats.annualConsumption, authority, daytimeConsumption, peakSunHours, systemEfficiency, useBifacial, panelWattage, panelOrientation]);


  const financialAnalysis = useMemo(() => {
    if (!systemCost || bills.length === 0 || systemMetrics.adjustedProduction === 0) {
      return { annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0, totalValue: 0, roiPercentage: 0, firstYearFuelSavings: 0 };
    }
    
    const initialInvestment = parseFloat(systemCost);
    const maintenanceCostPerYear = initialInvestment * 0.01;
    let paybackPeriodYears:number = 0;
    let cumulativeCashFlow = -initialInvestment;
    let firstYearAnnualSavings = 0;
    let firstYearFuelSavings = 0;
    let firstYearNetMeterCreditValue = 0;
    
    const monthlyProductionMap = months.reduce((acc, month) => {
        const factor = (CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'])[month];
        const totalFactor = Object.values(CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai']).reduce((s, f) => s + f, 0);
        acc[month] = (systemMetrics.adjustedProduction * (factor / totalFactor));
        return acc;
    }, {} as Record<string, number>);

    const monthlySavingsMap: Record<string, number> = {};

    for (let year = 1; year <= 25; year++) {
      let yearlySavings = 0;
      let yearlyFuelSavings = 0;
      let yearlyNetMeterCredits = 0;
      const degradationFactor = Math.pow(1 - degradationRate, year - 1);
      const escalationFactor = Math.pow(1 + escalationRate, year - 1);
      
      const escalatedTiers = tiers.map(t => ({...t, rate: t.rate * escalationFactor }));
      const escalatedFuelSurcharge = fuelSurchargeRate * escalationFactor;

      for (const month of months) {
        const monthlyConsumption = bills.find(b => b.month === month)?.consumption || consumptionStats.monthlyAvg;
        const monthlyProduction = (monthlyProductionMap[month] || 0) * degradationFactor;
        
        const originalBillOnTiers = calculateBillAmount(monthlyConsumption, escalatedTiers);
        const originalFuelSurcharge = monthlyConsumption * escalatedFuelSurcharge;
        const originalTotalBill = originalBillOnTiers + originalFuelSurcharge;

        let gridImport = 0;
        let newBillOnTiers = 0;
        let monthFuelSavings = 0;
        let monthNetMeterCredit = 0;
        
        const selfConsumedSolar = Math.min(monthlyProduction, monthlyConsumption);

        if (authority === 'DEWA') {
            gridImport = Math.max(0, monthlyConsumption - monthlyProduction);
            const gridExport = Math.max(0, monthlyProduction - monthlyConsumption);
            
            newBillOnTiers = calculateBillAmount(gridImport, escalatedTiers);
            monthNetMeterCredit = calculateBillAmount(gridExport, escalatedTiers); // Use same tiers for export credit
            
            monthFuelSavings = selfConsumedSolar * escalatedFuelSurcharge;

            yearlyNetMeterCredits += monthNetMeterCredit;
        } else { // EtihadWE
            const daytimeKwh = monthlyConsumption * (daytimeConsumption / 100);
            const solarUsedForDaytime = Math.min(monthlyProduction, daytimeKwh);
            gridImport = monthlyConsumption - solarUsedForDaytime;
            newBillOnTiers = calculateBillAmount(gridImport, escalatedTiers);
            monthFuelSavings = solarUsedForDaytime * escalatedFuelSurcharge;
        }

        const newTotalBill = newBillOnTiers + (gridImport * escalatedFuelSurcharge);
        const monthSavings = originalTotalBill - newTotalBill;

        yearlySavings += monthSavings;
        yearlyFuelSavings += monthFuelSavings;

        if (year === 1) {
            monthlySavingsMap[month] = monthSavings;
        }
      }

      if (year === 1) {
          firstYearAnnualSavings = yearlySavings;
          firstYearFuelSavings = yearlyFuelSavings;
          firstYearNetMeterCreditValue = yearlyNetMeterCredits;
      }
      
      const yearlyCashFlow = yearlySavings - maintenanceCostPerYear;
      const prevCumulativeCashFlow = cumulativeCashFlow;
      cumulativeCashFlow += yearlyCashFlow;

      if (paybackPeriodYears === 0 && cumulativeCashFlow > 0) {
          const fractionOfYear = Math.abs(prevCumulativeCashFlow) / yearlyCashFlow;
          paybackPeriodYears = (year - 1) + fractionOfYear;
      }
    }
    
    useEffect(() => {
        setMonthlySavings(monthlySavingsMap);
    }, [JSON.stringify(monthlySavingsMap)]);

    const netProfit = cumulativeCashFlow;
    const totalValue = netProfit + initialInvestment;
    const roiPercentage = initialInvestment > 0 ? (netProfit / initialInvestment) * 100 : 0;
    
    return {
      annualSavings: Math.round(firstYearAnnualSavings),
      paybackPeriod: paybackPeriodYears > 0 ? Math.round(paybackPeriodYears * 10) / 10 : 0,
      roi25Year: Math.round(netProfit),
      netMeteringCredits: Math.round(firstYearNetMeterCreditValue),
      totalValue: Math.round(totalValue),
      roiPercentage: Math.round(roiPercentage),
      firstYearFuelSavings: Math.round(firstYearFuelSavings)
    };
  }, [systemCost, bills, systemMetrics.adjustedProduction, authority, daytimeConsumption, degradationRate, escalationRate, tiers, city, fuelSurchargeRate, consumptionStats.monthlyAvg, calculateBillAmount]);


  const unusedSolar = useMemo(() => {
    if (authority === 'DEWA' || bills.length === 0) return 0;
    const usedSolar = consumptionStats.annualConsumption * (daytimeConsumption / 100);
    return Math.max(0, Math.round(systemMetrics.adjustedProduction - usedSolar));
  }, [authority, bills, systemMetrics.adjustedProduction, consumptionStats.annualConsumption, daytimeConsumption]);


  const batteryCapacity = useMemo(() => {
    if (!batteryEnabled) return 0;

    const dailyAvgConsumption = consumptionStats.dailyAvg;
    if (batteryMode === 'night') {
        const nightConsumption = dailyAvgConsumption * (1 - daytimeConsumption / 100);
        return Math.ceil(nightConsumption / (idealBatteryEfficiency * idealUsableDoD));
    } else { // 'unused' mode
        const dailyUnused = unusedSolar / 365;
        return Math.ceil(dailyUnused / (idealBatteryEfficiency * idealUsableDoD));
    }
  }, [batteryEnabled, batteryMode, consumptionStats.dailyAvg, daytimeConsumption, unusedSolar, idealBatteryEfficiency, idealUsableDoD]);

  const chartData = useMemo(() => {
    const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
    const totalFactor = Object.values(cityFactors).reduce((s, f) => s + f, 0);

    return months.map(month => {
      const consumption = bills.find(b => b.month === month)?.consumption || consumptionStats.monthlyAvg;
      const production = systemMetrics.adjustedProduction * (cityFactors[month] / totalFactor);
      const gridConsumption = Math.max(0, consumption - production);
      
      return {
        month: month.substring(0, 3), 
        "Solar Production": Math.round(production),
        "Grid Consumption": Math.round(gridConsumption),
        "Savings": Math.round(monthlySavings[month] || 0)
      };
    });
  }, [bills, city, consumptionStats.monthlyAvg, systemMetrics.adjustedProduction, monthlySavings]);

  const copyReport = () => {
    const reportData = { 
        projectName: projectName || 'Solar Project', 
        city, authority,
        systemSize: systemMetrics.systemSize,
        panelCount: systemMetrics.panelCount,
        panelWattage,
        inverterCapacity: systemMetrics.inverterCapacity,
        annualProduction: systemMetrics.adjustedProduction,
        annualConsumption: consumptionStats.annualConsumption,
        systemCost,
        annualSavings: financialAnalysis.annualSavings,
        paybackPeriod: financialAnalysis.paybackPeriod,
        roi25Year: financialAnalysis.roi25Year,
        totalValue: financialAnalysis.totalValue,
        roiPercentage: financialAnalysis.roiPercentage,
        degradationRate,
        escalationRate,
        systemEfficiency: systemEfficiency * 100,
        useBifacial,
        co2Saved: systemMetrics.adjustedProduction * CO2_SAVED_PER_KWH,
    };
    
    const coveragePercent = reportData.annualConsumption > 0 ? (reportData.annualProduction / reportData.annualConsumption) * 100 : 0;
    const solarToGrid = Math.max(0, Math.round(reportData.annualProduction - (reportData.annualConsumption * (daytimeConsumption/100)) ));
    const gridToHome = Math.max(0, Math.round(reportData.annualConsumption - (reportData.annualProduction - solarToGrid)));

    let notes = `\n\nNotes:\n- Financials assume an annual electricity price escalation of ${(reportData.escalationRate * 100).toFixed(1)}% and panel degradation of ${(reportData.degradationRate * 100).toFixed(1)}%.`;
    notes += `\n- System losses estimated at ${(100 - reportData.systemEfficiency).toFixed(0)}% based on premium components and UAE field conditions.`;
    if(reportData.useBifacial) notes += `\n- Includes a 7% generation boost for bifacial panel reflectivity.`;

    const summary = `
SOLAR OASIS - PROJECT REPORT
============================
Project: ${reportData.projectName}
Location: ${reportData.city}
Authority: ${reportData.authority}
Date: ${new Date().toLocaleDateString()}

RECOMMENDED SYSTEM
------------------
System Size: ${reportData.systemSize} kWp
Inverter Size: ${reportData.inverterCapacity} kW
Number of Panels: ${reportData.panelCount} × ${reportData.panelWattage}W
Est. Annual Production: ${reportData.annualProduction.toLocaleString()} kWh

CONSUMPTION & COVERAGE
----------------------
Annual Consumption: ${Math.round(reportData.annualConsumption).toLocaleString()} kWh
Solar Coverage: ${coveragePercent.toFixed(1)}%
Covered by Solar: ${Math.round(reportData.annualProduction - solarToGrid).toLocaleString()} kWh
Remaining from Grid: ${gridToHome.toLocaleString()} kWh

FINANCIAL ANALYSIS
------------------
System Cost: AED ${parseInt(reportData.systemCost || "0").toLocaleString()}
First-Year Savings: AED ${reportData.annualSavings.toLocaleString()}
Payback Period: ${reportData.paybackPeriod} years
25-Year Net Profit: AED ${reportData.roi25Year.toLocaleString()}
25-Year Total Value: AED ${reportData.totalValue.toLocaleString()}
Return on Investment (ROI): ${reportData.roiPercentage}%

ENVIRONMENTAL IMPACT
--------------------
CO₂ Saved Annually: ${Math.round(reportData.co2Saved).toLocaleString()} kg
Equivalent to planting ${Math.round(reportData.co2Saved / CO2_PER_TREE_YEAR)} trees or removing the annual emissions of ${((reportData.co2Saved/1000)/CO2_PER_CAR_YEAR_TONS).toFixed(1)} cars.
${notes}
    `.trim();
    navigator.clipboard.writeText(summary).then(() => alert('Report copied to clipboard!'));
  };

  const handleExportPdf = async () => {
    const reportElement = document.getElementById('report-container');
    if (reportElement) {
        const canvas = await html2canvas(reportElement, { scale: 2 });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${projectName || 'solar_report'}.pdf`);
    }
  };

  const saveProject = () => {
    const projectData = { 
        projectName, city, authority, batteryEnabled, bills, tiers, daytimeConsumption, availableSpace, peakSunHours, 
        panelWattage, systemEfficiencyInput, useBifacial, showIdealOutput, batteryEfficiency, usableDoD, 
        batteryMode, systemCost, degradationRate, escalationRate, fuelSurchargeRate, panelOrientation
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${projectName.replace(/\s/g, '_') || 'solar_project'}_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          // Load into state
          setProjectName(data.projectName || '');
          setCity(data.city || 'Dubai');
          setAuthority(data.authority || 'DEWA');
          setBatteryEnabled(data.batteryEnabled || false);
          setBills(data.bills || []);
          setTiers(data.tiers || defaultTiers.DEWA);
          setDaytimeConsumption(data.daytimeConsumption || 55);
          setAvailableSpace(data.availableSpace || 100);
          setPeakSunHours(data.peakSunHours || 5.5);
          setPanelWattage(data.panelWattage || 610);
          setSystemEfficiencyInput(data.systemEfficiencyInput || 93);
          setUseBifacial(data.useBifacial === undefined ? true : data.useBifacial);
          setShowIdealOutput(data.showIdealOutput || false);
          setBatteryEfficiency(data.batteryEfficiency || 0.95);
          setUsableDoD(data.usableDoD || 0.9);
          setBatteryMode(data.batteryMode || 'night');
          setSystemCost(data.systemCost || '');
          setDegradationRate(data.degradationRate || 0.007);
          setEscalationRate(data.escalationRate || 0.025);
          setFuelSurchargeRate(data.fuelSurchargeRate || 0.06);
          setPanelOrientation(data.panelOrientation || 'portrait');
          alert("Project imported successfully!");
        } catch (err) {
          alert('Failed to import project. Please check the file format.');
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset file input
  };
  
  const productionBoost = useMemo(() => {
    const baseProduction = systemMetrics.annualProduction * (systemEfficiencyInput/100);
    if (baseProduction === 0) return 0;
    return ((systemMetrics.adjustedProduction / baseProduction - 1) * 100);
  }, [systemMetrics.annualProduction, systemMetrics.adjustedProduction, systemEfficiencyInput]);

    return (
    <div className="space-y-6">
      <Card title="Project Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Villa Solar Project" />
            <Select label="Emirate" value={city} onChange={(e) => setCity(e.target.value)}>
                {Object.keys(CITY_SEASONAL_FACTORS).map(cityOption => (
                  <option key={cityOption} value={cityOption}>{cityOption}</option>
                ))}
            </Select>
            <Select label="Authority" value={authority} onChange={(e) => setAuthority(e.target.value)}>
                <option value="DEWA">DEWA</option>
                <option value="EtihadWE">EtihadWE</option>
            </Select>
        </div>
      </Card>
      
      <div id="report-container" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              <Card title="Electricity Bill Analysis">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700">Quick Bill Entry</label>
                      <textarea value={billInput} onChange={(e) => setBillInput(e.target.value)} onKeyPress={handleBillInputKeyPress}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md h-28 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        placeholder="Enter bills like:&#10;Jan-2000&#10;Feb-2100&#10;Or: Mar-1950, Apr-1980" />
                      <Button onClick={addBills} className="mt-2 w-full">Add Bills</Button>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Rate Tiers (AED/kWh)</h3>
                          <div className="space-y-2">
                              {tiers.map((tier, index) => (
                                <div key={index} className="flex items-center gap-1 text-xs">
                                  <span className="w-16">kWh {tier.from} - {tier.to === Infinity ? '∞' : tier.to}</span>
                                  <Input type="number" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} className="w-20 px-1 py-1 border rounded" step="0.01" placeholder="Rate" />
                                  <Button onClick={() => removeTier(index)} variant="ghost" size="sm" className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></Button>
                                </div>
                              ))}
                          </div>
                          <Button onClick={addTier} size="sm" variant="ghost" className="mt-2"><PlusCircle size={16} className="mr-1"/>Add Tier</Button>
                           <div className="mt-4" title="Fuel surcharge applied per kWh imported from the grid.">
                              <Input label="Fuel Surcharge (AED/kWh)" type="number" step="0.001" value={fuelSurchargeRate} onChange={e => setFuelSurchargeRate(parseFloat(e.target.value) || 0)} />
                          </div>
                      </div>
                  </div>

                   {bills.length > 0 && (
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-md font-semibold text-gray-700">Added Bills ({bills.length})</h3>
                          <Button onClick={() => setBills([])} variant="ghost" size="sm" className="flex items-center gap-1 text-red-500 hover:text-red-700">
                              <XCircle size={16} /> Clear All
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {bills.map((bill, index) => (
                            <div key={index} className={`flex justify-between items-center p-2 rounded text-sm ${bill.isEstimated ? 'bg-blue-100' : 'bg-gray-100'}`} title={bill.isEstimated ? 'Estimated value' : 'User-provided value'}>
                              <span>{bill.month.substring(0,3)}: {bill.consumption}</span>
                              <div className="flex items-center">
                                  {bill.isEstimated && <Wand2 size={12} className="text-blue-500 mr-1" />}
                                  <Button onClick={() => setBills(prev => prev.filter((_, i) => i !== index))} variant="ghost" size="sm" className="text-red-500 hover:text-red-700 p-0 h-auto"><Trash2 size={14} /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {bills.length > 0 && bills.length < 12 && (
                          <div className="mt-4 text-center">
                              <Button onClick={handleEstimateFromPartialData} variant="secondary">
                                  <Wand2 size={16} className="mr-2"/> Estimate Full Year from {bills.length} Bill{bills.length > 1 ? 's' : ''}
                              </Button>
                          </div>
                        )}
                        {estimationWarning && <p className="text-center text-sm text-yellow-700 mt-2">{estimationWarning}</p>}
                      </div>
                    )}

                    {pendingEstimates.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-brand-primary mb-2">Estimated Months</h3>
                      <p className="text-sm mb-3">We’ve estimated the missing months. You can review and edit them before applying:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                        {pendingEstimates.map((bill, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-sm w-12">{bill.month}</span>
                            <Input
                              type="number"
                              value={bill.consumption}
                              onChange={(e) => {
                                const newEstimates = [...pendingEstimates];
                                newEstimates[index].consumption = parseFloat(e.target.value) || 0;
                                newEstimates[index].amount = calculateBillAmount(newEstimates[index].consumption, tiers);
                                setPendingEstimates(newEstimates);
                              }}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4">
                        <Button onClick={() => {
                          setBills(prev => [...prev, ...pendingEstimates].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month)));
                          setPendingEstimates([]);
                        }}>Apply Estimates</Button>
                        <Button onClick={() => setPendingEstimates([])} variant="ghost">Cancel</Button>
                      </div>
                    </div>
                  )}
                  {bills.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 p-4 rounded-lg bg-gray-50">
                          <div><p className="text-sm text-gray-600">Avg Daily Usage</p><p className="text-lg font-semibold text-brand-primary">{consumptionStats.dailyAvg.toFixed(1)} kWh</p></div>
                          <div><p className="text-sm text-gray-600">Avg Monthly Usage</p><p className="text-lg font-semibold text-brand-primary">{consumptionStats.monthlyAvg.toFixed(0).toLocaleString()} kWh</p></div>
                          <div><p className="text-sm text-gray-600">Total Annual Usage</p><p className="text-lg font-semibold text-brand-primary">{consumptionStats.annualConsumption.toFixed(0).toLocaleString()} kWh</p></div>
                          <div className="col-span-full border-t my-2"></div>
                          <div><p className="text-sm text-gray-600">Summer Avg</p><p className="text-lg font-semibold text-brand-primary">{consumptionStats.summerAvg.toLocaleString()} kWh</p></div>
                          <div><p className="text-sm text-gray-600">Winter Avg</p><p className="text-lg font-semibold text-brand-primary">{consumptionStats.winterAvg.toLocaleString()} kWh</p></div>
                          <div><p className="text-sm text-gray-600">Summer Spike</p><p className="text-lg font-semibold text-brand-primary">{consumptionStats.spikePercentage.toFixed(0)}%</p></div>
                      </div>
                   )}
              </Card>
              <Card title="Monthly Consumption, Production & Savings">
                  <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'AED', angle: 90, position: 'insideRight' }}/>
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="Grid Consumption" fill="#ef4444" stackId="a" />
                        <Bar yAxisId="left" dataKey="Solar Production" fill="#10b981" stackId="a" />
                        <Bar yAxisId="right" dataKey="Savings" fill="#8884d8" />
                      </BarChart>
                  </ResponsiveContainer>
              </Card>
          </div>
          <div className="lg:col-span-1 space-y-6">
              <Card title="System Parameters">
                  <div className="space-y-4">
                      {authority === 'EtihadWE' && (
                          <div title="This is the estimated percentage of your total electricity that happens during daylight hours — usually around 55% in UAE villas. You can override it if you have a custom load profile.">
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                  Daytime Usage Offset (%)
                                  <Info size={14} className="ml-1 text-gray-400 cursor-help" />
                              </label>
                              <Input type="number" value={daytimeConsumption} onChange={(e) => setDaytimeConsumption(parseInt(e.target.value))} min="0" max="100" />
                          </div>
                      )}
                      <Input label="Available Space (m²)" type="number" value={availableSpace} onChange={(e) => setAvailableSpace(parseFloat(e.target.value) || 0)} />
                      <Input label="Peak Sun Hours" type="number" step="0.1" value={peakSunHours} onChange={(e) => setPeakSunHours(parseFloat(e.target.value) || 0)} />
                      <Input label="Panel Wattage (W)" type="number" value={panelWattage} onChange={(e) => setPanelWattage(parseFloat(e.target.value) || 0)} />
                      <div title="Real-world default for UAE with Huawei inverter, GCL bifacial panels, and Staubli connectors. You can override.">
                        <Input label="System Efficiency (%)" type="number" step="0.1" value={systemEfficiencyInput} onChange={(e) => setSystemEfficiencyInput(parseFloat(e.target.value) || 0)} />
                      </div>
                      <Select label="Panel Orientation" value={panelOrientation} onChange={e => setPanelOrientation(e.target.value as 'portrait' | 'landscape')}>
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                      </Select>
                       <div className="flex items-center gap-2 pt-2">
                          <input type="checkbox" id="bifacial-toggle" checked={useBifacial} onChange={(e) => setUseBifacial(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                          <label htmlFor="bifacial-toggle" className="text-sm text-gray-700">Using bifacial panels (+7% gain)</label>
                      </div>
                       <div className="flex items-center gap-2">
                          <input type="checkbox" id="ideal-output-toggle" checked={showIdealOutput} onChange={(e) => setShowIdealOutput(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                          <label htmlFor="ideal-output-toggle" className="text-sm text-gray-700 flex items-center">
                              Ideal Output (Best Case)
                              <div title="Assumes perfect tilt, no shading, clean panels, and optimal temperature.">
                                  <Info size={14} className="ml-1 text-gray-400 cursor-help" />
                              </div>
                          </label>
                      </div>
                  </div>
              </Card>
               {authority === 'EtihadWE' && (
                   <Card title="Battery Storage">
                      <div className="space-y-4">
                          <div className="flex items-center gap-2">
                              <input type="checkbox" id="battery-toggle" checked={batteryEnabled} onChange={(e) => setBatteryEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                              <label htmlFor="battery-toggle" className="text-sm font-medium text-gray-700">Enable Battery Storage</label>
                          </div>
                          {batteryEnabled && (
                              <>
                                  <Select label="Battery Usage Mode" value={batteryMode} onChange={e => setBatteryMode(e.target.value as 'night' | 'unused')}>
                                      <option value="night">Nighttime Backup</option>
                                      <option value="unused">Store Unused Solar</option>
                                  </Select>
                                  <Input label="Battery Round-Trip Efficiency (%)" type="number" value={batteryEfficiency * 100} onChange={e => setBatteryEfficiency(parseFloat(e.target.value)/100)} />
                                  <Input label="Usable Depth of Discharge (%)" type="number" value={usableDoD * 100} onChange={e => setUsableDoD(parseFloat(e.target.value)/100)} />
                                  {batteryMode === 'unused' && (
                                      <div className="bg-blue-100 border border-blue-200 text-sm p-3 rounded-lg mt-4">
                                          To capture unused solar energy, you'd need a battery of approximately <strong>{batteryCapacity} kWh</strong>.
                                      </div>
                                  )}
                              </>
                          )}
                      </div>
                  </Card>
              )}
          </div>
        </div>
        
        {bills.length > 0 && (
            <div className="space-y-6">
              <Card title="Recommended System">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="p-4 rounded-lg text-white bg-brand-primary"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemMetrics.systemSize} kWp</p></div>
                    <div className="p-4 rounded-lg bg-gray-100 text-brand-primary"><p>Inverter Size</p><p className="text-2xl font-bold">{systemMetrics.inverterCapacity} kW</p></div>
                    <div className="p-4 rounded-lg bg-brand-secondary text-brand-primary"><p>Number of Panels</p><p className="text-2xl font-bold">{systemMetrics.panelCount}</p></div>
                    <div className="p-4 rounded-lg text-white bg-brand-primary"><p className="text-sm opacity-90">Est. Annual Production</p><p className="text-2xl font-bold">{systemMetrics.adjustedProduction.toLocaleString()} kWh</p></div>
                    <div className="p-4 rounded-lg bg-gray-100 text-brand-primary"><p>Roof Space Required</p><p className="text-2xl font-bold">~{systemMetrics.spaceRequired.toFixed(1)} m²</p></div>
                  </div>
                   {productionBoost > 0.1 && (
                      <div className="text-sm text-green-600 font-medium my-2 p-2 bg-green-50 rounded-md text-center">
                          +{productionBoost.toFixed(1)}% boost from {useBifacial && showIdealOutput ? 'Bifacial + Best Case' : useBifacial ? 'Bifacial Panels' : 'Best Case'}
                      </div>
                   )}
                   {systemMetrics.spaceRequired > availableSpace && (<div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /><p className="text-red-700">Warning: Required space ({systemMetrics.spaceRequired.toFixed(1)} m²) exceeds available space ({availableSpace} m²)</p></div>)}
                   {authority === 'DEWA' && <p className="text-sm text-gray-600 mt-2 text-center">Sized to offset ~100% of annual usage using DEWA net metering.</p>}
                   {unusedSolar > 0 && authority === 'EtihadWE' && !batteryEnabled && (
                      <div className="text-sm text-yellow-600 my-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                          Estimated unused solar: <strong>{unusedSolar.toLocaleString()} kWh/year</strong>. 
                          <button className="underline text-brand-primary ml-1" onClick={() => {setBatteryEnabled(true); setBatteryMode('unused');}}>
                              Store this?
                          </button>
                      </div>
                   )}
                   {unusedSolar > (systemMetrics.adjustedProduction * 0.1) && <p className="text-sm text-center mt-2">Consider reducing system size or adding battery storage to capture extra energy.</p>}
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="Financial & ROI Analysis">
                      <div className="space-y-4">
                          <Input label="System Cost (AED)" type="number" value={systemCost} onChange={(e) => setSystemCost(e.target.value)} placeholder="e.g. 25000" />
                          <div title="Annual efficiency loss of solar panels. Default is 0.7%.">
                            <Input label="Panel Degradation (% per year)" type="number" step="0.1" value={degradationRate * 100} onChange={e => setDegradationRate(parseFloat(e.target.value)/100)} />
                          </div>
                          <div title="Annual increase in grid electricity prices. Default is 2.5%.">
                            <Input label="Electricity Price Escalation (% per year)" type="number" step="0.1" value={escalationRate * 100} onChange={e => setEscalationRate(parseFloat(e.target.value)/100)} />
                          </div>
                      </div>
                       {systemCost && (
                           <div className="mt-6 space-y-4">
                              <div className="p-4 bg-green-50 rounded-lg text-center">
                                  <p className="text-sm text-green-800">First-Year Savings</p>
                                  <p className="text-3xl font-bold text-green-600">AED {financialAnalysis.annualSavings.toLocaleString()}</p>
                                  {authority === 'DEWA' && financialAnalysis.netMeteringCredits > 0 && <p className="text-xs text-green-700">Includes AED {financialAnalysis.netMeteringCredits.toLocaleString()} from net metering credits.</p>}
                                  {financialAnalysis.firstYearFuelSavings > 0 && <p className="text-xs text-green-700">Includes AED {financialAnalysis.firstYearFuelSavings.toLocaleString()} in fuel surcharge savings.</p>}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-center">
                                  <div className="p-3 bg-gray-100 rounded-lg"><p className="text-sm text-gray-600">Payback Period</p><p className="text-xl font-bold">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} years` : 'N/A'}</p></div>
                                  <div className="p-3 bg-gray-100 rounded-lg"><p className="text-sm text-gray-600">25-Year Net Profit</p><p className="text-xl font-bold">AED {financialAnalysis.roi25Year.toLocaleString()}</p></div>
                                  <div className="p-3 bg-gray-100 rounded-lg"><p className="text-sm text-gray-600">25-Year Total Value</p><p className="text-xl font-bold">AED {financialAnalysis.totalValue.toLocaleString()}</p></div>
                                  <div className="p-3 bg-gray-100 rounded-lg"><p className="text-sm text-gray-600">ROI (%)</p><p className="text-xl font-bold">{financialAnalysis.roiPercentage}%</p></div>
                              </div>
                           </div>
                       )}
                  </Card>
                   <Card title="Environmental Impact">
                      <div className="space-y-4 text-center">
                           <div className="p-4 bg-green-50 rounded-lg">
                               <p className="text-sm text-green-800">Annual CO₂ Savings</p>
                               <p className="text-3xl font-bold text-green-600">{(systemMetrics.adjustedProduction * CO2_SAVED_PER_KWH).toLocaleString(undefined, {maximumFractionDigits: 0})} kg</p>
                           </div>
                           <div className="p-4 bg-gray-100 rounded-lg">
                               <p className="text-sm text-gray-600">Total 25-Year CO₂ Savings</p>
                               <p className="text-xl font-bold">{(systemMetrics.adjustedProduction * CO2_SAVED_PER_KWH * 25 * (1 - degradationRate*12.5)).toLocaleString(undefined, {maximumFractionDigits: 0})} kg</p>
                           </div>
                           <div className="flex items-center gap-2 pt-2">
                              <input type="checkbox" id="visual-eq-toggle" checked={showVisualEquivalents} onChange={(e) => setShowVisualEquivalents(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                              <label htmlFor="visual-eq-toggle" className="text-sm text-gray-700">Show visual environmental equivalents</label>
                          </div>
                          {showVisualEquivalents && (
                               <div className="p-4 bg-gray-100 rounded-lg space-y-2 text-left">
                                   <p className="font-semibold text-center">Equivalent to (annually):</p>
                                   <div className="flex items-center gap-2"><TreePine className="h-6 w-6 text-green-600" /> <span>Planting <strong>{Math.round(systemMetrics.adjustedProduction * CO2_SAVED_PER_KWH / CO2_PER_TREE_YEAR)}</strong> trees.</span></div>
                                   <div className="flex items-center gap-2"><Car className="h-6 w-6 text-gray-600" /> <span>Removing the annual emissions of <strong>{((systemMetrics.adjustedProduction * CO2_SAVED_PER_KWH / 1000) / CO2_PER_CAR_YEAR_TONS).toFixed(1)}</strong> cars.</span></div>
                               </div>
                          )}
                      </div>
                  </Card>
              </div>
              <Card title="System Loss Breakdown">
                 <div className="text-sm text-gray-600">
                    <button onClick={() => setShowLossBreakdown(!showLossBreakdown)} className="font-semibold text-brand-primary flex items-center mb-2">
                      {showLossBreakdown ? <ChevronsUp className="mr-1 h-4 w-4"/> : <ChevronsDown className="mr-1 h-4 w-4"/>}
                      Show Loss Factors
                    </button>
                    { showLossBreakdown && (
                      <>
                        <p className="mb-2">The overall system efficiency of <strong>{systemEfficiencyInput}%</strong> is a real-world estimate based on high-quality components and typical UAE installation conditions. The major loss factors are:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Inverter Efficiency (~1.5% loss):</strong> Conversion from DC (panels) to AC (home).</li>
                            <li><strong>Cabling & Connectors (~1% loss):</strong> Resistance in wiring.</li>
                            <li><strong>Soiling & Dust (~2% loss):</strong> Dust accumulation on panels reducing output.</li>
                            <li><strong>Temperature Derating (~2.5% loss):</strong> Panel performance decreases in high ambient temperatures.</li>
                            <li><strong>Mismatch & Other (~1% loss):</strong> Minor variations between panels.</li>
                        </ul>
                      </>
                    )}
                 </div>
              </Card>
            </div>
        )}
      </div>

       <div className="flex justify-end flex-wrap gap-4">
        <Button onClick={copyReport} disabled={!systemCost}>
          <Copy className="w-5 h-5 mr-2" /> Copy Report
        </Button>
        <Button onClick={handleExportPdf} disabled={!systemCost}>
          <Printer className="w-5 h-5 mr-2" /> Export PDF Report
        </Button>
         <Button onClick={saveProject} variant="secondary">
            <Save className="w-4 h-4 mr-2" />
            Save Project (JSON)
        </Button>
        <Button variant="ghost" asChild>
          <label htmlFor="import-project-input" className="cursor-pointer flex items-center">
            <Upload className="w-5 h-5 mr-2" /> Import Project
            <input
              type="file"
              accept=".json"
              className="hidden"
              id="import-project-input"
              onChange={importProject}
            />
          </label>
        </Button>
      </div>

      <div className="mt-6">
          <Button variant="ghost" onClick={() => setShowDebug(!showDebug)} className="mx-auto flex items-center">
              {showDebug ? <ChevronsUp className="mr-2 h-4 w-4" /> : <ChevronsDown className="mr-2 h-4 w-4" />}
              {showDebug ? 'Hide' : 'Show'} Full Calculation Breakdown
          </Button>
          {showDebug && (
              <Card title="Full Calculation Breakdown">
                  <pre className="text-xs bg-gray-800 text-white p-4 rounded-md overflow-x-auto">
                      {`--- USER INPUTS ---
Authority: ${authority}
City: ${city}
Annual Consumption: ${consumptionStats.annualConsumption.toFixed(0)} kWh
System Cost: ${systemCost} AED
Panel Wattage: ${panelWattage} W
Bifacial Panels: ${useBifacial ? 'ON' : 'OFF'}
Ideal Output Mode: ${showIdealOutput ? 'ON' : 'OFF'}

--- SYSTEM SIZING ---
Target Annual Production: ${authority === 'DEWA' ? consumptionStats.annualConsumption.toFixed(0) : (consumptionStats.annualConsumption * (daytimeConsumption/100)).toFixed(0)} kWh
System Size: ${systemMetrics.systemSize} kWp
Panel Count: ${systemMetrics.panelCount}
Space Required: ~${systemMetrics.spaceRequired.toFixed(1)} m²

--- PRODUCTION ESTIMATE ---
Base Annual Yield: ${systemMetrics.annualProduction.toLocaleString(undefined, {maximumFractionDigits: 0})} kWh
System Efficiency (${(systemEfficiency * 100).toFixed(0)}%): x ${systemEfficiency.toFixed(2)}
Bifacial Boost: x ${useBifacial ? '1.07' : '1.00'}
Adjusted Annual Production: ${systemMetrics.adjustedProduction.toLocaleString()} kWh

--- FINANCIALS ---
Total First-Year Savings: AED ${financialAnalysis.annualSavings.toLocaleString()}
  - Grid Offset Savings: AED ${(financialAnalysis.annualSavings - financialAnalysis.netMeteringCredits - financialAnalysis.firstYearFuelSavings).toLocaleString()}
  - Net Metering Credits: AED ${financialAnalysis.netMeteringCredits.toLocaleString()}
  - Fuel Surcharge Savings: AED ${financialAnalysis.firstYearFuelSavings.toLocaleString()}
Payback Period: ${financialAnalysis.paybackPeriod} years
25-Year Net Profit: AED ${financialAnalysis.roi25Year.toLocaleString()}
25-Year Total Value: AED ${financialAnalysis.totalValue.toLocaleString()}
ROI: ${financialAnalysis.roiPercentage}%

--- CO2 OFFSET ---
Annual CO2 Saved: ${(systemMetrics.adjustedProduction * CO2_SAVED_PER_KWH).toFixed(0)} kg`}
                  </pre>
              </Card>
          )}
      </div>
    </div>
  );
};

export default CalculatorPage;
