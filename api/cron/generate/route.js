import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const STREAMS = [
  "Engineering", "Medical", "Banking", "SSC", "UPSC", 
  "Railways", "Teaching", "Defense", "CA-CS", "Law",
  "Agriculture", "Architecture", "Management", "Nursing", "Pharmacy",
  "Hotel Management", "Design", "Mass Communication", "Computer Applications", "Science"
];

export async function GET(request) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const results = {};

    for (const stream of STREAMS) {
      const prompt = `Generate 20 high-yield multiple-choice questions for the competitive exam stream "${stream}" in strict JSON array format. Each object must have fields: "id", "question", "options" (array of 4 strings), "correctAnswer" (index 0-3), and "trick" (short memory trick). Do not include any markdown formatting or extra text outside the JSON array.`;

      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();
        
        text = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
        results[stream] = JSON.parse(text);
      } catch (err) {
        results[stream] = { error: err.message };
      }
    }

    return NextResponse.json({ success: true, message: "Questions generated successfully!", data: results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}