import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { AnyComponent, ComponentTypes, ComponentType, SolarPanel, Inverter, Battery, MountingSystem, Cable, MonitoringSystem, Supplier, ElectricCharger } from '../types';
import { Card, Button, Table, Modal, Input, Select } from '../components/ui';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface ComponentFormProps {
    component?: AnyComponent;
    onSave: (data: Partial<AnyComponent>) => void;
    componentType: ComponentType;
    suppliers: Supplier[];
}

const ComponentForm: React.FC<ComponentFormProps> = ({ component, onSave, componentType, suppliers }) => {
    const getInitialState = (): AnyComponent => {
        if (component) return component;

        const base = {
            id: '', // id is not needed for creation
            type: componentType,
            manufacturer: '',
            model: '',
            cost: 0,
            supplierId: suppliers[0]?.id || '',
        };

        switch (componentType) {
            case ComponentTypes.SolarPanel:
                return { ...base, type: ComponentTypes.SolarPanel, wattage: 400, efficiency: 20, warranty: 25, technology: 'Monocrystalline' };
            case ComponentTypes.Inverter:
                return { ...base, type: ComponentTypes.Inverter, capacity: 5, inverterType: 'String', efficiency: 98, mpptChannels: 2 };
            case ComponentTypes.Battery:
                 return { ...base, type: ComponentTypes.Battery, capacity: 10, batteryType: 'Lithium', warranty: 10, depthOfDischarge: 95 };
            case ComponentTypes.MountingSystem:
                 return { ...base, type: ComponentTypes.MountingSystem, mountingType: 'Roof', material: 'Aluminum', loadCapacity: 50 };
            case ComponentTypes.Cable:
                return { ...base, type: ComponentTypes.Cable, cableType: 'PV Wire', crossSection: 4 };
            case ComponentTypes.MonitoringSystem:
                 return { ...base, type: ComponentTypes.MonitoringSystem, features: [] };
            case ComponentTypes.ElectricCharger:
                 return { ...base, type: ComponentTypes.ElectricCharger, chargingSpeed: 11, connectorType: 'Type 2' };
            default:
                // This should not happen with a valid componentType
                return base as AnyComponent;
        }
    };
    
    const [formData, setFormData] = useState<AnyComponent>(getInitialState());

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const parsedValue = type === 'number' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const renderSpecificFields = () => {
        switch (formData.type) {
            case ComponentTypes.SolarPanel:
                const panel = formData as SolarPanel;
                return <>
                    <Input label="Wattage (W)" name="wattage" type="number" value={panel.wattage} onChange={handleChange} />
                    <Input label="Efficiency (%)" name="efficiency" type="number" step="0.1" value={panel.efficiency} onChange={handleChange} />
                    <Input label="Warranty (years)" name="warranty" type="number" value={panel.warranty} onChange={handleChange} />
                    <Input label="Technology" name="technology" value={panel.technology} onChange={handleChange} />
                </>;
            case ComponentTypes.Inverter:
                const inverter = formData as Inverter;
                return <>
                    <Input label="Capacity (kW)" name="capacity" type="number" step="0.1" value={inverter.capacity} onChange={handleChange} />
                    <Select label="Inverter Type" name="inverterType" value={inverter.inverterType} onChange={handleChange}>
                        <option value="String">String</option>
                        <option value="Central">Central</option>
                        <option value="Micro">Micro</option>
                    </Select>
                    <Input label="Efficiency (%)" name="efficiency" type="number" step="0.1" value={inverter.efficiency} onChange={handleChange} />
                    <Input label="MPPT Channels" name="mpptChannels" type="number" value={inverter.mpptChannels} onChange={handleChange} />
                </>;
            case ComponentTypes.ElectricCharger:
                const charger = formData as ElectricCharger;
                return <>
                    <Input label="Charging Speed (kW)" name="chargingSpeed" type="number" step="0.1" value={charger.chargingSpeed} onChange={handleChange} />
                    <Select label="Connector Type" name="connectorType" value={charger.connectorType} onChange={handleChange}>
                        <option value="Type 1">Type 1</option>
                        <option value="Type 2">Type 2</option>
                        <option value="CCS">CCS</option>
                        <option value="CHAdeMO">CHAdeMO</option>
                    </Select>
                </>;
             // For brevity, other types can be added here
            default:
                return null;
        }
    };

    return (
        <form id="component-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Common Fields */}
            <Input label="Manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleChange} required className="md:col-span-1" />
            <Input label="Model" name="model" value={formData.model} onChange={handleChange} required className="md:col-span-1" />
            <Input label="Cost (per unit)" name="cost" type="number" step="0.01" value={formData.cost} onChange={handleChange} required />
            <Select label="Supplier" name="supplierId" value={formData.supplierId} onChange={handleChange} required>
                {suppliers.length === 0 && <option disabled>No suppliers available</option>}
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>

            {renderSpecificFields()}
        </form>
    );
};

