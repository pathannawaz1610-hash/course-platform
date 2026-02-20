import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIGateway } from "../../src/gateways/implementations/OpenAIGateway";

// Mock openai
vi.mock("openai", () => {
    const OpenAI = vi.fn();
    OpenAI.prototype.chat = {
        completions: {
            create: vi.fn(),
        },
    };
    OpenAI.prototype.embeddings = {
        create: vi.fn(),
    };
    OpenAI.prototype.audio = {
        transcriptions: {
            create: vi.fn(),
        }
    };
    return { OpenAI };
});

import { OpenAI } from "openai";

describe("OpenAIGateway", () => {
    let gateway: OpenAIGateway;
    let mockOpenAI: any;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OPENAI_API_KEY = "test-key";
        gateway = new OpenAIGateway();
        // Access the mock instance
        mockOpenAI = (OpenAI as any).mock.instances[0];
    });

    describe("generateResponse", () => {
        it("should return text content", async () => {
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{ message: { content: "Hello" } }]
            });

            const result = await gateway.generateResponse({ messages: [] });
            expect(result).toBe("Hello");
        });

        it("should return null on failure", async () => {
            mockOpenAI.chat.completions.create.mockRejectedValue(new Error("API Error"));
            const result = await gateway.generateResponse({ messages: [] });
            expect(result).toBeNull();
        });
    });

    describe("generateEmbedding", () => {
        it("should return embedding vector", async () => {
            const mockVector = [0.1, 0.2];
            mockOpenAI.embeddings.create.mockResolvedValue({
                data: [{ embedding: mockVector }]
            });

            const result = await gateway.generateEmbedding("test");
            expect(result).toEqual(mockVector);
        });
    });
});
