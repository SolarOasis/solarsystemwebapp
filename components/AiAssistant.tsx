import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from './ui';
import { Send, Sparkles, Bot, User, Loader, ClipboardCopy } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const systemPrompt = `You are "Oasis AI," a specialized assistant for Solar Oasis. Your primary goal is to help users configure a solar energy project by asking them questions and gathering requirements. Once you have enough information, you MUST generate a JSON object that can be used to pre-fill the Solar Oasis Calculator.

**Your process:**
1.  **Greet the user** and introduce yourself.
2.  **Ask clarifying questions** one by one to gather the following details:
    *   'projectName' (e.g., "My Villa Solar Project")
    *   'city' (e.g., "Dubai", "Abu Dhabi")
    *   'authority' ("DEWA" or "EtihadWE")
    *   'bills' (Ask for a few sample monthly electricity consumption values in kWh, like "Jan-3000, Jul-8000". If they give bill amounts in AED, acknowledge it and ask for kWh instead, as the calculator needs kWh.)
    *   'systemCost' (Ask for their budget or expected system cost in AED.)
    *   'batteryEnabled' (Ask if they want a battery. Note: DEWA projects in this tool do not use batteries.)
    *   **Fuel Surcharge & Tiers:** Do not ask the user for this. You must include it in the JSON with the correct default value: 'fuelSurcharge: 0.06' for DEWA, and 'fuelSurcharge: 0.05' for EtihadWE. Include the standard tiers for that authority.
    *   Any other preferences like panel type or specific parameters if they mention them.
3.  **Confirm before generating:** Once you have the essential details (especially city, authority, and at least one bill), summarize what you've gathered and ask if they are ready for you to generate the calculator configuration.
4.  **Generate the JSON:** When confirmed, your FINAL response must be ONLY the JSON object, formatted inside a markdown code block. Do not add any text before or after the JSON block.

**JSON Object Structure Example (for DEWA):**
The JSON object MUST follow this exact structure and keys. Only include keys for which you have information. Omit keys if the user did not provide the data.

\`\`\`json
{
  "projectName": "My Dubai Villa",
  "city": "Dubai",
  "authority": "DEWA",
  "batteryEnabled": false,
  "bills": [
    { "month": "July", "consumption": 8500 },
    { "month": "January", "consumption": 3200 }
  ],
  "tiers": [
    { "from": 1, "to": 2000, "rate": 0.23 },
    { "from": 2001, "to": 4000, "rate": 0.28 },
    { "from": 4001, "to": 6000, "rate": 0.32 },
    { "from": 6001, "to": "Infinity", "rate": 0.38 }
  ],
  "fuelSurcharge": 0.06,
  "meterCharges": 10,
  "roiParams": {
    "systemCost": 45000
  }
}
\`\`\`
`;

export const AiAssistant: React.FC = () => {
  const navigate = useNavigate();
  const chatRef = useRef<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jsonConfig, setJsonConfig] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    try {
      // Use the correct environment variable as per the guidelines
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
          setMessages([{ role: 'model', text: 'Error: Could not initialize the AI Assistant. Please ensure the API key is configured correctly.' }]);
          return;
      }
      const ai = new GoogleGenAI({ apiKey });
      chatRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: systemPrompt },
      });
      // Start the conversation
      handleSendMessage("Hello");
    } catch (error) {
        console.error("Gemini initialization failed:", error);
        setMessages([{ role: 'model', text: 'Error: Could not initialize the AI Assistant. Please ensure the API key is configured correctly.' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const extractJsonFromText = (text: string): string | null => {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    return match ? match[1] : null;
  };

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setJsonConfig(null);

    try {
        if (!chatRef.current) throw new Error("Chat not initialized");
      
        const responseStream = await chatRef.current.sendMessageStream({ message: messageText });
        
        let fullResponse = '';
        setMessages(prev => [...prev, { role: 'model', text: '' }]);

        for await (const chunk of responseStream) {
            fullResponse += chunk.text;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = fullResponse;
                return newMessages;
            });
        }
        
        const extractedJson = extractJsonFromText(fullResponse);
        if (extractedJson) {
            setJsonConfig(extractedJson);
        }

    } catch (error) {
      console.error("Error sending message:", error);
      const errorText = error instanceof Error ? error.message : "An unknown error occurred.";
      setMessages(prev => [...prev, { role: 'model', text: `Sorry, something went wrong: ${errorText}` }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleApplyConfig = () => {
    if (jsonConfig) {
      sessionStorage.setItem('aiProjectConfig', jsonConfig);
      navigate('/calculator');
    }
  };

  return (
    <div className="flex flex-col h-[60vh] bg-white border rounded-lg">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white flex-shrink-0">
                <Bot size={20} />
              </div>
            )}
            <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-brand-secondary text-brand-primary' : 'bg-gray-100'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
             {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 flex-shrink-0">
                <User size={20} />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white flex-shrink-0">
                    <Loader size={20} className="animate-spin" />
                </div>
                 <div className="max-w-xl p-3 rounded-lg bg-gray-100">
                    <p className="text-sm italic text-gray-500">Oasis AI is thinking...</p>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {jsonConfig && (
        <div className="p-4 bg-green-50 border-t border-b text-center">
            <p className="text-sm text-green-800 mb-2">
                <Sparkles size={16} className="inline-block mr-2" />
                A project configuration has been generated!
            </p>
            <Button onClick={handleApplyConfig}>Apply Configuration to Calculator</Button>
        </div>
      )}

      <div className="p-4 border-t flex items-center gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
          placeholder="Type your message..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button onClick={() => handleSendMessage(inputValue)} disabled={isLoading || !inputValue.trim()}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
};
