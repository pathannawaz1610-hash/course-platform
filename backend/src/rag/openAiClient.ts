import { OpenAIGateway } from "../gateways/implementations/OpenAIGateway";
import { PERSONA_KEYS } from "../services/personaPromptTemplates";

const llmGateway = new OpenAIGateway();

export async function createEmbedding(text: string): Promise<number[]> {
  // Gateway handles error logging/checking internally or returns empty array on failure
  // adapting to existing signature which throws
  const vector = await llmGateway.generateEmbedding(text);
  if (!vector || vector.length === 0) {
    if (!llmGateway.isConfigured()) {
      throw new Error("OpenAI Gateway not configured");
    }
    throw new Error("OpenAI did not return an embedding vector");
  }
  return vector;
}

async function runChatCompletion(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const response = await llmGateway.generateResponse({
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt }
    ],
    temperature: options.temperature,
    // max_tokens is not directly exposed in generateResponse interface I defined, 
    // but commonly needed. I should update Interface or just rely on default.
    // waiting... let's update interface later if needed, for now standard gateway call.
  });

  if (!response) {
    if (!llmGateway.isConfigured()) {
      throw new Error("OpenAI Gateway not configured");
    }
    throw new Error("OpenAI did not return a chat completion");
  }
  return response.trim();
}

export async function generateAnswerFromContext(prompt: string): Promise<string> {
  return runChatCompletion({
    systemPrompt: "You are MetaLearn's AI mentor. Answer with warmth and clarity using only the provided course material.",
    userPrompt: prompt,
  });
}

