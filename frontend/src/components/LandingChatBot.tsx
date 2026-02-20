import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, X, Bot, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/api";
import { queryLandingAssistant } from '@/lib/binding/actions/assistantActions';
import { streamJobResult } from "@/lib/streamJob";

// Themes for the landing page (Retro Teal/Sage/Salmon)
const THEME = {
    primary: "bg-[#244855]", // Retro Teal
    primaryHover: "hover:bg-[#E64833]", // Retro Salmon
    secondary: "bg-[#E64833]", // Retro Salmon
    accent: "bg-[#90AEAD]", // Retro Sage
    bg: "bg-[#FBE9D0]", // Retro BG
    text: "text-[#244855]",
};

interface Message {
    id: string;
    text: string;
    isBot: boolean;
    timestamp: Date;
    suggestions?: string[];
}

const INITIAL_SUGGESTIONS = [
    "What are Cohorts?",
    "Tell me about Workshops",
    "How does On-Demand work?"
];

interface LandingChatBotProps {
    userName?: string;
}

const SESSION_KEY = "otto_landing_chat_history";
const GUEST_LIMIT = 5;
const USER_LIMIT = 10;

export default function LandingChatBot({ userName }: LandingChatBotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem(SESSION_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Restore Date objects
                    return parsed.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                } catch (e) {
                    console.error("Failed to parse chat history", e);
                }
            }
        }
        return [];
    });
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    // Refs for scrolling and input focus
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Persist messages
    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
        }
    }, [messages]);

    // Initialize or update greeting when userName changes
    useEffect(() => {
        const greeting = userName
            ? `Hi ${userName}! I'm the Ottolearn guide. I can help explain our Cohorts, Workshops, and On-Demand courses. What are you looking for today?`
            : "Hi! I'm the Ottolearn guide. I can help explain our Cohorts, Workshops, and On-Demand courses. What are you looking for today?";

        setMessages((prev) => {
            // If empty, add intro
            if (prev.length === 0) {
                return [{
                    id: "intro",
                    text: greeting,
                    isBot: true,
                    timestamp: new Date(),
                    suggestions: INITIAL_SUGGESTIONS
                }];
            }
            // Update intro if it exists (handling async name load)
            const firstMsg = prev[0];
            if (firstMsg.id === "intro" && firstMsg.text !== greeting) {
                const newMessages = [...prev];
                newMessages[0] = { ...firstMsg, text: greeting };
                return newMessages;
            }
            return prev;
        });
    }, [userName]);

    // Auto scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, isOpen]);

    // Focus input after bot responds
    useEffect(() => {
        // Only auto-focus if not hit limit
        const userCount = messages.filter(m => !m.isBot).length;
        const limit = userName ? USER_LIMIT : GUEST_LIMIT;

        if (!isTyping && isOpen && inputRef.current && userCount < limit) {
            const timeout = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [isTyping, isOpen, messages, userName]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || inputValue.trim();
        if (!messageText || isTyping) return;

        // Check Limits
        const userCount = messages.filter(m => !m.isBot).length;
        const limit = userName ? USER_LIMIT : GUEST_LIMIT;

        if (userCount >= limit) {
            // If guest hit limit, prompt login. If user hit limit, soft block.
            /* Logic handled in UI, but safety check here */
            return;
        }

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            text: messageText,
            isBot: false,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsTyping(true);

        try {
            // ✅ UPDATED: Use assistantActions instead of direct fetch
            const data = await queryLandingAssistant(messageText, messages.length);

            // ── Resolve the AI answer (async SSE or legacy sync) ──
            let result: Record<string, unknown>;
            if (data.jobId) {
                // Async path — stream the result via SSE
                result = await streamJobResult(
                    buildApiUrl(`/api/landing-assistant/stream/${data.jobId}`)
                );
            } else {
                // Sync fallback (backward compatible)
                result = data as Record<string, unknown>;
            }

            // Parse response for suggestions and actions
            let botText = (result.answer as string) || "";
            let suggestions: string[] = [];
            let actionUrl: string | undefined;

            // Extract Action URL
            if (botText.includes("<<ACTION:")) {
                const actionMatch = botText.match(/<<ACTION:(.*?)>>/);
                if (actionMatch) {
                    actionUrl = actionMatch[1].trim();
                    botText = botText.replace(actionMatch[0], "").trim();
                }
            }

            if (botText.includes("<<SUGGESTIONS>>")) {
                const parts = botText.split("<<SUGGESTIONS>>");
                botText = parts[0].trim();
                const rawSuggestions = parts[1] || "";
                suggestions = rawSuggestions.split("|").map((s: string) => s.trim()).filter(Boolean);
            } else if (messages.length >= 8) {
                // Fallback for later turns (Tier 2 Throttling) - ONLY if no specific action was found
                if (!actionUrl) {
                    suggestions = ["View All Courses", "Pricing", "Apply as Tutor"];
                }
            }

            setMessages((prev) => [
                ...prev,
                {
                    id: `bot-${Date.now()}`,
                    text: botText,
                    isBot: true,
                    timestamp: new Date(),
                    suggestions: suggestions.length > 0 ? suggestions : undefined,
                    actionUrl // Save the action URL
                },
            ]);
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    text: error instanceof Error ? error.message : "I'm having trouble connecting to the server.",
                    isBot: true,
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSendMessage();
        }
    };

    const userMsgCount = messages.filter(m => !m.isBot).length;
    const currentLimit = userName ? USER_LIMIT : GUEST_LIMIT;
    const isLimitReached = userMsgCount >= currentLimit;

    return (
        <div className="fixed bottom-6 right-6 z-50 font-sans">
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className={`h-14 w-14 rounded-full shadow-xl transition-all duration-300 ${THEME.primary} ${THEME.primaryHover} animate-bounce`}
                >
                    <MessageCircle className="h-7 w-7 text-white" />
                </Button>
            )}

            {isOpen && (
                <Card className="w-[350px] h-[500px] flex flex-col shadow-2xl border-2 border-[#90AEAD]/30 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <CardHeader className={`${THEME.primary} text-white py-4 px-5 flex flex-row items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Ottolearn Guide</CardTitle>
                                <p className="text-xs text-white/80">
                                    {userName ? `Hi, ${userName}` : 'Ask about our programs'}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col p-0 bg-white overflow-hidden">
                        {/* Native Scroll Container */}
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                            ref={scrollRef}
                        >
                            {messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={`flex flex-col ${m.isBot ? "items-start" : "items-end"}`}
                                >
                                    <div
                                        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${m.isBot
                                            ? "bg-[#FBE9D0] text-[#244855] rounded-tl-none"
                                            : "bg-[#244855] text-white rounded-tr-none"
                                            }`}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed">
                                            {m.text}
                                        </p>
                                        <span className="text-[10px] opacity-70 mt-1 block">
                                            {m.timestamp.toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>

                                    {/* Primary Redirect Action */}
                                    {/* We cast to any because TS doesn't know about actionUrl on Message yet, 
                                        but we are treating the local state as flexible or need to update interface */}
                                    {(m as any).actionUrl && (
                                        <div className="mt-2 w-[85%]">
                                            <Button
                                                onClick={() => window.location.href = (m as any).actionUrl}
                                                className={`w-full ${THEME.secondary} hover:bg-[#c43e2b] text-white shadow-md transition-all`}
                                                size="sm"
                                            >
                                                View {
                                                    (m as any).actionUrl.includes("cohort") ? "Cohorts" :
                                                        (m as any).actionUrl.includes("workshop") ? "Workshops" :
                                                            (m as any).actionUrl.includes("on-demand") ? "On-Demand Courses" : "Page"
                                                }
                                            </Button>
                                        </div>
                                    )}

                                    {m.suggestions && !isLimitReached && (
                                        <div className="mt-2 flex flex-wrap gap-2 max-w-[85%]">
                                            {m.suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSendMessage(s)}
                                                    className="text-xs bg-white border border-[#244855]/20 text-[#244855] px-3 py-1.5 rounded-full hover:bg-[#244855] hover:text-white transition-colors text-left"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-[#FBE9D0] px-4 py-3 rounded-2xl rounded-tl-none text-[#244855] flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">Typing...</span>
                                    </div>
                                </div>
                            )}

                            {/* Limit Reached Notice */}
                            {isLimitReached && (
                                <div className="flex justify-center my-4">
                                    <div className="bg-gray-100 px-4 py-3 rounded-xl text-center shadow-inner mx-4">
                                        <p className="text-sm font-semibold text-[#244855] mb-2">
                                            {userName
                                                ? "You've reached the daily question limit."
                                                : "You've reached the guest limit!"}
                                        </p>
                                        {!userName && (
                                            <p className="text-xs text-gray-600 mb-3">
                                                Sign in now to get 5 more questions and save your chat history.
                                            </p>
                                        )}
                                        {!userName && (
                                            <Button
                                                onClick={() => {
                                                    sessionStorage.setItem("postLoginRedirect", "/");
                                                    window.location.href = `${buildApiUrl('/auth/google')}?redirect=${encodeURIComponent('/')}`;
                                                }}
                                                size="sm"
                                                className={`${THEME.primary} text-white w-full`}
                                            >
                                                Sign In to Continue
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t bg-gray-50">
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        isLimitReached
                                            ? (userName ? "Available limit reached" : "Sign in to continue chatting")
                                            : "Ask about Cohorts, Workshops..."
                                    }
                                    className="bg-white border-gray-300 focus-visible:ring-[#244855]"
                                    autoFocus
                                    disabled={isLimitReached}
                                />
                                <Button
                                    onClick={() => void handleSendMessage()}
                                    disabled={!inputValue.trim() || isTyping || isLimitReached}
                                    size="icon"
                                    className={THEME.primary}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