const ComponentsPage = () => {
    const { state, addComponent, updateComponent, deleteComponent } = useContext(AppContext);
    const { components, suppliers } = state;
    const [activeTab, setActiveTab] = useState<ComponentType>(ComponentTypes.SolarPanel);
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...newData } = data; // remove placeholder id
            addComponent(newData as Omit<AnyComponent, 'id'>);
        }
        closeModal();
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this component?')) {
            deleteComponent(id);
        }
    };

    const filteredComponents = components
        .filter(c => c.type === activeTab)
        .filter(c =>
            c.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.model.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const getSupplierName = (supplierId: string) => suppliers.find(s => s.id === supplierId)?.name || 'N/A';

    const headers: Record<ComponentType, string[]> = {
        [ComponentTypes.SolarPanel]: ['Manufacturer', 'Model', 'Wattage', 'Efficiency', 'Cost', 'Supplier', 'Actions'],
        [ComponentTypes.Inverter]: ['Manufacturer', 'Model', 'Capacity (kW)', 'Type', 'Cost', 'Supplier', 'Actions'],
        [ComponentTypes.Battery]: ['Manufacturer', 'Model', 'Capacity (kWh)', 'Type', 'Cost', 'Supplier', 'Actions'],
        [ComponentTypes.MountingSystem]: ['Manufacturer', 'Model', 'Type', 'Material', 'Cost', 'Supplier', 'Actions'],
        [ComponentTypes.Cable]: ['Manufacturer', 'Model', 'Type', 'Cross-section', 'Cost', 'Supplier', 'Actions'],
        [ComponentTypes.MonitoringSystem]: ['Manufacturer', 'Model', 'Cost', 'Supplier', 'Actions'],
        [ComponentTypes.ElectricCharger]: ['Manufacturer', 'Model', 'Speed (kW)', 'Connector', 'Cost', 'Supplier', 'Actions'],
    };

    const renderRow = (component: AnyComponent) => {
        const commonCols = (
            <>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{component.manufacturer}</td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-700">{component.model}</td>
            </>
        );

        const actions = (
            <td className="whitespace-nowrap px-4 py-2">
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openModal(component)}><Edit size={16} /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(component.id)}><Trash2 size={16} /></Button>
                </div>
            </td>
        );

        switch (component.type) {
            case ComponentTypes.SolarPanel:
                return <tr key={component.id}>{commonCols}<td className="px-4 py-2">{component.wattage}W</td><td className="px-4 py-2">{component.efficiency}%</td><td className="px-4 py-2">{component.cost} AED</td><td className="px-4 py-2">{getSupplierName(component.supplierId)}</td>{actions}</tr>;
            case ComponentTypes.Inverter:
                return <tr key={component.id}>{commonCols}<td className="px-4 py-2">{component.capacity}kW</td><td className="px-4 py-2">{component.inverterType}</td><td className="px-4 py-2">{component.cost} AED</td><td className="px-4 py-2">{getSupplierName(component.supplierId)}</td>{actions}</tr>;
            case ComponentTypes.Battery:
                const battery = component as Battery;
                return <tr key={component.id}>{commonCols}<td className="px-4 py-2">{battery.capacity}kWh</td><td className="px-4 py-2">{battery.batteryType}</td><td className="px-4 py-2">{component.cost} AED</td><td className="px-4 py-2">{getSupplierName(component.supplierId)}</td>{actions}</tr>;
            case ComponentTypes.ElectricCharger:
                const charger = component as ElectricCharger;
                return <tr key={component.id}>{commonCols}<td className="px-4 py-2">{charger.chargingSpeed}kW</td><td className="px-4 py-2">{charger.connectorType}</td><td className="px-4 py-2">{component.cost} AED</td><td className="px-4 py-2">{getSupplierName(component.supplierId)}</td>{actions}</tr>;
            // Add other cases here for brevity...
            default:
                return <tr key={component.id}>{commonCols}<td colSpan={3}>Details not implemented</td><td className="px-4 py-2">{component.cost} AED</td><td className="px-4 py-2">{getSupplierName(component.supplierId)}</td>{actions}</tr>;
        }
    }


    return (
        <Card title="Component Database" actions={
            <Button onClick={() => openModal()}><Plus className="mr-2 h-4 w-4" /> Add New</Button>
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
            <Table headers={headers[activeTab] || []}>
                {filteredComponents.length > 0
                    ? filteredComponents.map(c => renderRow(c))
                    : <tr><td colSpan={headers[activeTab]?.length || 5} className="text-center py-4 text-gray-500">No components found for this type.</td></tr>
                }
            </Table>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={`${editingComponent ? 'Edit' : 'Add'} ${editingComponent?.type || activeTab}`}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                        {/* This button submits the form inside the modal */}
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
    );
};

export default ComponentsPage;