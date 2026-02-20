import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, X, Bot, User, Loader2 } from "lucide-react";
import { queryAssistant } from '@/lib/binding/actions/assistantActions';
import { ensureSessionFresh, logoutAndRedirect, subscribeToSession } from "@/utils/session";
import type { StoredSession } from "@/types/session";

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatBotProps {
  courseName?: string;
  courseId?: string;
  moduleNo?: number;
}

const createIntroMessage = (courseName?: string): Message => ({
  id: "assistant-intro",
  text: `Hi! I'm your AI learning assistant for ${courseName ?? "this course"}. Ask anything about the lessons and I'll answer based on the official course material.`,
  isBot: true,
  timestamp: new Date(),
});

export default function ChatBot({ courseName, courseId, moduleNo }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [createIntroMessage(courseName)]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = Boolean(session?.accessToken);

  useEffect(() => {
    const unsubscribe = subscribeToSession((nextSession) => {
      setSession(nextSession);
    });
    return () => unsubscribe();
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages, isTyping]);

  const disabledReason = useMemo(() => {
    if (!courseId) {
      return "The assistant needs a course context to answer questions.";
    }
    if (!isAuthenticated) {
      return "Sign in to chat with the course assistant.";
    }
    return null;
  }, [courseId, isAuthenticated]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputValue.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = inputValue.trim();
    setInputValue("");
    setIsTyping(true);

    try {
      const freshSession = await ensureSessionFresh(session);
      if (!freshSession?.accessToken) {
        logoutAndRedirect("/");
        throw new Error("Please sign in to chat with the learning assistant.");
      }
      if (freshSession !== session) {
        setSession(freshSession);
      }

      const answer = await requestAssistantAnswer({
        courseId,
        courseName,
        moduleNo,
        question,
        accessToken: freshSession.accessToken,
      });

      const botResponse: Message = {
        id: `bot-${Date.now()}`,
        text: answer,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error: any) {
      const fallback: Message = {
        id: `error-${Date.now()}`,
        text:
          error instanceof Error
            ? error.message
            : "Sorry, I couldn't reach the learning assistant. Please try again.",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 sm:bottom-4 sm:right-4 xs:bottom-3 xs:right-3 z-50">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 sm:h-12 sm:w-12 xs:h-10 xs:w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 pulse-glow"
          >
            <MessageCircle className="h-6 w-6 sm:h-5 sm:w-5 xs:h-4 xs:w-4 text-white" />
          </Button>
        )}

        {isOpen && (
          <Card className="w-96 max-w-[calc(100vw-2rem)] h-[500px] lg:w-96 md:w-80 sm:w-72 xs:w-[calc(100vw-1rem)] md:h-[500px] sm:h-[450px] xs:h-[400px] bg-background/95 backdrop-blur border-border shadow-xl flex flex-col overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Learning Assistant</CardTitle>
                  <p className="text-xs text-white/80">
                    {disabledReason ?? "Always here to help"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col px-0 pb-0 min-h-0">
              <ScrollArea className="flex-1 min-h-0 px-4" ref={scrollAreaRef}>
                <div className="space-y-4 py-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${message.isBot
                          ? "bg-muted text-foreground"
                          : "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-xs opacity-80">
                          {message.isBot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          <span>{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="whitespace-pre-line leading-relaxed">{message.text}</p>
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-muted text-foreground shadow-md flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>The assistant is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t bg-muted/40 px-4 py-3 space-y-2">
                {disabledReason && (
                  <p className="text-xs text-muted-foreground flex-1 text-center">{disabledReason}</p>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask me anything about this course..."
                    className="flex-1"
                    disabled={Boolean(disabledReason) || isTyping}
                  />
                  <Button
                    onClick={() => void handleSendMessage()}
                    disabled={!inputValue.trim() || Boolean(disabledReason) || isTyping}
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-9 sm:h-8 xs:h-7 w-9 sm:w-8 xs:w-7 p-0"
                  >
                    <Send className="h-4 w-4 sm:h-3 sm:w-3 xs:h-2.5 xs:w-2.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

async function requestAssistantAnswer(params: {
  courseId?: string;
  courseName?: string;
  moduleNo?: number;
  question: string;
  accessToken: string;
}): Promise<string> {
  if (!params.courseId) {
    throw new Error("I need to know which course you're viewing before I can help.");
  }

  try {
    // ✅ UPDATED: Use assistantActions instead of direct fetch
    const session = { accessToken: params.accessToken };
    const result = await queryAssistant(
      params.question,
      {
        courseId: params.courseId,
        topicId: undefined,
        moduleNo: params.moduleNo,
        sessionId: undefined,
      },
      session
    );
    return result.answer;
  } catch (error: any) {
    if (error.status === 401) {
      logoutAndRedirect("/");
      throw new Error("Your session expired. Please sign in again.");
    }
    if (error.status === 403) {
      throw new Error(error.message ?? "You are not in the cohort batch, please register first.");
    }
    if (error.status === 429) {
      throw new Error("You are asking very quickly. Please wait a moment before trying again.");
    }
    const message = error.message || "The assistant could not process that request.";
    // If it's the moduleNo error, make it user friendly
    if (message.includes("moduleNo is required")) {
      return "I need to know which module you are on to help you. Please try refreshing the page.";
    }
    throw new Error(message);
  }
}
