
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { Sun, Battery, TrendingUp, FileText, AlertCircle, Trash2, PlusCircle, Download, XCircle, Wand2, Info, Upload, ChevronsDown, ChevronsUp, Leaf } from 'lucide-react';
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

const CalculatorPage: React.FC = () => {
  // Project Configuration
  const [authority, setAuthority] = useState<string>('DEWA');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [city, setCity] = useState('Dubai');
  const [useBifacial, setUseBifacial] = useState(false);

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
  const [systemEfficiency, setSystemEfficiency] = useState<number>(0.93);
  const [batteryEfficiency, setBatteryEfficiency] = useState(0.95);
  const [usableDoD, setUsableDoD] = useState(0.9);
  const [showIdealOutput, setShowIdealOutput] = useState(false);
  const [inverterRatio, setInverterRatio] = useState(1.1);
  const [batteryMode, setBatteryMode] = useState<'night' | 'unused'>('night');

  // ROI Inputs
  const [systemCost, setSystemCost] = useState<string>('');
  const [degradationRate, setDegradationRate] = useState(0.007);
  const [escalationRate, setEscalationRate] = useState(0.015);
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState(0.06);
  
  // Dev view state
  const [showDebug, setShowDebug] = useState(false);
  const [monthlySavings, setMonthlySavings] = useState<Record<string, number>>({});
  const [showVisualEquivalents, setShowVisualEquivalents] = useState(false);


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
        alert("Rate tiers cannot be empty. Resetting to default values.");
        setTiers(defaultTiers[authority as keyof typeof defaultTiers] || defaultTiers['DEWA']);
    }
  }, [tiers, authority, defaultTiers]);

  useEffect(() => {
    if (authority === 'DEWA') {
        setFuelSurchargeRate(0.06);
    } else if (authority === 'EtihadWE') {
        setFuelSurchargeRate(0.05);
    }
  }, [authority]);

  const idealBatteryEfficiency = showIdealOutput ? 1 : batteryEfficiency;
  const idealUsableDoD = showIdealOutput ? 1 : usableDoD;

  const calculateBillAmount = useCallback((consumption: number, year: number = 1, currentEscalationRate: number = escalationRate): number => {
    if (consumption <= 0) return 0;
    const escalationFactor = Math.pow(1 + currentEscalationRate, year - 1);
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
  }, [tiers, escalationRate]);
  
  const addTier = () => {
    if (tiers.length > 0) {
        const lastTier = tiers[tiers.length - 1];
        const newFrom = lastTier.to === Infinity ? (lastTier.from + 2000) : (lastTier.to + 1);
        setTiers([...tiers.slice(0, -1), 
        { from: lastTier.from, to: newFrom - 1, rate: lastTier.rate },
        { from: newFrom, to: Infinity, rate: parseFloat((lastTier.rate + 0.05).toFixed(2)) }
        ]);
    } else {
        // If no tiers exist, add the default first tier
        setTiers([{ from: 0, to: 2000, rate: 0.23 }]);
    }
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
    } else {
      setTiers([]); // Allow removing the last tier
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
    
    setEstimationWarning('');
    const summerMonths = ['May', 'June', 'July', 'August', 'September'];
    const hasSummerBill = bills.some(b => summerMonths.includes(b.month));
    if (!hasSummerBill) {
        setEstimationWarning('⚠️ This estimate may be low — please include at least one summer bill for accuracy.');
    }

    const cityFactors = CITY_SEASONAL_FACTORS[city] || CITY_SEASONAL_FACTORS['Dubai'];
    const totalBaseConsumption = bills.reduce((sum, bill) => sum + (bill.consumption / cityFactors[bill.month]), 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;
    const userProvidedMonths = new Set(bills.map(b => b.month));
    const estimatedBills = months.filter(month => !userProvidedMonths.has(month)).map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * cityFactors[month]);
        return { month, consumption: estimatedConsumption, amount: calculateBillAmount(estimatedConsumption), isEstimated: true };
    });
    setPendingEstimates(estimatedBills);
  }, [bills, calculateBillAmount, months, city]);

  const consumptionStats = useMemo(() => {
    if (bills.length === 0) return { avgMonthly: 0, totalAnnual: 0 };
    const totalAnnual = bills.reduce((sum, b) => sum + b.consumption, 0);
    const avgMonthly = totalAnnual / bills.length;
    const finalAnnual = bills.length === 12 ? totalAnnual : avgMonthly * 12;

    return { avgMonthly, totalAnnual: Math.round(finalAnnual) };
  }, [bills]);

  const systemMetrics = useMemo(() => {
    if (consumptionStats.totalAnnual === 0) return { systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, actualSystemSize: 0 };
    
    const avgDaily = consumptionStats.totalAnnual / 365;
    let targetConsumption = avgDaily; 
    
    if (authority === 'EtihadWE') {
        if (batteryEnabled && batteryMode === 'night') {
            targetConsumption = avgDaily;
        } else {
            targetConsumption = avgDaily * (daytimeConsumption / 100);
        }
    }
    
    const systemSize = (targetConsumption / (peakSunHours * systemEfficiency));
    const panelCount = Math.ceil((systemSize * 1000) / panelWattage);
    const actualSystemSize = (panelCount * panelWattage) / 1000;
    const spaceRequired = panelCount * 2.1;

    const rawProduction = actualSystemSize * peakSunHours * 365;
    const systemEfficiencyFactor = showIdealOutput ? 1 : systemEfficiency;
    const bifacialBoost = showIdealOutput ? 1 : (useBifacial ? 1.07 : 1);
    const annualProduction = rawProduction * systemEfficiencyFactor * bifacialBoost;
    
    return { 
        systemSize: Math.round(actualSystemSize * 10) / 10, 
        panelCount, 
        spaceRequired: Math.round(spaceRequired), 
        annualProduction: Math.round(annualProduction), 
        actualSystemSize 
    };
  }, [consumptionStats, authority, batteryEnabled, batteryMode, daytimeConsumption, peakSunHours, panelWattage, showIdealOutput, useBifacial, systemEfficiency]);

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

  const unusedSolar = useMemo(() => {
    if (systemMetrics.annualProduction === 0 || bills.length === 0) return 0;
    
    const totalConsumption = consumptionStats.totalAnnual;
    const totalProduction = systemMetrics.annualProduction;
    
    if (authority === 'DEWA') {
      return Math.max(0, totalProduction - totalConsumption);
    }
    
    let totalSelfConsumed = 0;
    for (const month of months) {
        const monthlyProduction = monthlyProductionMap[month] || 0;
        const monthlyConsumption = bills.find(b => b.month === month)?.consumption || consumptionStats.avgMonthly || 0;
        const daytimeLoadKwh = monthlyConsumption * (daytimeConsumption / 100);
        const usedThisMonth = Math.min(monthlyProduction, daytimeLoadKwh);
        totalSelfConsumed += usedThisMonth;
    }
    return Math.round(totalProduction - totalSelfConsumed);

  }, [systemMetrics.annualProduction, monthlyProductionMap, bills, authority, daytimeConsumption, consumptionStats]);

  const financialAnalysis = useMemo(() => {
    if (!systemCost || bills.length === 0 || systemMetrics.annualProduction === 0) {
      setMonthlySavings({});
      return { annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0, roiPercentage: 0, fuelSurchargeSavings: 0, totalValueGenerated: 0 };
    }

    const SYSTEM_LIFESPAN_YEARS = 25;
    const initialInvestment = parseFloat(systemCost);
    const maintenanceCostPerYear = initialInvestment * 0.01;
    
    const consumptionByMonth = months.reduce((acc, month) => {
        acc[month] = bills.find(b => b.month === month)?.consumption || consumptionStats.avgMonthly;
        return acc;
    }, {} as {[key: string]: number});

    let cumulativeCashFlow = -initialInvestment;
    let paybackPeriodYears = 0;
    let firstYearAnnualSavings = 0;
    const firstYearMonthlySavings: Record<string, number> = {};

    for (let year = 1; year <= SYSTEM_LIFESPAN_YEARS; year++) {
      let yearlySavings = 0;
      let yearlyExportCredit = 0;
      const degradationFactor = Math.pow(1 - degradationRate, year - 1);

      for (const monthName of months) {
          const monthlyConsumption = consumptionByMonth[monthName];
          const escalatedFuelSurcharge = fuelSurchargeRate * Math.pow(1 + escalationRate, year - 1);
          const originalBillAmount = calculateBillAmount(monthlyConsumption, year, escalationRate);
          const originalBillTotal = originalBillAmount + (monthlyConsumption * escalatedFuelSurcharge);
          
          const monthlyProduction = (monthlyProductionMap[monthName] || 0) * degradationFactor;
          
          let gridOffsetKwh = 0;
          
          if (authority === 'DEWA') {
              gridOffsetKwh = Math.min(monthlyProduction, monthlyConsumption);
              const kwhDrawnFromGrid = monthlyConsumption - gridOffsetKwh;
              const newTieredBill = calculateBillAmount(kwhDrawnFromGrid, year, escalationRate);
              const newFuelSurcharge = kwhDrawnFromGrid * escalatedFuelSurcharge;
              const newBillTotal = newTieredBill + newFuelSurcharge;
              
              const netExportKwh = Math.max(0, monthlyProduction - monthlyConsumption);
              const exportCredit = calculateBillAmount(netExportKwh, year, escalationRate);

              yearlySavings += (originalBillTotal - newBillTotal);
              yearlyExportCredit += exportCredit;
              
              if(year === 1) firstYearMonthlySavings[monthName] = (originalBillTotal - newBillTotal) + exportCredit;

          } else { // EtihadWE
              if (batteryEnabled) {
                  gridOffsetKwh = Math.min(monthlyProduction * idealBatteryEfficiency, monthlyConsumption);
              } else {
                  const daytimeLoadKwh = monthlyConsumption * (daytimeConsumption / 100);
                  gridOffsetKwh = Math.min(monthlyProduction, daytimeLoadKwh);
              }
              const kwhDrawnFromGrid = monthlyConsumption - gridOffsetKwh;
              const newTieredBill = calculateBillAmount(kwhDrawnFromGrid, year, escalationRate);
              const newFuelSurcharge = kwhDrawnFromGrid * escalatedFuelSurcharge;
              const newBillTotal = newTieredBill + newFuelSurcharge;
              
              yearlySavings += (originalBillTotal - newBillTotal);
              if(year === 1) firstYearMonthlySavings[monthName] = (originalBillTotal - newBillTotal);
          }
      }
      
      if (year === 1) {
          firstYearAnnualSavings = yearlySavings + yearlyExportCredit;
      }
      
      const yearlyCashFlow = (yearlySavings + yearlyExportCredit) - maintenanceCostPerYear;
      if (paybackPeriodYears === 0 && (cumulativeCashFlow + yearlyCashFlow) > 0) {
          paybackPeriodYears = (year - 1) + (Math.abs(cumulativeCashFlow) / yearlyCashFlow);
      }
      cumulativeCashFlow += yearlyCashFlow;
    }
    
    const netProfit = Math.round(cumulativeCashFlow + initialInvestment);
    const roiPercentage = initialInvestment > 0 ? (netProfit / initialInvestment) * 100 : 0;
    const totalValueGenerated = netProfit + initialInvestment;
    
    setMonthlySavings(firstYearMonthlySavings);
    
    return { 
        annualSavings: Math.round(firstYearAnnualSavings), 
        paybackPeriod: paybackPeriodYears > 0 ? Math.round(paybackPeriodYears * 10) / 10 : 0, 
        roi25Year: netProfit, 
        netMeteringCredits: Math.round(calculateBillAmount(unusedSolar)),
        roiPercentage: Math.round(roiPercentage),
        totalValueGenerated: Math.round(totalValueGenerated),
        fuelSurchargeSavings: 0,
    };
  }, [systemCost, bills, systemMetrics.annualProduction, authority, batteryEnabled, daytimeConsumption, calculateBillAmount, monthlyProductionMap, degradationRate, escalationRate, idealBatteryEfficiency, batteryMode, fuelSurchargeRate, unusedSolar, consumptionStats, useBifacial]);

  const environmentalStats = useMemo(() => {
    if (!systemMetrics.annualProduction) return { co2SavedPerYearKg: 0, co2Saved25YearsKg: 0 };
    
    const co2SavedPerYearKg = systemMetrics.annualProduction * 0.82;
    
    let totalProduction25Years = 0;
    for (let year = 0; year < 25; year++) {
        totalProduction25Years += systemMetrics.annualProduction * Math.pow(1 - degradationRate, year);
    }
    const co2Saved25YearsKg = totalProduction25Years * 0.82;
    
    return {
        co2SavedPerYearKg: Math.round(co2SavedPerYearKg),
        co2Saved25YearsKg: Math.round(co2Saved25YearsKg)
    };
  }, [systemMetrics.annualProduction, degradationRate]);

  const saveProject = () => {
    const projectData = { 
        projectName, location, city, authority, batteryEnabled, bills, 
        tiers, daytimeConsumption, availableSpace, peakSunHours, 
        panelWattage, systemEfficiency, systemCost, degradationRate, escalationRate, 
        batteryEfficiency, usableDoD, inverterRatio, batteryMode, useBifacial
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const linkElement = document.createElement('a');
    linkElement.href = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    linkElement.download = `${projectName.replace(/\s/g, '_') || 'solar_project'}_${new Date().toISOString().split('T')[0]}.json`;
    linkElement.click();
  };

   const copyReport = () => {
    const { systemSize, panelCount, annualProduction } = systemMetrics;
    const cost = parseFloat(systemCost) || 0;
    const coveragePercent = consumptionStats.totalAnnual > 0 ? (annualProduction / consumptionStats.totalAnnual) * 100 : 0;

    let summary = `SOLAR OASIS - PROJECT REPORT
============================
Project: ${projectName || 'Solar Project'}
Location: ${location || city}
Authority: ${authority}
Date: ${new Date().toLocaleDateString()}

CONSUMPTION ANALYSIS
--------------------
Annual Consumption: ${consumptionStats.totalAnnual.toLocaleString()} kWh

RECOMMENDED SYSTEM
------------------
System Size: ${systemSize} kWp
Number of Panels: ${panelCount} × ${panelWattage}W
Annual Production: ${annualProduction.toLocaleString()} kWh
Solar Coverage: ${coveragePercent.toFixed(1)}%
${batteryEnabled ? `Battery Capacity: ${Math.ceil((consumptionStats.totalAnnual / 365 * (1 - daytimeConsumption / 100)) / (idealBatteryEfficiency * idealUsableDoD))} kWh` : ''}

FINANCIAL ANALYSIS
------------------
System Cost: AED ${cost.toLocaleString()}
First-Year Savings: AED ${financialAnalysis.annualSavings.toLocaleString()}
25-Year Net Profit: AED ${financialAnalysis.roi25Year.toLocaleString()}
25-Year Total Value: AED ${financialAnalysis.totalValueGenerated.toLocaleString()}
ROI: ${financialAnalysis.roiPercentage.toFixed(0)}%
Payback Period: ${financialAnalysis.paybackPeriod} years
`;

    if (authority === 'DEWA') {
      summary += `Net Metering Credit: AED ${financialAnalysis.netMeteringCredits.toLocaleString()}/year\n`;
    }

    summary += `
ENVIRONMENTAL IMPACT
--------------------
Annual CO₂ Savings: ${environmentalStats.co2SavedPerYearKg.toLocaleString()} kg
25-Year CO₂ Savings: ${environmentalStats.co2Saved25YearsKg.toLocaleString()} kg
`;

    const footnotes = [];
    if (!showIdealOutput) {
        footnotes.push(`System losses estimated at ${((1 - systemEfficiency) * 100).toFixed(0)}% based on premium components and UAE field conditions.`);
        if (useBifacial) {
            footnotes.push(`+7% gain applied for bifacial panel reflectivity.`);
        }
    } else {
        footnotes.push("Values assume ideal conditions (perfect tilt, no shading, clean panels, optimal temperature).");
    }

    if (footnotes.length > 0) {
        summary += `\n----------------------------\nNotes:\n- ${footnotes.join('\n- ')}`;
    }

    navigator.clipboard.writeText(summary).then(() => alert('Report copied to clipboard!'));
  };
  
  const debugOutput = useMemo(() => {
    const { systemSize, panelCount, annualProduction, actualSystemSize } = systemMetrics;
    const rawOutput = actualSystemSize * peakSunHours * 365;
    const efficiencyApplied = rawOutput * systemEfficiency;
    const bifacialApplied = useBifacial ? efficiencyApplied * 1.07 : efficiencyApplied;

    let authorityDebugInfo = '';
    if (authority === 'EtihadWE') {
        let totalAnnualGridOffset = 0;
        for (const monthName of months) {
            const monthlyProduction = (monthlyProductionMap[monthName] || 0);
            const monthlyConsumption = bills.find(b => b.month === monthName)?.consumption || consumptionStats.avgMonthly;
            let gridOffsetKwh = 0;
            if (batteryEnabled) {
                gridOffsetKwh = Math.min(monthlyProduction * idealBatteryEfficiency, monthlyConsumption);
            } else {
                const daytimeLoadKwh = monthlyConsumption * (daytimeConsumption / 100);
                gridOffsetKwh = Math.min(monthlyProduction, daytimeLoadKwh);
            }
            totalAnnualGridOffset += gridOffsetKwh;
        }
        const totalFuelSurchargeSavings = totalAnnualGridOffset * fuelSurchargeRate;

        authorityDebugInfo = `
[EtihadWE Specifics]
Daytime Usage Offset: ${daytimeConsumption}%
Total Annual Grid Offset: ${totalAnnualGridOffset.toLocaleString(undefined, {maximumFractionDigits:0})} kWh
Fuel Surcharge Savings (1st Year): ${totalAnnualGridOffset.toLocaleString(undefined, {maximumFractionDigits:0})} kWh × ${fuelSurchargeRate} AED/kWh = AED ${totalFuelSurchargeSavings.toLocaleString(undefined, {maximumFractionDigits:2})}
Slabs Applied:
${tiers.map(t => `  - ${t.from} - ${t.to === Infinity ? '∞' : t.to} kWh @ ${t.rate} AED`).join('\n')}
`;
    } else if (authority === 'DEWA') {
        const totalGridOffset = Math.min(systemMetrics.annualProduction, consumptionStats.totalAnnual);
        const fuelSurchargeSavings = totalGridOffset * fuelSurchargeRate;
        authorityDebugInfo = `
[DEWA Specifics]
Net Metering Credits (1st Year): AED ${financialAnalysis.netMeteringCredits.toLocaleString()}
Fuel Surcharge Savings: AED ${fuelSurchargeSavings.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
    }

    return `--- FULL CALCULATION BREAKDOWN ---

[User Inputs]
Authority: ${authority}
Fuel Surcharge: ${fuelSurchargeRate} AED/kWh
Annual Consumption: ${consumptionStats.totalAnnual.toLocaleString()} kWh
System Size: ${systemSize} kWp
Panel Spec: ${panelCount} × ${panelWattage}W
${authorityDebugInfo}

[Production Estimate]
Base Yield: ${(peakSunHours * 365).toFixed(0)} kWh/kWp/year
Raw Output = ${actualSystemSize.toFixed(2)} kWp × ${(peakSunHours * 365).toFixed(0)} = ${rawOutput.toLocaleString(undefined, {maximumFractionDigits:0})} kWh
System Efficiency (${(systemEfficiency * 100).toFixed(0)}%) → ${rawOutput.toLocaleString(undefined, {maximumFractionDigits:0})} × ${systemEfficiency} = ${efficiencyApplied.toLocaleString(undefined, {maximumFractionDigits:0})} kWh
${useBifacial ? `Bifacial Boost (7%) → ${efficiencyApplied.toLocaleString(undefined, {maximumFractionDigits:0})} × 1.07 = ${bifacialApplied.toLocaleString(undefined, {maximumFractionDigits:0})} kWh` : ''}
Final Annual Production: ${annualProduction.toLocaleString()} kWh

[Consumption Offset]
Solar Coverage = ${annualProduction.toLocaleString()} / ${consumptionStats.totalAnnual.toLocaleString()} = ${(annualProduction / consumptionStats.totalAnnual * 100).toFixed(1)}%

[Billing]
${authority} Tiered Rates Applied ✅
Monthly AED Savings:
${Object.entries(monthlySavings).map(([month, saving]) => `  ${month.padEnd(10)}: AED ${saving.toFixed(2)}`).join('\n')}
Total Annual Savings: AED ${financialAnalysis.annualSavings.toLocaleString()}

[Financials]
System Cost: AED ${(parseFloat(systemCost) || 0).toLocaleString()}
Payback = ${(parseFloat(systemCost) || 0).toLocaleString()} / ${financialAnalysis.annualSavings.toLocaleString()} = ${financialAnalysis.paybackPeriod} years
25-Year Net Profit = AED ${financialAnalysis.roi25Year.toLocaleString()}
25-Year Total Value Generated = AED ${financialAnalysis.totalValueGenerated.toLocaleString()}
ROI = ${financialAnalysis.roiPercentage}%

--- END BREAKDOWN ---`;
  }, [systemMetrics, financialAnalysis, authority, fuelSurchargeRate, consumptionStats, panelWattage, peakSunHours, useBifacial, systemCost, monthlySavings, systemEfficiency, tiers, monthlyProductionMap, batteryEnabled, idealBatteryEfficiency, daytimeConsumption]);


  return (
    <div className="space-y-6">
      <Card title="Project Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Villa Solar Project" />
            <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Dubai, UAE" />
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
                {['DEWA', 'EtihadWE'].map(auth => (
                  <Button 
                    key={auth} 
                    onClick={() => { 
                      setAuthority(auth); 
                      if (auth === 'DEWA') {
                        setBatteryEnabled(false);
                      } else {
                        setDaytimeConsumption(55);
                      }
                    }} 
                    variant={authority === auth ? 'primary' : 'ghost'} 
                    className="w-full"
                  >{auth}</Button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Battery Storage</label>
              <Button onClick={() => setBatteryEnabled(!batteryEnabled)} disabled={authority === 'DEWA'} variant={batteryEnabled ? 'secondary' : 'ghost'} className="w-full"><Battery className="w-4 h-4 mr-2" />{batteryEnabled ? 'Enabled' : 'Disabled'}</Button>
              {batteryEnabled && authority === 'EtihadWE' && (
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Tiers</label>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-medium text-gray-700">AED/kWh</h3><Button onClick={addTier} size="sm" variant="ghost" aria-label="Add Tier"><PlusCircle size={16} /></Button></div>
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
            {estimationWarning && <p className="text-center text-amber-600 mt-2 text-sm">{estimationWarning}</p>}
             {pendingEstimates.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-brand-primary mb-2">Estimated Months</h3>
                <p className="text-sm mb-3">We’ve estimated the missing months. You can review and edit them before applying:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                  {pendingEstimates.map((bill, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm w-12">{bill.month}</span>
                      <input
                        type="number"
                        value={bill.consumption}
                        onChange={(e) => {
                          const newEstimates = [...pendingEstimates];
                          newEstimates[index].consumption = parseFloat(e.target.value) || 0;
                          newEstimates[index].amount = calculateBillAmount(newEstimates[index].consumption);
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
             <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center p-4 rounded-lg bg-gray-50 border">
                    <div>
                        <p className="text-sm text-gray-600">Average Daily Usage</p>
                        <p className="text-xl font-semibold text-brand-primary">{(consumptionStats.totalAnnual / 365).toFixed(1)} kWh</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Average Monthly Usage</p>
                        <p className="text-xl font-semibold text-brand-primary">{consumptionStats.avgMonthly.toFixed(0)} kWh</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Estimated Yearly Usage</p>
                        <p className="text-xl font-semibold text-brand-primary">{consumptionStats.totalAnnual.toLocaleString()} kWh</p>
                    </div>
                </div>
          </div>
        )}
      </Card>
      <Card title="System Parameters">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start">
            {authority === 'EtihadWE' && !batteryEnabled && (
                <div className="flex items-end gap-1">
                    <Input label="Daytime Usage %" type="number" value={daytimeConsumption} onChange={(e) => setDaytimeConsumption(parseInt(e.target.value) || 0)} min="0" max="100" />
                    <span title="This is the estimated percentage of your total electricity that happens during daylight hours — usually around 55% in UAE villas. You can override it if you have a custom load profile.">
                        <Info className="w-5 h-5 text-gray-400 cursor-help mb-2" />
                    </span>
                </div>
            )}
            {authority === 'EtihadWE' && batteryEnabled && (
              <>
                <Input label="Battery Efficiency (%)" type="number" value={batteryEfficiency * 100} onChange={(e) => setBatteryEfficiency(parseFloat(e.target.value) / 100 || 0)} min="0" max="100" />
                <Input label="Usable DoD (%)" type="number" value={usableDoD * 100} onChange={(e) => setUsableDoD(parseFloat(e.target.value) / 100 || 0)} min="0" max="100" />
              </>
            )}
            <Input label="Available Space (m²)" type="number" value={availableSpace} onChange={(e) => setAvailableSpace(parseFloat(e.target.value) || 0)} />
            <Input label="Peak Sun Hours" type="number" value={peakSunHours} onChange={(e) => setPeakSunHours(parseFloat(e.target.value) || 0)} step={0.1} />
            <Input label="Panel Wattage (W)" type="number" value={panelWattage} onChange={(e) => setPanelWattage(parseFloat(e.target.value) || 0)} />
            <Input label="System Efficiency (%)" type="number" value={systemEfficiency * 100} onChange={(e) => setSystemEfficiency(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
            <div>
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
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
                <input type="checkbox" id="bifacial-toggle" checked={useBifacial} onChange={(e) => setUseBifacial(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <label htmlFor="bifacial-toggle" className="text-sm text-gray-600">Using bifacial panels</label>
            </div>
             <div className="flex items-center gap-2">
                <input type="checkbox" id="ideal-output-toggle" checked={showIdealOutput} onChange={(e) => setShowIdealOutput(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <label htmlFor="ideal-output-toggle" className="text-sm text-gray-600" title="Assumes perfect tilt, no shading, clean panels, and optimal temperature.">Ideal Output (Best Case)</label>
            </div>
        </div>
      </Card>
      {bills.length > 0 && (
        <>
        <Card title="Recommended System">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg text-white bg-brand-primary"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemMetrics.systemSize} kWp</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary"><p className="text-sm text-brand-primary">Number of Panels</p><p className="text-2xl font-bold text-brand-primary">{systemMetrics.panelCount}</p></div>
            <div className="p-4 rounded-lg text-white bg-brand-primary"><p className="text-sm opacity-90">Solar Coverage</p><p className="text-2xl font-bold">{consumptionStats.totalAnnual > 0 ? (systemMetrics.annualProduction / consumptionStats.totalAnnual * 100).toFixed(1) : 0}%</p></div>
            <div className="p-4 rounded-lg bg-brand-secondary"><p className="text-sm text-brand-primary">Annual Production</p><p className="text-2xl font-bold text-brand-primary">{systemMetrics.annualProduction.toLocaleString()} kWh</p></div>
          </div>
          
          {!showIdealOutput && (
            <div className="mb-4 mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              <p>System losses estimated at <strong>{((1 - systemEfficiency) * 100).toFixed(0)}%</strong> based on premium components and UAE field conditions. {useBifacial && "A <strong>+7%</strong> gain is applied for bifacial panel reflectivity."}</p>
            </div>
          )}
        </Card>
        <Card title="Financial & ROI Analysis">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Input label="System Cost (AED)" type="number" value={systemCost} onChange={(e) => setSystemCost(e.target.value)} placeholder="e.g. 25000" />
              <Input label="Panel Degradation (%/yr)" type="number" value={degradationRate * 100} onChange={(e) => setDegradationRate(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
              <Input label="Price Escalation (%/yr)" type="number" value={escalationRate * 100} onChange={(e) => setEscalationRate(parseFloat(e.target.value) / 100 || 0)} step="0.1" />
              {(authority === 'DEWA' || authority === 'EtihadWE') && (
                  <Input 
                      label="Fuel Surcharge (AED/kWh)" 
                      type="number" 
                      value={fuelSurchargeRate} 
                      onChange={(e) => setFuelSurchargeRate(parseFloat(e.target.value) || 0)} 
                      step="0.001"
                  />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-2 mb-4 space-y-1">
                <p>Financials based on a <strong>{degradationRate * 100}%/year</strong> panel degradation and a <strong>{escalationRate * 100}%/year</strong> electricity price escalation.</p>
            </div>
          {systemCost && (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6 text-center">
                <div className="bg-green-100 p-4 rounded-lg"><p className="text-sm text-gray-600">First-Year Savings</p><p className="text-xl font-bold text-green-700">AED {financialAnalysis.annualSavings.toLocaleString()}</p></div>
                <div className="bg-purple-100 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year Net Profit</p><p className="text-xl font-bold text-purple-700">AED {financialAnalysis.roi25Year.toLocaleString()}</p></div>
                <div className="bg-sky-100 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year Total Value</p><p className="text-xl font-bold text-sky-700">AED {financialAnalysis.totalValueGenerated.toLocaleString()}</p></div>
                <div className="bg-amber-100 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year ROI</p><p className="text-xl font-bold text-amber-700">{financialAnalysis.roiPercentage.toLocaleString()}%</p></div>
                <div className="bg-blue-100 p-4 rounded-lg"><p className="text-sm text-gray-600">Payback Period</p><p className="text-xl font-bold text-blue-700">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} years` : 'N/A'}</p></div>
            </div>

            {authority === 'DEWA' && financialAnalysis.netMeteringCredits > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 mb-4">
                  Includes an estimated <strong>AED {financialAnalysis.netMeteringCredits.toLocaleString()}</strong> in net metering credits per year.
              </div>
            )}
            
            <div className="mt-6"><h3 className="text-lg font-semibold mb-3 text-brand-primary">Monthly Consumption vs. Production</h3><ResponsiveContainer width="100%" height={300}><BarChart data={Object.entries(monthlySavings).map(([m, s]) => ({month: m.substring(0,3), saving: s}))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value: number) => `AED ${value.toFixed(2)}`} /><Legend /><Bar dataKey="saving" fill="#34d399" name="Monthly Savings (AED)" /></BarChart></ResponsiveContainer></div>
          </>)}
        </Card>

        <Card title="Environmental Impact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 font-medium">Annual CO₂ Savings</p>
                    <p className="text-2xl font-bold text-green-800">{environmentalStats.co2SavedPerYearKg.toLocaleString()} kg</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg border border-green-300">
                    <p className="text-sm text-green-700 font-medium">25-Year CO₂ Savings</p>
                    <p className="text-2xl font-bold text-green-800">{environmentalStats.co2Saved25YearsKg.toLocaleString()} kg</p>
                </div>
            </div>
            <div className="mt-4">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="visual-equivalents-toggle" checked={showVisualEquivalents} onChange={(e) => setShowVisualEquivalents(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                    <label htmlFor="visual-equivalents-toggle" className="text-sm text-gray-600">Show visual environmental equivalents</label>
                </div>
                {showVisualEquivalents && (
                    <div className="mt-4 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border text-center">
                        <p className="font-semibold mb-1">This is equivalent to:</p>
                        <p>– Planting {Math.round(environmentalStats.co2SavedPerYearKg / 21).toLocaleString()} trees every year 🌳</p>
                        <p>– Removing {Math.round(environmentalStats.co2SavedPerYearKg / 0.192).toLocaleString()} km of car travel per year 🚗</p>
                    </div>
                )}
            </div>
        </Card>

        <Card title="Export & Save" actions={
            <Button onClick={() => setShowDebug(!showDebug)} variant="ghost" size="sm">
                {showDebug ? <ChevronsUp className="mr-2 h-4 w-4" /> : <ChevronsDown className="mr-2 h-4 w-4" />}
                {showDebug ? 'Hide' : 'Show'} Full Calculation
            </Button>
        }>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={copyReport} disabled={!systemCost || bills.length === 0}><FileText className="w-5 h-5 mr-2" /> Copy Report</Button>
            <Button onClick={saveProject} disabled={!systemCost || bills.length === 0} variant="secondary"><Download className="w-5 h-5 mr-2" /> Save Project</Button>
             <Button variant="ghost">
              <input type="file" accept=".json" className="hidden" id="import-project-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      setProjectName(data.projectName || '');
                      setLocation(data.location || '');
                      setCity(data.city || 'Dubai');
                      setAuthority(data.authority || 'DEWA');
                      setBatteryEnabled(data.batteryEnabled || false);
                      setBillInput('');
                      setBills(data.bills || []);
                      setTiers(data.tiers || []);
                      setDaytimeConsumption(data.daytimeConsumption || 55);
                      setAvailableSpace(data.availableSpace || 100);
                      setPeakSunHours(data.peakSunHours || 5.5);
                      setPanelWattage(data.panelWattage || 610);
                      setSystemEfficiency(data.systemEfficiency || 0.93);
                      setSystemCost(data.systemCost || '');
                      setDegradationRate(data.degradationRate || 0.007);
                      setEscalationRate(data.escalationRate || 0.015);
                      setBatteryEfficiency(data.batteryEfficiency || 0.95);
                      setUsableDoD(data.usableDoD || 0.9);
                      setInverterRatio(data.inverterRatio || 1.1);
                      setBatteryMode(data.batteryMode || 'night');
                      setUseBifacial(data.useBifacial || false);
                      alert('Project imported successfully!');
                    } catch (err) { alert('Failed to import project. Please check the file format.'); }
                  };
                  reader.readAsText(file);
                }}
              />
              <label htmlFor="import-project-input" className="cursor-pointer flex items-center"> <Upload className="w-5 h-5 mr-2" /> Import Project </label>
            </Button>
          </div>
        </Card>
        {showDebug && (
            <Card title="Full Calculation Breakdown">
                <pre className="text-xs bg-gray-800 text-white p-4 rounded-md overflow-x-auto">
                    <code>{debugOutput}</code>
                </pre>
            </Card>
        )}
        </>
      )}
    </div>
  );
};

export default CalculatorPage;
