import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

export async function extractEquipmentData(
  base64Image: string, 
  mimeType: string, 
  modelName: string = "gemini-flash-latest"
): Promise<{ result: ExtractionResult; model: string }> {
  // Use the exact pattern recommended in the skill, with fallback for Netlify/Vercel
  const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "undefined") 
    ? process.env.GEMINI_API_KEY 
    : (import.meta as any).env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("La llave de API de Gemini no está disponible. Por favor, asegúrate de que esté configurada en los secretos del proyecto.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const maxRetries = 1; // Reduced retries for faster fallback
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const isNanoBanana = modelName.includes('2.5') || modelName.includes('image') || modelName.includes('nano');
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                text: `Extract the following data from this photo of optical equipment:
                1. The large serial code/identifier printed on the equipment (e.g., WN-20A-2369450). 
                   IMPORTANT: CTO codes ALWAYS start with the prefix "WN-".
                2. The equipment type: "CTO", "MUFA", or "RESERVA".
                   VISUAL CUES:
                   - CTO: Rectangular boxes with multiple guest connector ports (customer drop cables). Look for "WN-" codes.
                   - MUFA: Large black splice closures, usually cylindrical (bottle-shaped) or large rectangles without customer ports. 
                   - RESERVA: Coil of fiber optic cable, usually in a loop on the pole, sometimes on a cross-arm or bracket.
                3. The GPS coordinates (latitude and longitude) shown in the overlay text. 
                   IMPORTANT: These photos are from PERU. Coordinates should be in the range of Lat: -18 to 0 and Lon: -82 to -68.
                4. The date and time shown in the overlay text.
                5. The power reading from the "OPTICAL POWER METER" device (e.g., -18.02 dBm).
                
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
          systemInstruction: "You are a specialized data extractor for optical network equipment photos in Peru. CTO codes always start with 'WN-'. Coordinates in Peru are always South (negative latitude) and West (negative longitude).",
          ...(isNanoBanana ? {} : {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["CTO", "MUFA", "RESERVA"] },
                coordinates: { type: Type.STRING },
                timestamp: { type: Type.STRING },
                power: { type: Type.STRING },
              },
              required: ["code", "type", "coordinates", "timestamp", "power"],
            },
          })
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      let parsedResult: ExtractionResult;
      try {
        // Handle potential markdown code blocks in non-JSON mode
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        parsedResult = JSON.parse(jsonStr) as ExtractionResult;
      } catch (e) {
        console.error("Failed to parse AI response:", text);
        throw new Error("La IA no devolvió un formato válido. Intenta de nuevo.");
      }
      
      return { result: parsedResult, model: modelName };

    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('quota');
      const isOverloaded = errorMessage.includes('503') || errorMessage.includes('high demand');
      const isPermissionDenied = errorMessage.includes('403') || errorMessage.includes('permission');
      
      if (isRateLimit) {
        lastError = new Error("Límite de velocidad (RPM) o cuota diaria (RPD) excedida. Google permite pocas fotos por minuto en la versión gratuita. Espera 10 segundos e intenta de nuevo.");
      } else if (isOverloaded) {
        lastError = new Error("El servidor de Google está saturado en este momento. Reintentando en unos segundos...");
      } else if (isPermissionDenied) {
        lastError = new Error("Permiso denegado (403). La llave de Gemini interna tiene restricciones de dominio y no funciona en vistas compartidas o externas. Por favor, usa OpenRouter en los Ajustes o configura tu propia llave de Gemini en el editor.");
      }
      
      if ((isRateLimit || isOverloaded) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      break;
    }
  }

  // Throw original error to allow App.tsx to detect type
  throw lastError;
}
