
import React from 'react';
import { Card } from '../components/ui';

const SettingsPage = () => {

    return (
        <div className="space-y-8">
            <Card title="Security & Access">
                 <div className="space-y-4 text-gray-700">
                     <p>
                        This application is secured by a password to ensure only internal team members can access the data.
                    </p>
                    <h4 className="font-semibold">Changing the Password:</h4>
                    <p>
                       The password is hard-coded in the application's source code. To change it, edit the file at <code className="font-mono bg-gray-200 px-1 rounded">pages/LoginPage.tsx</code>, update the credentials, and redeploy the application on Vercel.
                    </p>
                    <h4 className="font-semibold">Protecting Your Source Code:</h4>
                    <p>
                        It is highly recommended to set your GitHub repository for this project to **Private**. This prevents public access to your application's code, including the password and backend logic.
                    </p>
                </div>
            </Card>

            <Card title="Google Services & Backend Setup">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Backend Instructions:</h3>
                    <ol className="list-decimal list-inside space-y-3 text-gray-700">
                        <li>Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">sheets.new</a> to create a new Google Sheet for your database.</li>
                        <li>Ask your developer assistant for the latest <strong className="text-brand-primary">`Code.gs`</strong> backend script.</li>
                        <li>In your Google Sheet, click "Extensions" &rarr; "Apps Script".</li>
                        <li>Paste the provided script into the editor, replacing any existing code.
                            <br/><em className="text-sm text-gray-500">The script will automatically create all necessary tabs (e.g., 'Solar Panels', 'Projects') for you.</em>
                        </li>
                        <li>Click "Save", then "Deploy" &rarr; "New deployment".</li>
                        <li>Configure the Web app: set "Who has access" to **"Anyone"**.</li>
                        <li>Authorize the script permissions. This is required for it to manage your Sheet and save PDFs to your Drive.</li>
                        <li>Copy the final "Web app URL".</li>
                        <li>In Vercel, navigate to your project's "Settings" &rarr; "Environment Variables".</li>
                        <li>Create a variable named <code className="font-mono bg-gray-200 px-1 rounded">VITE_GOOGLE_APPS_SCRIPT_URL</code> and paste your Web app URL as the value.</li>
                        <li>Redeploy your application in Vercel to apply the changes.</li>
                    </ol>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;
