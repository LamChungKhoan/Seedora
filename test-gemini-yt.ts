import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: 'Analyze this video visually and tell me what you see on the screen: https://www.youtube.com/watch?v=Gdp5uNbMbU8',
  });
  console.log(response.text);
}
test();
