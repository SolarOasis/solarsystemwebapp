import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Card } from '../components/ui';
import { Package, Wrench, Users, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ComponentType } from '../types';

const DashboardPage = () => {
    const { state } = useContext(AppContext);
    const { components, projects, suppliers } = state;

    const totalProjectValue = projects.reduce((acc, p) => acc + p.costAnalysis.finalSellingPrice, 0);

    const componentCountByType = components.reduce((acc, component) => {
        acc[component.type] = (acc[component.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(componentCountByType).map(([name, value]) => ({ name, count: value }));

    const projectStatusData = projects.reduce((acc, project) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const projectChartData = Object.entries(projectStatusData).map(([name, value]) => ({name, count: value}));


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-blue-500 to-brand-primary text-white">
                    <div className="flex items-center">
                        <Package size={40} className="mr-4"/>
                        <div>
                            <p className="text-lg">Total Components</p>
                            <p className="text-3xl font-bold">{components.length}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-700 text-white">
                     <div className="flex items-center">
                        <Wrench size={40} className="mr-4"/>
                        <div>
                            <p className="text-lg">Active Projects</p>
                            <p className="text-3xl font-bold">{projects.filter(p => p.status === 'In Progress').length}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-purple-700 text-white">
                     <div className="flex items-center">
                        <Users size={40} className="mr-4"/>
                        <div>
                            <p className="text-lg">Total Suppliers</p>
                            <p className="text-3xl font-bold">{suppliers.length}</p>
                        </div>
                    </div>
                </Card>
                 <Card className="bg-gradient-to-br from-yellow-400 to-brand-secondary text-brand-primary">
                     <div className="flex items-center">
                        <DollarSign size={40} className="mr-4"/>
                        <div>
                            <p className="text-lg">Total Project Value</p>
                            <p className="text-3xl font-bold">{totalProjectValue.toLocaleString()} AED</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card title="Components by Type">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-25} textAnchor="end" height={70} interval={0} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#003366" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
                 <Card title="Project Status">
                    <ResponsiveContainer width="100%" height={300}>
                         <BarChart data={projectChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#FFD700" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

        </div>
    );
};

export default DashboardPage;