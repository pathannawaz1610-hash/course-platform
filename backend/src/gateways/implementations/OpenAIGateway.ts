import { OpenAI } from "openai";
import { ILLMGateway } from "../interfaces/ILLMGateway";

export class OpenAIGateway implements ILLMGateway {
    private client: OpenAI | null = null;
    private isAvailable: boolean = false;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.client = new OpenAI({ apiKey });
            this.isAvailable = true;
        } else {
            console.warn("OpenAIGateway: OPENAI_API_KEY not found. LLM features will be disabled.");
        }
    }

    isConfigured(): boolean {
        return this.isAvailable && !!this.client;
    }

    async generateResponse(params: {
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        model?: string;
        temperature?: number;
        response_format?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
    }): Promise<string | null> {
        if (!this.client) return null;

        try {
            const completion = await this.client.chat.completions.create({
                model: params.model || "gpt-4o",
                messages: params.messages,
                temperature: params.temperature ?? 0.7,
                response_format: params.response_format,
            });

            return completion.choices[0]?.message?.content ?? null;
        } catch (error) {
            console.error("OpenAIGateway: generateResponse failed", error);
            return null;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.client) return [];

        try {
            const response = await this.client.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error("OpenAIGateway: generateEmbedding failed", error);
            return [];
        }
    }

    async transcribeAudio(file: File | Blob | any): Promise<string> {
        if (!this.client) throw new Error("OpenAI client not configured");

        try {
            const response = await this.client.audio.transcriptions.create({
                file: file,
                model: "whisper-1",
            });
            return response.text;
        } catch (error) {
            console.error("OpenAIGateway: transcribeAudio failed", error);
            throw error;
        }
    }
}
