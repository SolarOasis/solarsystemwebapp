
import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { AnyComponent, ComponentTypes, ComponentType, SolarPanel, Inverter, Battery, MountingSystem, Cable, MonitoringSystem, Supplier, ElectricCharger } from '../types';
import { Card, Button, Table, Modal, Input, Select } from '../components/ui';
import { Plus, Edit, Trash2, Upload, Download, Loader } from 'lucide-react';

interface ComponentFormProps {
    component?: AnyComponent;
    onSave: (data: Partial<AnyComponent>) => void;
    componentType: ComponentType;
    suppliers: Supplier[];
}

const ComponentForm: React.FC<ComponentFormProps> = ({ component, onSave, componentType, suppliers }) => {
    const getInitialState = (): Partial<AnyComponent> => {
        if (component) return component;

        return {
            type: componentType,
            supplierId: suppliers.length > 0 ? suppliers[0].id : '',
        };
    };
    
    const [formData, setFormData] = useState<Partial<AnyComponent>>(getInitialState());

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = e.target.getAttribute('type') === 'number';
        const parsedValue = isNumeric ? (value === '' ? undefined : parseFloat(value)) : value;
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const renderSpecificFields = () => {
        const data = formData;
        switch (data.type) {
            case ComponentTypes.SolarPanel:
                const panel = data as Partial<SolarPanel>;
                return <>
                    <Input label="Wattage (W)" name="wattage" type="number" value={panel.wattage || ''} placeholder="e.g., 450" onChange={handleChange} />
                    <Input label="Efficiency (%)" name="efficiency" type="number" step="0.1" value={panel.efficiency || ''} placeholder="e.g., 21.5" onChange={handleChange} />
                    <Input label="Warranty (years)" name="warranty" type="number" value={panel.warranty || ''} placeholder="e.g., 25" onChange={handleChange} />
                    <Input label="Technology" name="technology" value={panel.technology || ''} placeholder="e.g., Monocrystalline" onChange={handleChange} />
                </>;
            case ComponentTypes.Inverter:
                const inverter = data as Partial<Inverter>;
                return <>
                    <Input label="Capacity (kW)" name="capacity" type="number" step="0.1" value={inverter.capacity || ''} placeholder="e.g., 5" onChange={handleChange} />
                    <Select label="Inverter Type" name="inverterType" value={inverter.inverterType || ''} onChange={handleChange}>
                        <option value="" disabled>Select a type...</option>
                        <option value="String">String</option>
                        <option value="Central">Central</option>
                        <option value="Micro">Micro</option>
                    </Select>
                    <Input label="Efficiency (%)" name="efficiency" type="number" step="0.1" value={inverter.efficiency || ''} placeholder="e.g., 98.5" onChange={handleChange} />
                    <Input label="MPPT Channels" name="mpptChannels" type="number" value={inverter.mpptChannels || ''} placeholder="e.g., 2" onChange={handleChange} />
                </>;
             case ComponentTypes.Battery:
                const battery = data as Partial<Battery>;
                return <>
                    <Input label="Capacity (kWh)" name="capacity" type="number" step="0.1" value={battery.capacity || ''} placeholder="e.g., 10" onChange={handleChange} />
                    <Select label="Battery Type" name="batteryType" value={battery.batteryType || ''} onChange={handleChange}>
                         <option value="" disabled>Select a type...</option>
                        <option value="Lithium">Lithium</option>
                        <option value="Lead-acid">Lead-acid</option>
                    </Select>
                    <Input label="Warranty (years)" name="warranty" type="number" value={battery.warranty || ''} placeholder="e.g., 10" onChange={handleChange} />
                    <Input label="Depth of Discharge (%)" name="depthOfDischarge" type="number" value={battery.depthOfDischarge || ''} placeholder="e.g., 95" onChange={handleChange} />
                </>;
            case ComponentTypes.ElectricCharger:
                const charger = data as Partial<ElectricCharger>;
                return <>
                    <Input label="Charging Speed (kW)" name="chargingSpeed" type="number" step="0.1" value={charger.chargingSpeed || ''} placeholder="e.g., 11" onChange={handleChange} />
                    <Select label="Connector Type" name="connectorType" value={charger.connectorType || ''} onChange={handleChange}>
                        <option value="" disabled>Select a type...</option>
                        <option value="Type 1">Type 1</option>
                        <option value="Type 2">Type 2</option>
                        <option value="CCS">CCS</option>
                        <option value="CHAdeMO">CHAdeMO</option>
                    </Select>
                </>;
            default:
                return null;
        }
    };

    return (
        <form id="component-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Manufacturer" name="manufacturer" value={formData.manufacturer || ''} placeholder="e.g., Panasonic" onChange={handleChange} required className="md:col-span-1" />
            <Input label="Model" name="model" value={formData.model || ''} placeholder="e.g., EverVolt H" onChange={handleChange} required className="md:col-span-1" />
            <Input label="Cost (per unit)" name="cost" type="number" step="0.01" value={formData.cost || ''} placeholder="e.g., 1200" onChange={handleChange} required />
            <Select label="Supplier" name="supplierId" value={formData.supplierId || ''} onChange={handleChange} required>
                <option value="" disabled>Select a supplier...</option>
                {suppliers.length === 0 && <option disabled>No suppliers available</option>}
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {renderSpecificFields()}
        </form>
    );
};

