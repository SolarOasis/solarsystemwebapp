import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../components/ui';
import { Save } from 'lucide-react';

const SettingsPage = () => {
    const [scriptUrl, setScriptUrl] = useState('');

    useEffect(() => {
        const storedUrl = localStorage.getItem('googleAppsScriptUrl');
        if (storedUrl) {
            setScriptUrl(storedUrl);
        }
    }, []);

    const handleSaveUrl = () => {
        localStorage.setItem('googleAppsScriptUrl', scriptUrl);
        alert('URL saved! Reloading application to connect to your database...');
        window.location.reload();
    };

    return (
        <div className="space-y-8">
            <Card title="Google Services Integration">
                <div className="space-y-4">
                    <p className="text-gray-600">
                        This application uses Google Sheets as a database. To connect your data, you need to deploy a Google Apps Script Web App. 
                        Follow the steps below to set up your backend.
                    </p>
                    <div>
                        <Input 
                            label="Your Deployed Google Apps Script URL"
                            id="script-url"
                            type="url"
                            value={scriptUrl}
                            onChange={e => setScriptUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/..."
                        />
                        <p className="text-xs text-gray-500 mt-1">Paste the URL from your deployed Web App here.</p>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveUrl}>
                            <Save className="mr-2 h-4 w-4" /> Save URL & Reload
                        </Button>
                    </div>
                </div>
            </Card>

            <Card title="Backend Setup Instructions">
                <div>
                    <h3 className="font-semibold text-lg mb-2">How to Deploy Your Backend:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">sheets.new</a> to create a new Google Sheet. Name it "SolarOasisDB".</li>
                        <li>Create three tabs (sheets) at the bottom. Rename them to be exactly: <strong className="font-mono bg-gray-200 px-1 rounded">Components</strong>, <strong className="font-mono bg-gray-200 px-1 rounded">Projects</strong>, and <strong className="font-mono bg-gray-200 px-1 rounded">Suppliers</strong>.</li>
                         <li>You will need to ask your developer assistant for the complete `Code.gs` backend script.</li>
                        <li>Click "Extensions" -&gt; "Apps Script".</li>
                        <li>Delete any existing code in the <code className="font-mono bg-gray-200 px-1 rounded">Code.gs</code> editor and paste the provided script.</li>
                        <li>Click the "Save project" icon.</li>
                        <li>Click the blue "Deploy" button -&gt; "New deployment".</li>
                        <li>Select type "Web app". For "Who has access", select "Anyone".</li>
                        <li>Click "Deploy". Authorize the permissions when prompted (you may need to click "Advanced" and "Go to (unsafe)").</li>
                        <li>Copy the provided "Web app URL" and paste it into the field at the top of this page, then click save.</li>
                    </ol>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;