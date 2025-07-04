
import React, { useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { Project, AnyComponent, ClientInfo } from '../types';
import { Card, Button, Table, Input, Select } from '../components/ui';
import { Plus, ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';


const ProjectsPage = () => {
    const { projectId } = useParams();
    const { state } = useContext(AppContext);
    
    if (projectId) {
        const project = state.projects.find(p => p.id === projectId);
        return project ? <ProjectDetails project={project} /> : <div>Project not found. You may need to return to the project list.</div>;
    }

    return <ProjectList projects={state.projects} />;
};

const ProjectList = ({ projects }: { projects: Project[] }) => {
    const navigate = useNavigate();
    const { addProject } = useContext(AppContext);
    
    const handleCreateProject = async () => {
        const newProjectData: Omit<Project, 'id'> = {
            name: "New Project",
            client: { name: "", contact: "", address: "" },
            location: "",
            systemCapacity: 0,
            timeline: { startDate: new Date().toISOString().split('T')[0], endDate: "" },
            status: 'Planning',
            siteSurveyNotes: "",
            components: [],
            costAnalysis: {
                componentCosts: [], totalMaterialCost: 0, installationCharges: 0, commissioningCharges: 0,
                electricalCost: 0, markupPercentage: 20, markupAmount: 0, totalProjectCost: 0, finalSellingPrice: 0,
                profitMargin: 0, profitMarginPercentage: 0, costPerKw: 0,
            }
        };
        const newProject = await addProject(newProjectData);
        if (newProject) {
            navigate(`/projects/${newProject.id}`);
        } else {
            alert("Failed to create a new project. Please try again.");
        }
    };

    return (
        <Card title="Projects" actions={<Button onClick={handleCreateProject}><Plus className="mr-2 h-4 w-4" /> New Project</Button>}>
            <Table headers={['Project Name', 'Client', 'System Capacity (kW)', 'Status', 'Total Cost']}>
                {projects.map(project => (
                    <tr key={project.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/projects/${project.id}`)}>
                        <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{project.name}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{project.client.name}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{project.systemCapacity} kW</td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {project.status}
                            </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{project.costAnalysis.finalSellingPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} AED</td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

const ProjectDetails = ({ project: initialProject }: { project: Project }) => {
    const navigate = useNavigate();
    const { state, updateProject } = useContext(AppContext);
    const { components: allComponents } = state;
    const [project, setProject] = useState<Project>(initialProject);

    const componentsByType = allComponents.reduce((acc, component) => {
        const type = component.type;
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(component);
        return acc;
    }, {} as Record<string, AnyComponent[]>);

    const recalculateCosts = (proj: Project): Project => {
        const componentCosts = proj.components.map(pc => {
            const comp = allComponents.find(c => c.id === pc.componentId);
            return { componentId: pc.componentId, quantity: pc.quantity, cost: comp?.cost || 0 };
        });
        const totalMaterialCost = componentCosts.reduce((acc, item) => acc + (item.cost * item.quantity), 0);
        const totalProjectCost = totalMaterialCost + proj.costAnalysis.installationCharges + proj.costAnalysis.commissioningCharges + proj.costAnalysis.electricalCost;
        const markupAmount = totalProjectCost * (proj.costAnalysis.markupPercentage / 100);
        const finalSellingPrice = totalProjectCost + markupAmount;
        const profitMargin = finalSellingPrice - totalProjectCost;
        const profitMarginPercentage = totalProjectCost > 0 ? (profitMargin / totalProjectCost) * 100 : 0;
        const costPerKw = proj.systemCapacity > 0 ? finalSellingPrice / proj.systemCapacity : 0;
        
        return {
            ...proj,
            costAnalysis: {
                ...proj.costAnalysis,
                componentCosts,
                totalMaterialCost,
                totalProjectCost,
                markupAmount,
                finalSellingPrice,
                profitMargin,
                profitMarginPercentage,
                costPerKw,
            }
        };
    };

    const handleProjectChange = <K extends keyof Project>(key: K, value: Project[K]) => {
        setProject(prev => recalculateCosts({ ...prev, [key]: value }));
    };

    const handleClientChange = <K extends keyof ClientInfo>(key: K, value: ClientInfo[K]) => {
        setProject(prev => recalculateCosts({ ...prev, client: { ...prev.client, [key]: value } }));
    };

    const handleCostChange = <K extends keyof Project['costAnalysis']>(key: K, value: Project['costAnalysis'][K]) => {
        setProject(prev => recalculateCosts({ ...prev, costAnalysis: { ...prev.costAnalysis, [key]: value } }));
    };

    const addComponentToProject = (componentId: string) => {
        if (!componentId) return;
        const existing = project.components.find(c => c.componentId === componentId);
        if (existing) {
            handleComponentQuantityChange(componentId, existing.quantity + 1);
        } else {
            const newComponents = [...project.components, { componentId, quantity: 1 }];
            handleProjectChange('components', newComponents);
        }
    };

    const handleComponentQuantityChange = (componentId: string, quantity: number) => {
        let newComponents;
        if (quantity <= 0) {
            newComponents = project.components.filter(c => c.componentId !== componentId);
        } else {
            newComponents = project.components.map(c => c.componentId === componentId ? { ...c, quantity } : c);
        }
        handleProjectChange('components', newComponents);
    };
    
    const handleSave = () => {
        updateProject(project);
        alert("Project saved!");
    };
    
    const generatePdfFromElement = (elementId: string, fileName: string) => {
        const element = document.getElementById(elementId);
        if (element) {
            html2canvas(element, { scale: 2 }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = pdfWidth / canvasWidth;
                const newCanvasHeight = canvasHeight * ratio;
                let heightLeft = newCanvasHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, newCanvasHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position = heightLeft - newCanvasHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, newCanvasHeight);
                    heightLeft -= pdfHeight;
                }
                
                pdf.save(fileName);
            });
        }
    }

    const handleGenerateQuotePdf = () => {
        generatePdfFromElement('quotation-template', `Quotation-${project.name.replace(/ /g, '_')}.pdf`);
    };

    const handleGenerateInternalPdf = () => {
        generatePdfFromElement('internal-cost-analysis-template', `Cost-Analysis-${project.name.replace(/ /g, '_')}.pdf`);
    };
    
    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => navigate('/projects')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects</Button>
            <Card title="Project Details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Project Name" value={project.name} onChange={e => handleProjectChange('name', e.target.value)} />
                    <Input label="System Capacity (kW)" type="number" value={project.systemCapacity} onChange={e => handleProjectChange('systemCapacity', parseFloat(e.target.value))} />
                    <Input label="Client Name" value={project.client.name} onChange={e => handleClientChange('name', e.target.value)} />
                    <Input label="Client Contact" value={project.client.contact} onChange={e => handleClientChange('contact', e.target.value)} />
                    <div className="md:col-span-2">
                      <Input label="Client Address" value={project.client.address} onChange={e => handleClientChange('address', e.target.value)} />
                    </div>
                </div>
            </Card>

            <Card title="Component Selection">
                <div className="flex items-end gap-2 mb-4">
                    <Select label="Add Component" onChange={e => addComponentToProject(e.target.value)} value="">
                        <option value="" disabled>Select a component...</option>
                        {Object.entries(componentsByType).map(([type, comps]) => (
                            <optgroup key={type} label={type}>
                                {comps.map(c => <option key={c.id} value={c.id}>{c.manufacturer} - {c.model}</option>)}
                            </optgroup>
                        ))}
                    </Select>
                </div>
                <Table headers={['Component', 'Manufacturer', 'Quantity', 'Unit Cost', 'Total Cost', 'Actions']}>
                    {project.components.map(pc => {
                        const component = allComponents.find(c => c.id === pc.componentId);
                        if (!component) return null;
                        return (
                            <tr key={pc.componentId}>
                                <td className="px-4 py-2">{component.model}</td>
                                <td className="px-4 py-2">{component.manufacturer}</td>
                                <td className="px-4 py-2"><Input type="number" min="0" value={pc.quantity} onChange={e => handleComponentQuantityChange(pc.componentId, parseInt(e.target.value))} className="w-20"/></td>
                                <td className="px-4 py-2">{component.cost.toFixed(2)} AED</td>
                                <td className="px-4 py-2">{(component.cost * pc.quantity).toFixed(2)} AED</td>
                                <td className="px-4 py-2">
                                    <Button variant="danger" size="sm" onClick={() => handleComponentQuantityChange(pc.componentId, 0)}><Trash2 size={16}/></Button>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Cost Analysis">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Total Material Cost:</span> <span className="font-semibold">{project.costAnalysis.totalMaterialCost.toFixed(2)} AED</span></div>
                        <div className="flex justify-between items-center"><span className="text-gray-600">Installation Charges:</span> <Input type="number" value={project.costAnalysis.installationCharges} onChange={e => handleCostChange('installationCharges', parseFloat(e.target.value))} className="w-32 text-right" /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-600">Commissioning Charges:</span> <Input type="number" value={project.costAnalysis.commissioningCharges} onChange={e => handleCostChange('commissioningCharges', parseFloat(e.target.value))} className="w-32 text-right" /></div>
                        <div className="flex justify-between items-center"><span className="text-gray-600">Electrical Cost:</span> <Input type="number" value={project.costAnalysis.electricalCost} onChange={e => handleCostChange('electricalCost', parseFloat(e.target.value))} className="w-32 text-right" /></div>
                        <div className="flex justify-between font-bold border-t pt-2 mt-2"><span className="text-gray-800">Total Project Cost:</span> <span>{project.costAnalysis.totalProjectCost.toFixed(2)} AED</span></div>
                    </div>
                </Card>
                <Card title="Pricing & Profitability">
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center"><span className="text-gray-600">Markup %:</span> <Input type="number" value={project.costAnalysis.markupPercentage} onChange={e => handleCostChange('markupPercentage', parseFloat(e.target.value))} className="w-32 text-right" /></div>
                        <div className="flex justify-between"><span className="text-gray-600">Markup Amount:</span> <span className="font-semibold">{project.costAnalysis.markupAmount.toFixed(2)} AED</span></div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span className="text-gray-800">Final Selling Price:</span> <span className="text-green-600">{project.costAnalysis.finalSellingPrice.toFixed(2)} AED</span></div>
                        <div className="flex justify-between text-green-700 font-bold"><span className="text-gray-600">Profit Margin:</span> <span>{project.costAnalysis.profitMargin.toFixed(2)} AED ({project.costAnalysis.profitMarginPercentage.toFixed(2)}%)</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Cost per kW:</span> <span className="font-semibold">{project.costAnalysis.costPerKw.toFixed(2)} AED</span></div>
                    </div>
                </Card>
            </div>
            
            <div className="flex justify-end gap-4 mt-6">
                 <Button variant="secondary" onClick={handleSave}>Save Project</Button>
                 <Button variant="ghost" onClick={handleGenerateInternalPdf}><Printer className="mr-2 h-4 w-4" /> Download Cost Analysis</Button>
                 <Button onClick={handleGenerateQuotePdf}><Printer className="mr-2 h-4 w-4" /> Generate Quotation</Button>
            </div>
            
            {/* Hidden element for PDF generation */}
            <div id="pdf-templates-container" className="fixed -left-[9999px] top-0 space-y-10">
                <QuotationTemplate project={project} allComponents={allComponents}/>
                <InternalCostAnalysisTemplate project={project} allComponents={allComponents} />
            </div>

        </div>
    );
};

const QuotationTemplate = ({ project, allComponents }: { project: Project, allComponents: AnyComponent[] }) => {
    const totalInstallationCost = project.costAnalysis.installationCharges + project.costAnalysis.commissioningCharges + project.costAnalysis.electricalCost;
    const subtotalMaterials = project.costAnalysis.finalSellingPrice - totalInstallationCost;

    return (
    <div id="quotation-template" className="bg-white p-12 w-[800px] text-gray-800 font-sans">
        <header className="flex justify-between items-center border-b-4 border-brand-secondary pb-4">
            <div>
                 <h1 className="text-4xl font-bold text-brand-primary">Solar Oasis</h1>
                 <p className="text-gray-600">Your Partner in Renewable Energy</p>
                 <p className="text-xs text-gray-500 mt-2">solaroasis.ae | +971 4 123 4567</p>
            </div>
            <h2 className="text-3xl font-light text-gray-500">QUOTATION</h2>
        </header>

        <section className="grid grid-cols-2 gap-8 my-8">
            <div>
                <h3 className="font-bold text-gray-500 mb-2">BILLED TO</h3>
                <p className="font-semibold text-lg">{project.client.name}</p>
                <p>{project.client.address}</p>
                <p>{project.client.contact}</p>
            </div>
            <div className="text-right">
                <p><span className="font-bold text-gray-500">Quotation ID:</span> Q-{project.id.slice(0,6).toUpperCase()}</p>
                <p><span className="font-bold text-gray-500">Date:</span> {new Date().toLocaleDateString()}</p>
                 <p><span className="font-bold text-gray-500">Project:</span> {project.name}</p>
            </div>
        </section>

        <section className="my-8">
            <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Project Overview</h3>
            <p>System Capacity: <span className="font-semibold">{project.systemCapacity} kW</span></p>
            <p>Location: <span className="font-semibold">{project.location || project.client.address}</span></p>
        </section>

        <section className="my-8">
            <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Component List</h3>
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-100">
                    <tr><th className="p-2">Item</th><th className="p-2">Description</th><th className="p-2 text-center">Qty</th><th className="p-2 text-right">Unit Price</th><th className="p-2 text-right">Total</th></tr>
                </thead>
                <tbody>
                {project.components.map(pc => {
                    const c = allComponents.find(ac => ac.id === pc.componentId);
                    if (!c) return null;
                    const unitPrice = project.costAnalysis.totalMaterialCost > 0 ? (subtotalMaterials / project.costAnalysis.totalMaterialCost) * c.cost : 0;
                    return (
                        <tr key={c.id} className="border-b">
                            <td className="p-2">{c.type}</td>
                            <td className="p-2">{c.manufacturer} {c.model}</td>
                            <td className="p-2 text-center">{pc.quantity}</td>
                            <td className="p-2 text-right">{unitPrice.toFixed(2)} AED</td>
                            <td className="p-2 text-right">{(unitPrice * pc.quantity).toFixed(2)} AED</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>
        </section>

        <section className="my-8 flex justify-end">
            <div className="w-full md:w-2/3 lg:w-1/2">
                <table className="w-full text-right">
                    <tbody>
                        <tr className="border-t-2">
                            <td className="p-2 font-semibold text-gray-600">Subtotal (Materials):</td>
                            <td className="p-2">{subtotalMaterials.toFixed(2)} AED</td>
                        </tr>
                        <tr>
                            <td className="p-2 font-semibold text-gray-600">Installation & Services:</td>
                            <td className="p-2">{totalInstallationCost.toFixed(2)} AED</td>
                        </tr>
                        <tr className="bg-brand-primary text-white text-lg font-bold">
                            <td className="p-3">Total Amount Due:</td>
                            <td className="p-3">{project.costAnalysis.finalSellingPrice.toFixed(2)} AED</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
        
        <footer className="mt-12 pt-4 border-t text-xs text-gray-500">
            <h4 className="font-bold mb-2">Terms & Conditions</h4>
            <ul className="list-disc list-inside space-y-1">
                <li>This quotation is valid for 30 days from the date of issue.</li>
                <li>Payment terms: 50% upfront, 50% upon project completion.</li>
                <li>All components are subject to availability.</li>
            </ul>
            <p className="mt-8 text-center">Thank you for considering Solar Oasis for your renewable energy needs!</p>
        </footer>
    </div>
    )
};

const InternalCostAnalysisTemplate = ({ project, allComponents }: { project: Project, allComponents: AnyComponent[] }) => {
    return (
        <div id="internal-cost-analysis-template" className="bg-white p-12 w-[800px] text-gray-800 font-sans">
            <header className="flex justify-between items-center border-b-4 border-brand-dark pb-4">
                <div>
                    <h1 className="text-4xl font-bold text-brand-primary">Solar Oasis</h1>
                    <p className="text-gray-600">Internal Document - Confidential</p>
                </div>
                <h2 className="text-3xl font-light text-gray-500">INTERNAL COST ANALYSIS</h2>
            </header>

            <section className="my-8">
                <h3 className="font-bold text-gray-500 mb-2">PROJECT DETAILS</h3>
                <p><strong>Project Name:</strong> {project.name}</p>
                <p><strong>Project ID:</strong> {project.id}</p>
                <p><strong>Client:</strong> {project.client.name}</p>
                <p><strong>System Capacity:</strong> {project.systemCapacity} kW</p>
            </section>

            <section className="my-8">
                <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Cost Breakdown</h3>
                <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-600">Total Material Cost:</span> <span className="font-semibold">{project.costAnalysis.totalMaterialCost.toFixed(2)} AED</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Installation Charges:</span> <span className="font-semibold">{project.costAnalysis.installationCharges.toFixed(2)} AED</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Commissioning Charges:</span> <span className="font-semibold">{project.costAnalysis.commissioningCharges.toFixed(2)} AED</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Electrical Cost:</span> <span className="font-semibold">{project.costAnalysis.electricalCost.toFixed(2)} AED</span></div>
                    <div className="flex justify-between font-bold border-t pt-2 mt-2"><span className="text-gray-800">Total Project Cost (COGS):</span> <span>{project.costAnalysis.totalProjectCost.toFixed(2)} AED</span></div>
                </div>
            </section>

             <section className="my-8">
                <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Pricing & Profitability Analysis</h3>
                 <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-600">Markup Percentage:</span> <span className="font-semibold">{project.costAnalysis.markupPercentage.toFixed(2)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Markup Amount:</span> <span className="font-semibold">{project.costAnalysis.markupAmount.toFixed(2)} AED</span></div>
                    <div className="flex justify-between text-lg font-bold"><span className="text-gray-800">Final Selling Price:</span> <span className="text-green-600">{project.costAnalysis.finalSellingPrice.toFixed(2)} AED</span></div>
                    <div className="flex justify-between text-lg text-green-700 font-bold"><span className="text-gray-800">Gross Profit Margin:</span> <span>{project.costAnalysis.profitMargin.toFixed(2)} AED</span></div>
                    <div className="flex justify-between text-lg text-green-700 font-bold"><span className="text-gray-800">Gross Profit Margin %:</span> <span>{project.costAnalysis.profitMarginPercentage.toFixed(2)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Cost per kW:</span> <span className="font-semibold">{project.costAnalysis.costPerKw.toFixed(2)} AED</span></div>
                </div>
            </section>
            
            <section className="my-8">
                <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Component Details (at cost)</h3>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100">
                        <tr><th className="p-2">Item</th><th className="p-2">Description</th><th className="p-2 text-center">Qty</th><th className="p-2 text-right">Unit Cost</th><th className="p-2 text-right">Total Cost</th></tr>
                    </thead>
                    <tbody>
                    {project.costAnalysis.componentCosts.map(pc => {
                        const c = allComponents.find(ac => ac.id === pc.componentId);
                        if (!c) return null;
                        return (
                            <tr key={c.id} className="border-b">
                                <td className="p-2">{c.type}</td>
                                <td className="p-2">{c.manufacturer} {c.model}</td>
                                <td className="p-2 text-center">{pc.quantity}</td>
                                <td className="p-2 text-right">{pc.cost.toFixed(2)} AED</td>
                                <td className="p-2 text-right">{(pc.cost * pc.quantity).toFixed(2)} AED</td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </section>

            <footer className="mt-12 pt-4 border-t text-xs text-gray-500 text-center">
                Generated on {new Date().toLocaleString()}
            </footer>
        </div>
    );
};

export default ProjectsPage;