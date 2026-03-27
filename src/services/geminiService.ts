import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

export async function extractEquipmentData(base64Image: string, mimeType: string): Promise<ExtractionResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. If you are running this on Netlify, make sure to set VITE_GEMINI_API_KEY in the environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Extract the following data from this photo of optical equipment:
            1. The large serial code/identifier printed on the equipment (e.g., WN-20A-2369450).
            2. The equipment type: "CTO" (usually a box with ports), "MUFA" (a cylindrical black enclosure), or "RESERVA" (a coil of fiber optic cable).
            3. The GPS coordinates (latitude and longitude) shown in the overlay text. This could be in NSEW format (e.g., 12.11894S 77.02391W) or decimal format (e.g., -12.11894, -77.02391). Extract them exactly as they appear.
            4. The date and time shown in the overlay text (e.g., 26 mar. 2026 12:36:16 p. m.).
            5. The power reading from the "OPTICAL POWER METER" device. This is the large black number displayed on the greenish LCD screen. It usually has a negative sign (e.g., -18.02, -19.45) and is followed by "dBm". Extract the number and the unit.
            
            Return the result in JSON format.`,
          },
          {
            inlineData: {
              data: base64Image.split(",")[1] || base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: "You are a specialized data extractor for optical network equipment photos. Your goal is to extract serial codes, equipment type (CTO, MUFA, or RESERVA), GPS coordinates, timestamps, and optical power readings with 100% accuracy. The power reading is always the most prominent number on the power meter's LCD screen. A MUFA is typically a cylindrical black enclosure, a CTO is usually a rectangular box, and a RESERVA is a coil of fiber optic cable.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: "The serial code or identifier found on the equipment.",
          },
          type: {
            type: Type.STRING,
            enum: ["CTO", "MUFA", "RESERVA"],
            description: "The type of equipment identified in the photo.",
          },
          coordinates: {
            type: Type.STRING,
            description: "The GPS coordinates found in the overlay text.",
          },
          timestamp: {
            type: Type.STRING,
            description: "The date and time found in the overlay text.",
          },
          power: {
            type: Type.STRING,
            description: "The power reading (dBm/uW) from the optical power meter screen.",
          },
        },
        required: ["code", "type", "coordinates", "timestamp", "power"],
      },
    },
  });

  try {
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as ExtractionResult;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Could not extract data from the image. Please try again with a clearer photo.");
  }
}
