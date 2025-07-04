
import React from 'react';
import { Card } from '../components/ui';

const SettingsPage = () => {

    return (
        <div className="space-y-8">
            <Card title="Google Services Integration">
                <div className="space-y-4">
                    <p className="text-gray-600">
                        This application uses Google Sheets as a database and is configured via a Vercel Environment Variable.
                        If the application is not working, please ensure the administrator has correctly set up the backend and configured the deployment settings.
                    </p>
                </div>
            </Card>

            <Card title="Backend Setup Instructions">
                <div>
                    <h3 className="font-semibold text-lg mb-2">How to Deploy Your Backend:</h3>
                    <ol className="list-decimal list-inside space-y-3 text-gray-700">
                        <li>Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">sheets.new</a> to create a new Google Sheet. Name it anything you like (e.g., "SolarOasisDB").</li>
                        <li>Ask your developer assistant for the complete <strong className="text-brand-primary">`Code.gs`</strong> backend script.</li>
                        <li>In your new Google Sheet, click "Extensions" &rarr; "Apps Script".</li>
                        <li>Delete any existing code in the <code className="font-mono bg-gray-200 px-1 rounded">Code.gs</code> editor and paste the entire provided script.
                            <br/><em className="text-sm text-gray-500">The script will automatically create the required 'Components', 'Projects', and 'Suppliers' tabs for you.</em>
                        </li>
                        <li>Click the "Save project" icon.</li>
                        <li>Click the blue "Deploy" button &rarr; "New deployment".</li>
                        <li>In the configuration dialog:
                            <ul className="list-disc list-inside pl-4 mt-1 text-sm">
                                <li>Click the gear icon and select **"Web app"**.</li>
                                <li>For "Who has access", select **"Anyone"**.</li>
                            </ul>
                        </li>
                        <li>Click "Deploy". Authorize the permissions when prompted (you may need to click "Advanced" and "Go to (unsafe)").</li>
                        <li>Copy the final "Web app URL".</li>
                        <li>In Vercel, navigate to your project's "Settings" &rarr; "Environment Variables".</li>
                        <li>Create a new variable named <code className="font-mono bg-gray-200 px-1 rounded">VITE_GOOGLE_APPS_SCRIPT_URL</code> and paste the Web app URL as the value.</li>
                        <li>Redeploy your application in Vercel for the changes to take effect.</li>
                    </ol>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;
