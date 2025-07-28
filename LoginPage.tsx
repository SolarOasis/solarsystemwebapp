
import React, { useState } from 'react';
import { Card, Input, Button } from '../components/ui';
import { Sun, Lock } from 'lucide-react';

interface LoginPageProps {
    onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real application, this would be a call to a secure authentication service.
        // For this internal tool, we are using hardcoded credentials.
        if (username === 'SolarOasis' && password === 'Sunflower07') {
            onLoginSuccess();
        } else {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-brand-light">
            <Card className="w-full max-w-md" title="">
                 <div className="flex flex-col items-center mb-8">
                     <div className="flex items-center gap-2 mb-2">
                        <Sun className="h-12 w-12 text-brand-secondary" />
                        <h1 className="text-4xl font-bold text-brand-primary">Solar Oasis</h1>
                    </div>
                    <p className="text-gray-600">Internal Database Login</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-6">
                    <Input
                        id="username"
                        label="Username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                    />
                    <Input
                        id="password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                    
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    
                    <Button type="submit" className="w-full">
                        <Lock className="mr-2 h-4 w-4" />
                        Sign In
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default LoginPage;