import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export class GeminiApiError extends Error {
  constructor(message: string) {
    // Strip API key if present
    const key = process.env.GEMINI_API_KEY;
    const sanitized = key && key.length > 4 ? message.split(key).join('[REDACTED]') : message;
    super(sanitized);
    this.name = 'GeminiApiError';
  }
}

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError('GEMINI_API_KEY environment variable is missing');
  }
  return new GoogleGenAI({ apiKey });
}

export async function generateJson<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  options?: { model?: string; temperature?: number }
): Promise<T> {
  const ai = getGeminiClient();
  const model = options?.model || GEMINI_MODEL;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: options?.temperature ?? 0.2,
      },
    });

    const text = response.text || '';
    if (!text) {
      throw new GeminiApiError('Empty response from Gemini API');
    }

    const parsedJson = JSON.parse(text);
    return schema.parse(parsedJson);
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) {
      throw err;
    }
    const msg = (err as Error)?.message || 'Gemini generation error';
    throw new GeminiApiError(msg);
  }
}

export async function testGeminiHealth(): Promise<boolean> {
  try {
    const ai = getGeminiClient();
    // Quick smoke call
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Ping',
      config: {
        maxOutputTokens: 5,
      },
    });
    return !!res.text;
  } catch (err) {
    return false;
  }
}

