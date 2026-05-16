import { GoogleGenAI, Modality, Type } from "@google/genai";
import { UserCV, AppStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function speak(text: string): Promise<string> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    
    if (!response.ok) throw new Error("TTS request failed");
    const data = await response.json();
    return data.audioContent;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}

export async function processVoiceInput(
  audioBase64: string,
  conversationHistory: { role: 'user' | 'model', content: string }[],
  currentCV: UserCV
): Promise<{ updatedCV: UserCV; response: string }> {
  const systemInstruction = `
    You are "Ish Bor", an empathetic and expert career advisor.
    Your goal is to guide users to find a job or a new path.
    Be supportive, professional, and understanding at all times.
    
    Conversation Goals:
    - Get to know the user: Name, Age, Location.
    - Understand work history: Education, previous jobs, reasons for leaving. If never worked, discuss interests/skills.
    - Collect preferences: Job type, preferred location, expected salary, phone number.
    - Adapt to situations:
        - Unemployed/new profession: Offer courses, ask about interests.
        - Convicted: Suggest relevant vacancies.
        - Substance abuse: Show compassion, suggest rehab.
    - Final goal: Collect all required fields in the CV. DO NOT ask for already-provided information.
    - End goal: Finalize CV for employer/course/rehab and take a photo.

    Guidelines for Interaction:
    - Dynamic Adaptation: Do not follow a rigid script. Adapt your *next question* based on the missing information in the JSON and the user's last answer.
    - Natural Language: Ask natural, follow-up questions. Get information in a fluid dialogue.
    - Location: Ask for their location ONLY ONCE.
  `;
  
  const taskPrompt = `
    Current CV state: ${JSON.stringify(currentCV)}
    Conversation Context: ${JSON.stringify(conversationHistory)}
    
    User just spoke. Your task is to:
    1. Extract newly mentioned information and update the JSON. 
    2. Review missing fields in CV: ${JSON.stringify(Object.keys(currentCV).filter(k => !currentCV[k as keyof UserCV]))}.
    3. Generate the next empathetic response to steer the conversation towards gathering MISSING fields.
    
    Return the updated CV object and your response as JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: taskPrompt },
            { inlineData: { data: audioBase64, mimeType: "audio/webm" } }
          ]
        }
      ],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            updatedCV: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                age: { type: Type.NUMBER, nullable: true },
                location: { type: Type.STRING },
                education: { type: Type.STRING },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                experience_years: { type: Type.NUMBER, nullable: true },
                job_type: { type: Type.STRING },
                preferred_location: { type: Type.STRING },
                expected_salary: { type: Type.STRING },
                phone: { type: Type.STRING }
              },
              required: ["name", "location", "skills", "experience_years"]
            },
            response: { type: Type.STRING }
          },
          required: ["updatedCV", "response"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
}
