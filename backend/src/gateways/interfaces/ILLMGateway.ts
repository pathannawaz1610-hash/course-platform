import { OpenAI } from "openai";

export interface ILLMGateway {
    /**
     * Generates a chat completion response.
     */
    generateResponse(params: {
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        model?: string;
        temperature?: number;
        response_format?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
    }): Promise<string | null>;

    /**
     * Generates embeddings for a given text input.
     */
    generateEmbedding(text: string): Promise<number[]>;

    /**
     * Transcribes an audio file.
     */
    transcribeAudio(file: File | Blob | any): Promise<string>;

    /**
     * Validates if the service is available/configured.
     */
    isConfigured(): boolean;
}
