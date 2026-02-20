import { OpenAI } from "openai";
import { ILLMGateway } from "../../src/gateways/interfaces/ILLMGateway";

export class MockLLMGateway implements ILLMGateway {
    isConfigured(): boolean {
        return true;
    }

    async generateResponse(params: {
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        model?: string;
        temperature?: number;
        response_format?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
    }): Promise<string | null> {
        return "Mocked LLM Response";
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return new Array(1536).fill(0.1);
    }

    async transcribeAudio(file: File | Blob | any): Promise<string> {
        return "Mocked Audio Transcription";
    }
}