export async function rewriteFollowUpQuestion(options: {
  question: string;
  lastAssistantMessage: string;
  summary?: string | null;
}): Promise<string> {
  const summaryBlock = options.summary?.trim()
    ? `Conversation summary:\n${options.summary.trim()}`
    : "";
  const prompt = [
    "Rewrite the user's question so it is a standalone question that preserves the intended meaning.",
    "Use the previous assistant response for context. If the question is already clear, return it unchanged.",
    "Return only the rewritten question text.",
    "",
    summaryBlock,
    `Previous assistant response:\n${options.lastAssistantMessage}`,
    `User question:\n${options.question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runChatCompletion({
    systemPrompt:
      "You rewrite follow-up questions into standalone questions without adding new information.",
    userPrompt: prompt,
    temperature: 0.1,
    maxTokens: 80,
  });
}

export async function summarizeConversation(options: {
  previousSummary?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const historyBlock = options.messages
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");
  const summaryBlock = options.previousSummary?.trim()
    ? `Existing summary:\n${options.previousSummary.trim()}`
    : "";
  const prompt = [
    "Summarize the conversation so far. Focus on the learner's goals, questions, and key definitions.",
    "Do not invent facts. Keep it concise and useful for future follow-up questions.",
    "",
    summaryBlock,
    "New turns to summarize:",
    historyBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runChatCompletion({
    systemPrompt:
      "You are a helpful assistant that produces concise, factual summaries for chat memory.",
    userPrompt: prompt,
    temperature: 0.2,
    maxTokens: 220,
  });
}

export async function generateTutorCopilotAnswer(prompt: string): Promise<string> {
  return runChatCompletion({
    systemPrompt:
      "You are MetaLearn's tutor analytics copilot. Use only the provided learner roster and stats. Call out concrete numbers, " +
      "flag at-risk learners, and keep responses concise (3-5 sentences). If information is missing, say so directly.",
    userPrompt: prompt,
    temperature: 0.15,
  });
}

export async function classifyLearnerPersona(options: {
  responses: Array<{ question: string; answer: string }>;
}): Promise<{ personaKey: string; reasoning: string }> {
  const responsesBlock = options.responses
    .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
    .join("\n\n");
  const personaDefinitions = [
    "non_it_migrant: new to IT, anxious about programming, prefers slow explanations and real-world analogies.",
    "rote_memorizer: knows theory but struggles to implement, wants templates and exam-style patterns.",
    "english_hesitant: understands logic but struggles with English fluency, needs simple language.",
    "last_minute_panic: behind schedule, needs fast, high-impact guidance and a clear action plan.",
    "pseudo_coder: copy-pastes code, needs line-by-line clarity and small changes to build understanding.",
  ].join("\n");

  const prompt = [
    "Classify the learner into exactly one persona key from the list below.",
    "Return a JSON object with keys: personaKey, reasoning.",
    `Persona keys: ${PERSONA_KEYS.join(", ")}`,
    "Persona definitions:",
    personaDefinitions,
    "",
    "Learner responses:",
    responsesBlock,
  ].join("\n");

  const raw = await runChatCompletion({
    systemPrompt:
      "You are a strict classifier. Return JSON only and choose exactly one personaKey from the provided list.",
    userPrompt: prompt,
    temperature: 0.1,
    maxTokens: 200,
  });

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Persona classification response did not include JSON.");
  }

  const jsonBlock = raw.slice(start, end + 1);
  return JSON.parse(jsonBlock) as { personaKey: string; reasoning: string };
}

export async function generateLandingPageAnswer(userPrompt: string, databaseContext: string = "", turnCount: number = 0): Promise<string> {
  const dynamicContext = databaseContext ? `\n\nDATABASE CONTEXT:\n${databaseContext}` : "";

  let systemPrompt = `You are the friendly, helpful AI Assistant for Ottolearn's landing page.
Your goal is to explain our three main learning programs to visitor.
Do not answer technical coding questions. Redirect them to sign up for that.

Here is your Knowledge Base:

1. Cohorts (The "Bootcamp" Experience)
   - What: Live, instructor-led, schedule-based batches (typically 8-12 weeks).
   - Who: Learners who need structure, accountability, and peer motivation.
   - Structure: Live classes (Zoom/Meet), dedicated TAs, mentorship, peer groups.
   - Real World Model: Like a university semester or bootcamp.
   - Assistance: High touch – live Q&A, office hours, code reviews.
   - Ideal for: Career switchers, deep divers.

2. Workshops (The "Masterclass" Experience)
   - What: Short, intensive, task-focused sessions.
   - Time: 1-2 days (weekend) or a few hours.
   - Focus: Specific skills (e.g., "Mastering UseEffect", "Deploying to AWS").
   - Real World Model: Like a corporate training session or masterclass.
   - Assistance: Live instructor guidance during the session.
   - Ideal for: Developers needing a quick specific upskill.

3. On-Demand Courses (The "Self-Paced" Experience)
   - What: Self-paced, pre-recorded, flexible learning.
   - Time: Lifetime access, 24/7 availability.
   - Assistance: AI Tutor (24/7) and Community Forums.
   - Real World Model: Like Udemy/Coursera but with Ottolearn's AI platform.
   - Ideal for: Busy professionals, independent learners.

${dynamicContext}

If the user asks "which is best", ask about their schedule and goals.
Use the DATABASE CONTEXT to answer specific questions about available courses, pricing, or dates.
IMPORTANT: You must ONLY answer based on the information provided above (Knowledge Base + Database Context).
If the user asks about ANY topic not related to these programs (e.g., world history, general coding help, recipes), you must politely refuse and say: "I can only answer questions about Ottolearn's cohorts, workshops, and on-demand courses."`;

  // Throttling: Ask AI to generate suggestions for up to 10 turns (covering Guest + User limits)
  if (turnCount < 10) {
    systemPrompt += `\n\nAfter your answer, follow these steps:
1. DETECT INTENT: If the user is asking about a specific program, append a redirect action on a new line:
   - Cohorts -> <<ACTION:/our-courses/cohort>>
   - Workshops -> <<ACTION:/our-courses/workshops>>
   - On-Demand -> <<ACTION:/our-courses/on-demand>>
   (Only one action per response. If generic, do not add an action.)

2. GENERATE SUGGESTIONS: Generate 3 follow-up questions.
   - Two questions directly related to the user's last query.
   - One question pivoting to a related program.
   - IMPORTANT: Only suggest questions that you can answer using your Knowledge Base.
   - Format: <<SUGGESTIONS>>Question 1?|Question 2?|Question 3?

3. BREVITY: If you included an <<ACTION:...>> tag, keep your text explanation short (max 2-3 sentences) to encourage clicking the button.`;
  }

  return runChatCompletion({
    systemPrompt,
    userPrompt,
    temperature: 0.3,
    maxTokens: 400,
  });
}