// --- START: Bulk Import Components ---

const ImportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    suppliers: Supplier[];
    addComponent: (component: Omit<AnyComponent, 'id'>, disableLoading?: boolean) => Promise<AnyComponent | undefined>;
}> = ({ isOpen, onClose, suppliers, addComponent }) => {
    const [componentsToImport, setComponentsToImport] = useState<Omit<AnyComponent, 'id'>[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState('');

    const resetState = () => {
        setComponentsToImport([]);
        setIsImporting(false);
        setImportProgress({ current: 0, total: 0 });
        setError('');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleDownloadTemplate = () => {
        const headers = "type,manufacturer,model,cost,supplierId,wattage,efficiency,warranty,technology,capacity,inverterType,mpptChannels,batteryType,depthOfDischarge,chargingSpeed,connectorType";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "component_import_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            try {
                const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    setError("CSV must contain a header row and at least one data row.");
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const requiredHeaders = ['type', 'manufacturer', 'model', 'cost', 'supplierId'];
                if (!requiredHeaders.every(h => headers.includes(h))) {
                    setError(`CSV must contain the following headers: ${requiredHeaders.join(', ')}`);
                    return;
                }

                const parsedComponents = lines.slice(1).map((line, index) => {
                    const values = line.split(',');
                    const obj: any = {};
                    headers.forEach((header, i) => {
                        const value = values[i]?.trim() || '';
                        // Convert numeric fields from string
                        if (['cost', 'wattage', 'efficiency', 'warranty', 'capacity', 'mpptChannels', 'depthOfDischarge', 'chargingSpeed'].includes(header)) {
                             obj[header] = value ? parseFloat(value) : undefined;
                        } else {
                            obj[header] = value;
                        }
                    });

                    if (!Object.values(ComponentTypes).includes(obj.type)) {
                       throw new Error(`Invalid component type "${obj.type}" on row ${index + 2}.`);
                    }
                     if (!suppliers.some(s => s.id === obj.supplierId)) {
                       throw new Error(`Invalid supplierId "${obj.supplierId}" on row ${index + 2}. Please use a valid ID from the Suppliers tab.`);
                    }

                    return obj as Omit<AnyComponent, 'id'>;
                });
                
                setError('');
                setComponentsToImport(parsedComponents);

            } catch (err) {
                 const message = err instanceof Error ? err.message : 'An unknown error occurred during parsing.';
                 setError(`Parsing Error: ${message}`);
                 setComponentsToImport([]);
            }
        };
        reader.readAsText(file);
    };

    const handleStartImport = async () => {
        setIsImporting(true);
        setImportProgress({ current: 0, total: componentsToImport.length });

        for (const component of componentsToImport) {
            await addComponent(component, true);
            setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }

        alert(`Successfully imported ${componentsToImport.length} components!`);
        handleClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Components">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Import multiple components quickly by uploading a CSV file.
                </p>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800">Instructions:</h4>
                    <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
                        <li>Download the CSV template.</li>
                        <li>Open the file in Excel or Google Sheets and fill in your component data. The `type` must exactly match one of these: `{Object.values(ComponentTypes).join(', ')}`. The `supplierId` must be a valid ID from the Suppliers page.</li>
                        <li>Save the file and upload it below.</li>
                    </ol>
                </div>
                <Button onClick={handleDownloadTemplate} variant="ghost">
                    <Download className="mr-2 h-4 w-4" /> Download CSV Template
                </Button>
                <Input type="file" accept=".csv" onChange={handleFileChange} />

                {error && <p className="text-red-600 text-sm">{error}</p>}
                
                {componentsToImport.length > 0 && !error && (
                    <div className="text-green-700 text-sm">
                        Successfully parsed {componentsToImport.length} components. Ready to import.
                    </div>
                )}
                
                {isImporting && (
                    <div className="flex items-center gap-2">
                        <Loader className="animate-spin h-5 w-5" />
                        <p>Importing... {importProgress.current} / {importProgress.total}</p>
                    </div>
                )}
            </div>
             <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={handleClose} disabled={isImporting}>Cancel</Button>
                <Button
                    onClick={handleStartImport}
                    disabled={componentsToImport.length === 0 || isImporting || !!error}
                >
                    <Upload className="mr-2 h-4 w-4" /> Start Import
                </Button>
            </div>
        </Modal>
    );
};

