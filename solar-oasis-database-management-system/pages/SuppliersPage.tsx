
import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Supplier } from '../types';
import { Card, Button, Table, Modal, Input } from '../components/ui';
import { Plus, Edit, Trash2 } from 'lucide-react';

const SupplierForm: React.FC<{ data: Partial<Supplier>, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ data, onChange }) => {
    return (
        <div className="space-y-4">
            <Input label="Supplier Name" name="name" value={data.name || ''} onChange={onChange} required />
            <Input label="Contact Person" name="contactPerson" value={data.contactPerson || ''} onChange={onChange} required />
            <Input label="Phone" name="phone" value={data.phone || ''} onChange={onChange} />
            <Input label="Email" type="email" name="email" value={data.email || ''} onChange={onChange} />
            <Input label="Address" name="address" value={data.address || ''} onChange={onChange} />
            {/* Specialization would be a multi-select in a real app */}
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
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
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
                <Table headers={['Name', 'Contact Person', 'Email', 'Phone', 'Actions']}>
                    {suppliers.map(supplier => (
                        <tr key={supplier.id}>
                            <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{supplier.name}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-gray-700">{supplier.contactPerson}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-gray-700">{supplier.email}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-gray-700">{supplier.phone}</td>
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
                    onChange={handleFormChange}
                />
            </Modal>
        </>
    );
};

export default SuppliersPage;
