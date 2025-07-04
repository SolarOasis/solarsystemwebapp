
import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Supplier, ComponentTypes, ComponentType } from '../types';
import { Card, Button, Table, Modal, Input } from '../components/ui';
import { Plus, Edit, Trash2 } from 'lucide-react';

// New Specialization Picker component
const SpecializationPicker: React.FC<{ selected: ComponentType[], onChange: (newSelected: ComponentType[]) => void }> = ({ selected, onChange }) => {
    const handleCheckChange = (type: ComponentType, isChecked: boolean) => {
        if (isChecked) {
            onChange([...selected, type]);
        } else {
            onChange(selected.filter(t => t !== type));
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md bg-gray-50">
                {Object.values(ComponentTypes).map(type => (
                    <div key={type} className="flex items-center">
                        <input
                            id={`spec-${type}`}
                            type="checkbox"
                            checked={selected.includes(type)}
                            onChange={(e) => handleCheckChange(type, e.target.checked)}
                            className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                        />
                        <label htmlFor={`spec-${type}`} className="ml-2 block text-sm text-gray-900">
                            {type}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};


const SupplierForm: React.FC<{ 
    data: Partial<Supplier>, 
    onTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onSpecializationChange: (newSelected: ComponentType[]) => void,
}> = ({ data, onTextChange, onSpecializationChange }) => {
    return (
        <div className="space-y-4">
            <Input label="Supplier Name" name="name" value={data.name || ''} onChange={onTextChange} required />
            <Input label="Contact Person" name="contactPerson" value={data.contactPerson || ''} onChange={onTextChange} required />
            <Input label="Phone" name="phone" value={data.phone || ''} onChange={onTextChange} />
            <Input label="Email" type="email" name="email" value={data.email || ''} onChange={onTextChange} />
            <Input label="Address" name="address" value={data.address || ''} onChange={onTextChange} />
            <SpecializationPicker selected={data.specialization || []} onChange={onSpecializationChange} />
        </div>
    );
};

const SuppliersPage = () => {
    const { state, addSupplier, updateSupplier, deleteSupplier } = useContext(AppContext);
    const { suppliers } = state;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);
    const [formData, setFormData] = useState<Partial<Supplier>>({});

    const openModal = (supplier?: Supplier) => {
        setEditingSupplier(supplier);
        setFormData(supplier || {
            name: '', contactPerson: '', phone: '', email: '', address: '', specialization: []
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingSupplier(undefined);
        setIsModalOpen(false);
        setFormData({});
    };
    
    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleSpecializationChange = (newSelected: ComponentType[]) => {
        setFormData(prev => ({...prev, specialization: newSelected}));
    };

    const handleSave = () => {
        if (!formData.name || !formData.contactPerson) {
            alert('Supplier Name and Contact Person are required.');
            return;
        }

        if (editingSupplier) {
            updateSupplier({ ...editingSupplier, ...formData } as Supplier);
        } else {
            addSupplier(formData as Omit<Supplier, 'id'>);
        }
        closeModal();
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this supplier?')) {
            deleteSupplier(id);
        }
    };

    return (
        <>
            <Card
                title="Suppliers"
                actions={<Button onClick={() => openModal()}><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>}
            >
                <Table headers={['Name', 'Contact Person', 'Email', 'Phone', 'Specializations', 'Actions']}>
                    {suppliers.map(supplier => (
                        <tr key={supplier.id}>
                            <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{supplier.name}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-gray-700">{supplier.contactPerson}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-gray-700">{supplier.email}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-gray-700">{supplier.phone}</td>
                            <td className="px-4 py-2 text-gray-700 text-xs">
                                {(supplier.specialization || []).map(spec => (
                                    <span key={spec} className="inline-block bg-gray-200 rounded-full px-2 py-1 mr-1 mb-1">{spec}</span>
                                ))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2">
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openModal(supplier)}><Edit size={16} /></Button>
                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(supplier.id)}><Trash2 size={16} /></Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </>
                }
            >
                <SupplierForm
                    data={formData}
                    onTextChange={handleTextChange}
                    onSpecializationChange={handleSpecializationChange}
                />
            </Modal>
        </>
    );
};

export default SuppliersPage;