// --- END: Bulk Import Components ---

const componentTypeConfig = {
    [ComponentTypes.SolarPanel]: {
        headers: ['Manufacturer', 'Model', 'Wattage', 'Efficiency', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: SolarPanel) => (
            <>
                <td className="px-4 py-2">{c.wattage || 'N/A'}W</td>
                <td className="px-4 py-2">{c.efficiency || 'N/A'}%</td>
            </>
        )
    },
    [ComponentTypes.Inverter]: {
        headers: ['Manufacturer', 'Model', 'Capacity (kW)', 'Type', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: Inverter) => (
            <>
                <td className="px-4 py-2">{c.capacity || 'N/A'}kW</td>
                <td className="px-4 py-2">{c.inverterType || 'N/A'}</td>
            </>
        )
    },
    [ComponentTypes.Battery]: {
        headers: ['Manufacturer', 'Model', 'Capacity (kWh)', 'Type', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: Battery) => (
            <>
                <td className="px-4 py-2">{c.capacity || 'N/A'}kWh</td>
                <td className="px-4 py-2">{c.batteryType || 'N/A'}</td>
            </>
        )
    },
    [ComponentTypes.MountingSystem]: {
        headers: ['Manufacturer', 'Model', 'Type', 'Material', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: MountingSystem) => (
            <>
                <td className="px-4 py-2">{c.mountingType || 'N/A'}</td>
                <td className="px-4 py-2">{c.material || 'N/A'}</td>
            </>
        )
    },
    [ComponentTypes.Cable]: {
        headers: ['Manufacturer', 'Model', 'Type', 'Cross-section', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: Cable) => (
            <>
                <td className="px-4 py-2">{c.cableType || 'N/A'}</td>
                <td className="px-4 py-2">{c.crossSection ? `${c.crossSection} mm²` : 'N/A'}</td>
            </>
        )
    },
    [ComponentTypes.MonitoringSystem]: {
        headers: ['Manufacturer', 'Model', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: MonitoringSystem) => <></>
    },
    [ComponentTypes.ElectricCharger]: {
        headers: ['Manufacturer', 'Model', 'Speed (kW)', 'Connector', 'Cost', 'Supplier', 'Actions'],
        renderCells: (c: ElectricCharger) => (
            <>
                <td className="px-4 py-2">{c.chargingSpeed || 'N/A'}kW</td>
                <td className="px-4 py-2">{c.connectorType || 'N/A'}</td>
            </>
        )
    },
};


