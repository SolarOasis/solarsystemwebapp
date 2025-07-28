import React from 'react';
import { X } from 'lucide-react';

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizeClasses = {
        md: 'px-4 py-2',
        sm: 'px-2 py-1 text-xs',
    };

    const variantClasses = {
        primary: 'bg-brand-primary text-white hover:bg-brand-dark focus:ring-brand-primary',
        secondary: 'bg-brand-secondary text-brand-primary hover:bg-yellow-400 focus:ring-brand-secondary',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-200 focus:ring-gray-400',
    };

    const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className || ''}`;
    
    if (asChild) {
        const child = React.Children.only(children);
        if (React.isValidElement(child)) {
            // After the type guard, child is a ReactElement. Its props can be accessed.
            // We cast the props to explicitly state we're looking for a className.
            const childProps = child.props as { className?: string };
            const mergedClassName = [combinedClasses, childProps.className].filter(Boolean).join(' ');

            return React.cloneElement<any>(child, {
                ref,
                className: mergedClassName,
                ...props,
            });
        }
    }

    return (
        <button className={combinedClasses} ref={ref} {...props}>
            {children}
        </button>
    );
});
Button.displayName = "Button";


// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, ...props }, ref) => {
    return (
        <div className="w-full">
            {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <input
                id={id}
                ref={ref}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                {...props}
            />
        </div>
    );
});
Input.displayName = "Input";

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ label, id, children, ...props }, ref) => {
    return (
        <div className="w-full">
            {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <select
                id={id}
                ref={ref}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                {...props}
            >
                {children}
            </select>
        </div>
    );
});
Select.displayName = "Select";


// Card
interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    actions?: React.ReactNode;
}
export const Card: React.FC<CardProps> = ({ children, className, title, actions }) => {
    return (
        <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
            {(title || actions) && (
                 <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                 </div>
            )}
            <div className="p-4 md:p-6">
                {children}
            </div>
        </div>
    );
};

// Modal
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
                {footer && (
                    <div className="flex justify-end items-center p-4 border-t gap-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

// Table
interface TableProps {
    headers: string[];
    children: React.ReactNode;
}
export const Table: React.FC<TableProps> = ({ headers, children }) => {
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y-2 divide-gray-200 bg-white text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        {headers.map(header => (
                            <th key={header} className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-900">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {children}
                </tbody>
            </table>
        </div>
    )
}