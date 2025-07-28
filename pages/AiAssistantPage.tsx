
import React from 'react';
import { Card } from '../components/ui';
import { AiAssistant } from '../components/AiAssistant';

const AiAssistantPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card title="Solar Project AI Assistant">
        <p className="text-gray-600 mb-4">
          Describe your solar project requirements in the chat below. The AI assistant will ask clarifying questions
          and help you generate a configuration that you can apply directly to the calculator.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          <strong>Example:</strong> "I have a villa in Dubai. My average electricity bill is around 2500 AED per month.
          I want a system with battery backup and would prefer high-efficiency panels."
        </p>
        <AiAssistant />
      </Card>
    </div>
  );
};

export default AiAssistantPage;