const ComponentsPage = () => {
    const { state, addComponent, updateComponent, deleteComponent } = useContext(AppContext);
    const { components, suppliers } = state;
    const [activeTab, setActiveTab] = useState<ComponentType>(ComponentTypes.SolarPanel);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingComponent, setEditingComponent] = useState<AnyComponent | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');

    const openModal = (component?: AnyComponent) => {
        setEditingComponent(component);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingComponent(undefined);
        setIsModalOpen(false);
    };

    const handleSave = (data: Partial<AnyComponent>) => {
        if (editingComponent) {
            updateComponent({ ...editingComponent, ...data } as AnyComponent);
        } else {
            if (!data.type) data.type = activeTab;
            addComponent(data as Omit<AnyComponent, 'id'>);
        }
        closeModal();
    };

    const handleDelete = (component: AnyComponent) => {
        if (window.confirm('Are you sure you want to delete this component?')) {
            deleteComponent({id: component.id, type: component.type});
        }
    };

    const filteredComponents = useMemo(() => components
        .filter(c => c.type === activeTab)
        .filter(c =>
            c.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.model.toLowerCase().includes(searchTerm.toLowerCase())
        ), [components, activeTab, searchTerm]);

    const getSupplierName = (supplierId: string) => suppliers.find(s => s.id === supplierId)?.name || 'N/A';

    const currentHeaders = componentTypeConfig[activeTab]?.headers || [];

    const renderRow = (component: AnyComponent) => {
        const cost = component.cost ? `${component.cost.toLocaleString()} AED` : 'N/A';
        const config = componentTypeConfig[component.type as keyof typeof componentTypeConfig];

        return (
            <tr key={component.id}>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{component.manufacturer}</td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-700">{component.model}</td>
                {config ? config.renderCells(component as any) : null}
                <td className="px-4 py-2">{cost}</td>
                <td className="px-4 py-2">{getSupplierName(component.supplierId)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openModal(component)}><Edit size={16} /></Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(component)}><Trash2 size={16} /></Button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <>
            <Card title="Component Database" actions={
                <div className="flex items-center gap-2">
                     <Button onClick={() => setIsImportModalOpen(true)} variant="secondary"><Upload className="mr-2 h-4 w-4" /> Bulk Import</Button>
                     <Button onClick={() => openModal()}><Plus className="mr-2 h-4 w-4" /> Add New</Button>
                </div>
            }>
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
                        {Object.values(ComponentTypes).map(type => (
                            <button
                                key={type}
                                onClick={() => setActiveTab(type)}
                                className={`shrink-0 border-b-2 px-1 pb-4 text-sm font-medium ${activeTab === type ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="py-4">
                    <input
                        type="text"
                        placeholder="Search by manufacturer or model..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full max-w-sm p-2 border rounded-md"
                    />
                </div>
                <Table headers={currentHeaders}>
                    {filteredComponents.length > 0
                        ? filteredComponents.map(c => renderRow(c))
                        : <tr><td colSpan={currentHeaders.length} className="text-center py-4 text-gray-500">No components found for this type.</td></tr>
                    }
                </Table>

                <Modal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    title={`${editingComponent ? 'Edit' : 'Add'} ${editingComponent?.type || activeTab}`}
                    footer={
                        <>
                            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                            <Button type="submit" form="component-form">Save</Button>
                        </>
                    }
                >
                    {isModalOpen && (
                        <ComponentForm
                            component={editingComponent}
                            onSave={handleSave}
                            componentType={activeTab}
                            suppliers={suppliers}
                        />
                    )}
                </Modal>
            </Card>

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                suppliers={suppliers}
                addComponent={addComponent}
            />
        </>
    );
};

export default ComponentsPage;
