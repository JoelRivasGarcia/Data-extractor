import { ExtractionResult } from "../types";

export async function extractWithOpenRouter(
  base64Image: string,
  mimeType: string,
  modelName: string,
  apiKey: string
): Promise<{ result: ExtractionResult; model: string }> {
  if (!apiKey) {
    throw new Error("API Key de OpenRouter no configurada.");
  }

  const prompt = `Extract the following data from this photo of optical equipment:
1. The large serial code/identifier printed on the equipment (e.g., WN-20A-2369450). 
   IMPORTANT: CTO codes ALWAYS start with the prefix "WN-".
2. The equipment type: "CTO", "MUFA", or "RESERVA".
3. The GPS coordinates (latitude and longitude) shown in the overlay text. 
   IMPORTANT: These photos are from PERU. Coordinates should be in the range of Lat: -18 to 0 and Lon: -82 to -68.
4. The date and time shown in the overlay text.
5. The power reading from the "OPTICAL POWER METER" device (e.g., -18.02 dBm).

Return the result strictly in JSON format with the following keys: code, type, coordinates, timestamp, power.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Optical Data Extractor",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a specialized data extractor for optical network equipment photos in Peru. CTO codes always start with 'WN-'. Coordinates in Peru are always South (negative latitude) and West (negative longitude). Return only JSON."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Image // OpenRouter supports base64 data URLs
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Error de OpenRouter: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let parsedResult: ExtractionResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      parsedResult = JSON.parse(jsonStr) as ExtractionResult;
    } catch (e) {
      console.error("Failed to parse OpenRouter response:", content);
      throw new Error("La IA no devolvió un formato válido.");
    }

    return { result: parsedResult, model: modelName };
  } catch (error: any) {
    console.error("OpenRouter Error:", error);
    throw error;
  }
}

export async function fetchOpenRouterModels(apiKey: string) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!response.ok) throw new Error("Failed to fetch models");
    const data = await response.json();
    return data.data; // Array of models
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}
