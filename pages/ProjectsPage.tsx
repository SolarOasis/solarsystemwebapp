import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { Project, AnyComponent, ClientInfo, ProjectComponent, CostAnalysis, ComponentTypes } from '../types';
import { Card, Button, Table, Input, Select } from '../components/ui';
import { Plus, ArrowLeft, Trash2, Copy, CloudUpload, ChevronsRight, Sun } from 'lucide-react';
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
    const { addProject, duplicateProject, deleteProject } = useContext(AppContext);
    
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
                componentCosts: [], 
                totalMaterialCost: 0,
                totalProjectCost: 0, 
                finalSellingPrice: 0,
                profitMargin: 0, 
                profitMarginPercentage: 0, 
                costPerKw: 0, 
                markupAmount: 0, // Deprecated
            }
        };
        const newProject = await addProject(newProjectData);
        if (newProject) {
            navigate(`/projects/${newProject.id}`);
        } else {
            alert("Failed to create a new project. Please try again.");
        }
    };

    const handleDeleteProject = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this project?')) {
            deleteProject(id);
        }
    }
    
    const handleDuplicateProject = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to duplicate this project? This will create a copy with all components and costs.')) {
            duplicateProject(id);
        }
    }


    return (
        <Card title="Projects" actions={<Button onClick={handleCreateProject}><Plus className="mr-2 h-4 w-4" /> New Project</Button>}>
            <Table headers={['Project Name', 'Client', 'System Capacity (kW)', 'Status', 'Selling Price', 'Actions']}>
                {projects.map(project => (
                    <tr key={project.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/projects/${project.id}`)}>
                        <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{project.name}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{project.client.name}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{project.systemCapacity} kW</td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                project.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {project.status}
                            </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{project.costAnalysis.finalSellingPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} AED</td>
                        <td className="whitespace-nowrap px-4 py-2">
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={(e) => handleDuplicateProject(e, project.id)} title="Duplicate Project"><Copy size={16} /></Button>
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => handleDeleteProject(e, project.id)} title="Delete Project"><Trash2 size={16} /></Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

const ProjectDetails = ({ project: initialProject }: { project: Project }) => {
    const navigate = useNavigate();
    const { state, updateProject, savePdfToDrive } = useContext(AppContext);
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
        const totalMaterialCost = proj.components.reduce((acc, item) => acc + (item.costAtTimeOfAdd * item.quantity), 0);

        const totalProjectCost = totalMaterialCost + 
            (proj.costAnalysis.installationCharges || 0) + 
            (proj.costAnalysis.commissioningCharges || 0) + 
            (proj.costAnalysis.electricalCost || 0);

        const totalComponentSellingPrice = proj.components.reduce((acc, item) => acc + ((item.sellingPrice ?? item.costAtTimeOfAdd) * item.quantity), 0);
        
        const installationSellingPrice = proj.costAnalysis.installationSellingPrice ?? proj.costAnalysis.installationCharges ?? 0;
        const commissioningSellingPrice = proj.costAnalysis.commissioningSellingPrice ?? proj.costAnalysis.commissioningCharges ?? 0;
        const electricalSellingPrice = proj.costAnalysis.electricalSellingPrice ?? proj.costAnalysis.electricalCost ?? 0;
        
        const finalSellingPrice = totalComponentSellingPrice + installationSellingPrice + commissioningSellingPrice + electricalSellingPrice;

        const profitMargin = finalSellingPrice - totalProjectCost;
        const profitMarginPercentage = finalSellingPrice > 0 ? (profitMargin / finalSellingPrice) * 100 : 0;
        const costPerKw = proj.systemCapacity > 0 ? finalSellingPrice / proj.systemCapacity : 0;

        return {
            ...proj,
            costAnalysis: {
                ...proj.costAnalysis,
                totalMaterialCost,
                totalProjectCost,
                finalSellingPrice,
                profitMargin,
                profitMarginPercentage,
                costPerKw,
                installationSellingPrice,
                commissioningSellingPrice,
                electricalSellingPrice
            }
        };
    };

    useEffect(() => {
      setProject(recalculateCosts(initialProject));
    }, [initialProject]);


    const handleProjectInfoChange = <K extends keyof Project>(key: K, value: Project[K]) => {
        setProject(prev => ({ ...prev, [key]: value }));
    };

    const handleClientChange = <K extends keyof ClientInfo>(key: K, value: ClientInfo[K]) => {
        setProject(prev => ({ ...prev, client: { ...prev.client, [key]: value } }));
    };
    
    const handleCostInputChange = <K extends keyof CostAnalysis>(key: K, value: string) => {
        const parsedValue = value === '' ? undefined : parseFloat(value);
        setProject(prev => ({ ...prev, costAnalysis: { ...prev.costAnalysis, [key]: parsedValue } }));
    };

    const addComponentToProject = (componentId: string) => {
        if (!componentId) return;
        const componentToAdd = allComponents.find(c => c.id === componentId);
        if (!componentToAdd) return;
        
        const existing = project.components.find(c => c.componentId === componentId);
        if (existing) {
            handleComponentQuantityChange(componentId, existing.quantity + 1);
        } else {
            const newProjectComponent: ProjectComponent = {
                componentId,
                quantity: 1,
                costAtTimeOfAdd: componentToAdd.cost || 0,
                sellingPrice: componentToAdd.cost || 0,
            };
            const newComponents = [...project.components, newProjectComponent];
            setProject(prev => ({...prev, components: newComponents}));
        }
    };
    
    const handleComponentQuantityChange = (componentId: string, quantity: number) => {
        let newComponents: ProjectComponent[];
        if (quantity <= 0) {
            newComponents = project.components.filter(c => c.componentId !== componentId);
        } else {
            newComponents = project.components.map(c => c.componentId === componentId ? { ...c, quantity: quantity } : c);
        }
        setProject(prev => ({...prev, components: newComponents}));
    };
    
    const handleComponentSellingPriceChange = (componentId: string, price: number) => {
        const newComponents = project.components.map(c => 
            c.componentId === componentId ? { ...c, sellingPrice: isNaN(price) ? 0 : price } : c
        );
        setProject(prev => ({...prev, components: newComponents}));
    }

    const handleApplyMarkup = () => {
        const markup = (project.costAnalysis.markupPercentage || 0) / 100;
        
        const updatedComponents = project.components.map(pc => ({
            ...pc,
            sellingPrice: pc.costAtTimeOfAdd * (1 + markup)
        }));
        
        const updatedCostAnalysis: CostAnalysis = {
            ...project.costAnalysis,
            installationSellingPrice: (project.costAnalysis.installationCharges || 0) * (1 + markup),
            commissioningSellingPrice: (project.costAnalysis.commissioningCharges || 0) * (1 + markup),
            electricalSellingPrice: (project.costAnalysis.electricalCost || 0) * (1 + markup),
        };
        
        setProject(prev => ({
            ...prev,
            components: updatedComponents,
            costAnalysis: updatedCostAnalysis
        }));
    };

    const handleSave = () => {
        const finalProjectState = recalculateCosts(project);
        updateProject(finalProjectState);
        alert("Project saved!");
    };
    
    const generateAndSavePdf = async (elementId: string, fileName: string, folderName: string) => {
        const finalProjectState = recalculateCosts(project);
        setProject(finalProjectState);

        await new Promise(resolve => setTimeout(resolve, 100));

        const element = document.getElementById(elementId);
        if (element) {
            const canvas = await html2canvas(element, { scale: 2 });
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), canvas.height * pdf.internal.pageSize.getWidth() / canvas.width);
            
            const base64String = pdf.output('datauristring');
            const base64Data = base64String.substring(base64String.indexOf(',') + 1);
            
            const result = await savePdfToDrive(fileName, folderName, base64Data);
            if (result && result.fileUrl) {
                window.open(result.fileUrl, '_blank');
            }
        }
    };

    const handleGenerateQuotePdf = () => generateAndSavePdf('quotation-template', `Quotation-${project.name.replace(/ /g, '_')}.pdf`, 'Quotations');
    const handleGenerateInternalPdf = () => generateAndSavePdf('internal-cost-analysis-template', `Cost-Analysis-${project.name.replace(/ /g, '_')}.pdf`, 'Internal Cost Analysis');
    
    useEffect(() => {
      const newProject = recalculateCosts(project);
      if (JSON.stringify(newProject) !== JSON.stringify(project)) {
        setProject(newProject);
      }
    }, [project.components, project.costAnalysis.installationCharges, project.costAnalysis.commissioningCharges, project.costAnalysis.electricalCost, project.costAnalysis.installationSellingPrice, project.costAnalysis.commissioningSellingPrice, project.costAnalysis.electricalSellingPrice, project.systemCapacity]);

    const totalComponentSellingPrice = project.components.reduce((acc, pc) => acc + ((pc.sellingPrice ?? pc.costAtTimeOfAdd) * pc.quantity), 0);

    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => navigate('/projects')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects</Button>
            <Card title="Project Details">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Input label="Project Name" value={project.name} onChange={e => handleProjectInfoChange('name', e.target.value)} />
                     <Select label="Project Status" value={project.status} onChange={e => handleProjectInfoChange('status', e.target.value as Project['status'])} >
                        <option value="Planning">Planning</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </Select>
                    <Input label="System Capacity (kW)" type="number" value={project.systemCapacity} onChange={e => handleProjectInfoChange('systemCapacity', parseFloat(e.target.value))} />
                    <Input label="Client Name" value={project.client.name} onChange={e => handleClientChange('name', e.target.value)} />
                    <Input label="Client Contact" value={project.client.contact} onChange={e => handleClientChange('contact', e.target.value)} />
                    <Input label="Client Address" value={project.client.address} onChange={e => handleClientChange('address', e.target.value)} />
                </div>
            </Card>

            <Card title="Component Selection & Pricing">
                <div className="flex items-end gap-2 mb-4">
                    <Select label="Add Component" onChange={e => addComponentToProject(e.target.value)} value="">
                        <option value="" disabled>Select a component to add...</option>
                        {Object.entries(componentsByType).map(([type, comps]) => (
                            <optgroup key={type} label={type}>
                                {comps.map(c => <option key={c.id} value={c.id}>{c.manufacturer} - {c.model}</option>)}
                            </optgroup>
                        ))}
                    </Select>
                </div>
                <Table headers={['Component', 'Qty', 'Unit Cost', 'Unit Selling Price', 'Total Selling Price', 'Actions']}>
                    {project.components.map(pc => {
                        const component = allComponents.find(c => c.id === pc.componentId);
                        if (!component) return null;
                        const sellingPrice = pc.sellingPrice ?? pc.costAtTimeOfAdd;
                        return (
                            <tr key={pc.componentId}>
                                <td className="px-4 py-2 text-sm">{component.manufacturer} {component.model}</td>
                                <td className="px-4 py-2"><Input type="number" min="0" value={pc.quantity} onChange={e => handleComponentQuantityChange(pc.componentId, parseInt(e.target.value))} className="w-20"/></td>
                                <td className="px-4 py-2">{pc.costAtTimeOfAdd.toFixed(2)} AED</td>
                                <td className="px-4 py-2"><Input type="number" min="0" step="0.01" value={sellingPrice.toFixed(2)} onChange={e => handleComponentSellingPriceChange(pc.componentId, parseFloat(e.target.value))} className="w-28"/></td>
                                <td className="px-4 py-2 font-semibold">{(sellingPrice * pc.quantity).toFixed(2)} AED</td>
                                <td className="px-4 py-2">
                                    <Button variant="danger" size="sm" onClick={() => handleComponentQuantityChange(pc.componentId, 0)}><Trash2 size={16}/></Button>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card title="Costs & Markup">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 items-center text-sm">
                            <span className="text-gray-600 font-bold">Total Material Cost:</span> 
                            <span className="font-bold text-right">{project.costAnalysis.totalMaterialCost.toFixed(2)} AED</span>
                            
                            <span className="text-gray-600">Installation Charges Cost:</span> 
                            <Input type="number" value={project.costAnalysis.installationCharges || ''} onChange={e => handleCostInputChange('installationCharges', e.target.value)} className="w-full text-right" placeholder="e.g., 1500"/>
                            
                            <span className="text-gray-600">Commissioning Charges Cost:</span> 
                            <Input type="number" value={project.costAnalysis.commissioningCharges || ''} onChange={e => handleCostInputChange('commissioningCharges', e.target.value)} className="w-full text-right" placeholder="e.g., 500"/>
                            
                            <span className="text-gray-600">Electrical Cost:</span> 
                            <Input type="number" value={project.costAnalysis.electricalCost || ''} onChange={e => handleCostInputChange('electricalCost', e.target.value)} className="w-full text-right" placeholder="e.g., 800"/>
                            
                            <div className="col-span-2 border-t mt-2 pt-2"></div>
                            
                            <span className="text-gray-800 font-bold text-lg">Total Project Cost (COGS):</span> 
                            <span className="font-bold text-lg text-right">{project.costAnalysis.totalProjectCost.toFixed(2)} AED</span>
                        </div>
                        <div className="grid grid-cols-2 items-end gap-4 pt-4 border-t">
                            <Input label="Markup %" type="number" value={project.costAnalysis.markupPercentage || ''} onChange={e => handleCostInputChange('markupPercentage', e.target.value)} placeholder="e.g., 25" />
                            <Button onClick={handleApplyMarkup} variant="secondary"><ChevronsRight className="mr-2 h-4 w-4"/> Apply Markup</Button>
                        </div>
                    </div>
                </Card>
                <Card title="Selling Prices & Profitability">
                     <div className="grid grid-cols-2 gap-y-2 gap-x-4 items-center text-sm">
                         <span className="text-gray-600">Total Components Selling Price:</span>
                         <span className="font-semibold text-right">{totalComponentSellingPrice.toFixed(2)} AED</span>

                         <span className="text-gray-600">Installation Selling Price:</span> 
                         <Input type="number" min="0" value={(project.costAnalysis.installationSellingPrice ?? '')} onChange={e => handleCostInputChange('installationSellingPrice', e.target.value)} className="w-full text-right" placeholder="e.g., 2000"/>
                         
                         <span className="text-gray-600">Commissioning Selling Price:</span> 
                         <Input type="number" min="0" value={(project.costAnalysis.commissioningSellingPrice ?? '')} onChange={e => handleCostInputChange('commissioningSellingPrice', e.target.value)} className="w-full text-right" placeholder="e.g., 750"/>
                         
                         <span className="text-gray-600">Electrical Selling Price:</span> 
                         <Input type="number" min="0" value={(project.costAnalysis.electricalSellingPrice ?? '')} onChange={e => handleCostInputChange('electricalSellingPrice', e.target.value)} className="w-full text-right" placeholder="e.g., 1000"/>
                         
                         <div className="col-span-2 border-t mt-2 pt-2"></div>

                        <span className="text-gray-800 font-bold text-lg">Final Selling Price:</span> 
                        <span className="text-green-600 font-bold text-lg text-right">{project.costAnalysis.finalSellingPrice.toFixed(2)} AED</span>
                        
                        <div className="col-span-2 border-t mt-2 pt-2"></div>

                        <span className="text-gray-600 font-bold">Gross Profit (Markup):</span> 
                        <span className="text-green-700 font-bold text-right">{project.costAnalysis.profitMargin.toFixed(2)} AED</span>
                        
                        <span className="text-gray-600 font-bold">Gross Profit Margin %:</span> 
                        <span className="text-green-700 font-bold text-right">{project.costAnalysis.profitMarginPercentage.toFixed(2)}%</span>
                        
                        <div className="col-span-2 border-t mt-2 pt-2"></div>
                        
                        <span className="text-gray-600">Cost per kW:</span> 
                        <span className="font-semibold text-right">{project.costAnalysis.costPerKw.toFixed(2)} AED</span>
                    </div>
                </Card>
            </div>
            
            <div className="flex justify-end gap-4 mt-6">
                 <Button variant="secondary" onClick={handleSave}>Save Project</Button>
                 <Button variant="ghost" onClick={handleGenerateInternalPdf}><CloudUpload className="mr-2 h-4 w-4" /> Save Analysis to Drive</Button>
                 <Button onClick={handleGenerateQuotePdf}><CloudUpload className="mr-2 h-4 w-4" /> Save Quote to Drive</Button>
            </div>
            
            <div className="fixed -left-[9999px] top-0 space-y-10">
                <QuotationTemplate project={project} allComponents={allComponents} />
                <InternalCostAnalysisTemplate project={project} allComponents={allComponents} />
            </div>

        </div>
    );
};

const QuotationTemplate = ({ project, allComponents }: { project: Project, allComponents: AnyComponent[] }) => {
    const { costAnalysis, components } = project;
    const totalComponentSellingPrice = components.reduce((acc, pc) => acc + ((pc.sellingPrice ?? pc.costAtTimeOfAdd) * pc.quantity), 0);
    const totalServicesSellingPrice = (costAnalysis.installationSellingPrice ?? costAnalysis.installationCharges ?? 0) + 
                                      (costAnalysis.commissioningSellingPrice ?? costAnalysis.commissioningCharges ?? 0) + 
                                      (costAnalysis.electricalSellingPrice ?? costAnalysis.electricalCost ?? 0);
    
    return (
    <div id="quotation-template" className="bg-white p-12 w-[800px] text-gray-800 font-sans">
        <header className="flex justify-between items-start border-b-4 border-brand-secondary pb-4">
            <div className="flex items-center gap-4">
                 <Sun className="h-16 w-16 text-brand-secondary" />
                 <div>
                     <h1 className="text-4xl font-bold text-brand-primary">solaroasis.ae</h1>
                     <p className="text-gray-600">Your Partner in Renewable Energy</p>
                 </div>
            </div>
            <h2 className="text-3xl font-light text-gray-500 mt-2">QUOTATION</h2>
        </header>

        <section className="grid grid-cols-2 gap-8 my-8 text-sm">
            <div>
                <h3 className="font-bold text-gray-500 mb-2 tracking-wider">BILLED TO</h3>
                <p className="font-semibold text-base text-gray-800">{project.client.name}</p>
                <p>{project.client.address}</p>
                <p>{project.client.contact}</p>
            </div>
            <div className="text-right">
                <div className="grid grid-cols-2">
                  <span className="font-bold text-gray-500">Quotation ID:</span>
                  <span>Q-{project.id.slice(0,6).toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-2">
                  <span className="font-bold text-gray-500">Date:</span> 
                  <span>{new Date().toLocaleDateString('en-GB')}</span>
                </div>
                 <div className="grid grid-cols-2">
                  <span className="font-bold text-gray-500">Project:</span> 
                  <span>{project.name}</span>
                </div>
            </div>
        </section>

        <section className="my-8">
            <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">System Components & Services</h3>
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-100">
                    <tr><th className="p-2 font-semibold">Item Description</th><th className="p-2 text-center font-semibold">Qty</th><th className="p-2 text-right font-semibold">Unit Price</th><th className="p-2 text-right font-semibold">Total Price</th></tr>
                </thead>
                <tbody>
                {components.map(pc => {
                    const component = allComponents.find(c => c.id === pc.componentId);
                    const componentName = component ? `${component.manufacturer} ${component.model}` : pc.componentId;
                    const sellingPrice = pc.sellingPrice ?? pc.costAtTimeOfAdd;
                    return (
                        <tr key={pc.componentId} className="border-b">
                            <td className="p-2">{componentName}</td>
                            <td className="p-2 text-center">{pc.quantity}</td>
                            <td className="p-2 text-right">{sellingPrice.toFixed(2)} AED</td>
                            <td className="p-2 text-right">{(sellingPrice * pc.quantity).toFixed(2)} AED</td>
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
                            <td className="p-2">{totalComponentSellingPrice.toFixed(2)} AED</td>
                        </tr>
                        <tr>
                            <td className="p-2 font-semibold text-gray-600">Installation & Services:</td>
                            <td className="p-2">{totalServicesSellingPrice.toFixed(2)} AED</td>
                        </tr>
                        <tr className="bg-brand-primary text-white text-lg font-bold">
                            <td className="p-3">Total Amount Due:</td>
                            <td className="p-3">{costAnalysis.finalSellingPrice.toFixed(2)} AED</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
        
        <footer className="mt-12 pt-4 border-t text-xs text-gray-500">
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                    <h4 className="font-bold mb-2 text-gray-600">Terms & Conditions</h4>
                    <p className="text-xs">
                        1. Payment Terms: 50% advance to confirm order, 50% upon project completion and before commissioning. <br />
                        2. This quotation is valid for fifteen (15) days from the date of issue. <br />
                        3. All components are subject to availability. Any changes will be communicated and agreed upon.
                    </p>
                </div>
                <div>
                    <h4 className="font-bold mb-1 text-gray-600">Bank Details</h4>
                    <p className="text-xs">
                        <strong>Bank Name:</strong> Emirates NBD <br/>
                        <strong>Account Name:</strong> Solar Oasis FZCO <br/>
                        <strong>IBAN:</strong> AEXXXXXXXXXXXXXXXXXXXXX <br/>
                        <strong>TRN:</strong> 100XXXXXXX
                    </p>
                </div>
            </div>
            <div className="text-center mt-8">
                 <p>Solar Oasis FZCO | Al Rashidiya 1, Ajman, UAE | +971 4 123 4567 | info@solaroasis.ae | www.solaroasis.ae</p>
            </div>
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
                <p><strong>Client:</strong> {project.client.name}</p>
            </section>
            
            <section className="my-8 grid grid-cols-2 gap-8">
                <div>
                  <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Cost Breakdown</h3>
                  <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Total Material Cost:</span> <span className="font-semibold">{project.costAnalysis.totalMaterialCost.toFixed(2)} AED</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Installation Charges:</span> <span className="font-semibold">{(project.costAnalysis.installationCharges || 0).toFixed(2)} AED</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Commissioning Charges:</span> <span className="font-semibold">{(project.costAnalysis.commissioningCharges || 0).toFixed(2)} AED</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Electrical Cost:</span> <span className="font-semibold">{(project.costAnalysis.electricalCost || 0).toFixed(2)} AED</span></div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span className="text-gray-800">Total Project Cost (COGS):</span> <span>{project.costAnalysis.totalProjectCost.toFixed(2)} AED</span></div>
                  </div>
                </div>
                 <div>
                    <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Pricing & Profitability</h3>
                     <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Final Selling Price:</span> <span className="font-semibold">{project.costAnalysis.finalSellingPrice.toFixed(2)} AED</span></div>
                        <div className="flex justify-between font-bold text-green-700 border-t pt-2 mt-2"><span className="text-gray-600">Gross Profit (Markup):</span> <span>{project.costAnalysis.profitMargin.toFixed(2)} AED</span></div>
                        <div className="flex justify-between font-bold text-green-700"><span className="text-gray-800">Gross Profit Margin %:</span> <span>{project.costAnalysis.profitMarginPercentage.toFixed(2)}%</span></div>
                    </div>
                </div>
            </section>

             <section className="my-8">
                <h3 className="font-bold text-brand-primary border-b-2 border-gray-200 pb-2 mb-2">Component Details (Cost vs. Sell)</h3>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100">
                        <tr><th className="p-2">Item</th><th className="p-2 text-center">Qty</th><th className="p-2 text-right">Unit Cost</th><th className="p-2 text-right">Unit Sell</th><th className="p-2 text-right">Total Cost</th><th className="p-2 text-right">Total Sell</th></tr>
                    </thead>
                    <tbody>
                    {project.components.map(pc => {
                        const component = allComponents.find(c => c.id === pc.componentId);
                        const componentName = component ? `${component.manufacturer} ${component.model}` : pc.componentId;
                        const sellingPrice = pc.sellingPrice ?? pc.costAtTimeOfAdd;
                        return (
                            <tr key={pc.componentId} className="border-b">
                                <td className="p-2">{componentName}</td>
                                <td className="p-2 text-center">{pc.quantity}</td>
                                <td className="p-2 text-right">{pc.costAtTimeOfAdd.toFixed(2)}</td>
                                <td className="p-2 text-right font-semibold text-green-700">{sellingPrice.toFixed(2)}</td>
                                <td className="p-2 text-right">{(pc.costAtTimeOfAdd * pc.quantity).toFixed(2)}</td>
                                <td className="p-2 text-right font-semibold">{(sellingPrice * pc.quantity).toFixed(2)}</td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default ProjectsPage;