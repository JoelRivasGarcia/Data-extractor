import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

export async function extractEquipmentData(base64Image: string, mimeType: string): Promise<ExtractionResult> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. If you are running this on Netlify, make sure to set VITE_GEMINI_API_KEY in the environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `Extract the following data from this photo of optical equipment:
                1. The large serial code/identifier printed on the equipment (e.g., WN-20A-2369450).
                2. The equipment type: "CTO" (usually a box with ports), "MUFA" (a cylindrical black enclosure), or "RESERVA" (a coil of fiber optic cable).
                3. The GPS coordinates (latitude and longitude) shown in the overlay text. 
                   IMPORTANT: These photos are from PERU. Coordinates should be in the range of Lat: -18 to 0 and Lon: -82 to -68.
                   Extract them exactly as they appear, but ensure you identify the negative signs or S/W suffixes if present.
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
          systemInstruction: "You are a specialized data extractor for optical network equipment photos in Peru. Your goal is to extract serial codes, equipment type (CTO, MUFA, or RESERVA), GPS coordinates, timestamps, and optical power readings with 100% accuracy. Coordinates in Peru are always South (negative latitude) and West (negative longitude). The power reading is always the most prominent number on the power meter's LCD screen. A MUFA is typically a cylindrical black enclosure, a CTO is usually a rectangular box, and a RESERVA is a coil of fiber optic cable.",
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

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      return JSON.parse(text) as ExtractionResult;

    } catch (error: any) {
      lastError = error;
      // Only retry on 503 (Service Unavailable) or 429 (Too Many Requests)
      const isTransient = error?.message?.includes('503') || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('high demand');
      
      if (!isTransient || attempt === maxRetries) {
        break;
      }
      console.warn(`Attempt ${attempt + 1} failed due to high demand. Retrying...`);
    }
  }

  console.error("Failed to parse AI response after retries:", lastError);
  if (lastError?.message?.includes('high demand') || lastError?.message?.includes('503')) {
    throw new Error("El servidor de Google está saturado temporalmente. Por favor, espera unos segundos e intenta subir la foto nuevamente.");
  }
  throw new Error("No se pudo extraer la información de la imagen. Por favor, intenta con una foto más clara.");
}
