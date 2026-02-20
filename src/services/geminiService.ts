
import { GoogleGenAI, Type } from "@google/genai";

// Guidelines: The API key must be obtained exclusively from process.env.API_KEY
// and used directly when initializing GoogleGenAI.

export const auditPost = async (title: string, description: string): Promise<{ isSafe: boolean; reason?: string }> => {
  // Always initialize with process.env.API_KEY directly as a named parameter
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Audita el siguiente título y descripción de una publicación para un mapa estudiantil universitario. Determina si contiene lenguaje ofensivo, discriminatorio, o contenido inapropiado para una comunidad académica. Responde estrictamente en JSON.
      Título: ${title}
      Descripción: ${description}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { 
              type: Type.BOOLEAN,
              description: "Indica si la publicación es segura para la comunidad."
            },
            reason: { 
              type: Type.STRING,
              description: "La razón por la cual no es segura, si aplica."
            }
          },
          required: ["isSafe"]
        }
      }
    });

    // Guidelines: Use .text property, not .text() method
    const text = response.text?.trim();
    if (!text) return { isSafe: true };
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    return { isSafe: true }; // Fallback to safe if AI fails to ensure service availability
  }
};

export const getGeminiAdvice = async (query: string): Promise<string> => {
  // Always initialize with process.env.API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Eres 'UDP Bot', un asistente experto en los campus de la Universidad Diego Portales (UDP) en Santiago, Chile. 
      Ayudas a los alumnos a encontrar lugares como salas, baños, enchufes o zonas de descanso. 
      Sé breve, amable y usa un tono universitario chileno.
      Pregunta: ${query}`,
    });
    // Guidelines: Use .text property
    return response.text || "Lo siento, no pude obtener una respuesta en este momento.";
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    return "Lo siento, tuve un problema al conectarme con mis servidores de IA.";
  }
};
