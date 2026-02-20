import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode, RefObject, MouseEvent as ReactMouseEvent } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { CartItem, CartResponse } from '@/types/cart';
import type { CourseListResponse, CourseSummary } from '@/types/content';
import type { StoredSession } from '@/types/session';
import { fetchCart as fetchCartAction, addToCart as addToCartAction } from '@/lib/binding/actions/cartActions';
import { fetchCourses } from '@/lib/binding/actions/courseActions';
import { logout as logoutAction } from '@/lib/binding/actions/authActions';
import { buildApiUrl } from '@/lib/api'; // Still needed for Google OAuth redirect
import {
    Star,
    Clock,
    Users,
    Play,
    Plus,
    BookOpen,
    TrendingUp,
    Award,
    ChevronLeft, // For scroller
    ChevronRight, // For scroller
} from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { FONT_PLAYFAIR_STACK } from '@/constants/theme';

const FONT_PLAYFAIR = FONT_PLAYFAIR_STACK;

interface Course {
    id: string;
    title: string;
    description: string;
    instructor: string;
    duration: string;
    price: number;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    students: number;
    rating: number;
    category: string;
    thumbnail: string;
    isEnrolled?: boolean;
    progress?: number;
}

interface AuthenticatedUser {
    id: string;
    fullName: string;
    email: string;
    picture?: string;
    emailVerified?: boolean;
}

const formatDurationFromMinutes = (minutes?: number): string => {
    if (!minutes || minutes <= 0) {
        return 'Self-paced';
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (hours === 0) {
        return `${minutes} mins`;
    }
    if (remaining === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${hours}h ${remaining}m`;
};

const mapCourseSummaryToCourse = (course: CourseSummary): Course => {
    const normalizedPrice =
        typeof course.price === 'number'
            ? course.price
            : Math.max(0, Math.round((course.priceCents ?? 0) / 100));

    return {
        id: course.id,
        title: course.title,
        description: course.description,
        instructor: course.instructor ?? 'Ottolearn Instructor',
        duration: course.durationLabel ?? formatDurationFromMinutes(course.durationMinutes),
        price: normalizedPrice,
        level: (course.level as Course['level']) ?? 'Beginner',
        students: course.students ?? 0,
        rating: course.rating ?? 0,
        category: course.category ?? 'AI & Technology',
        thumbnail: course.thumbnail ?? '',
    };
};

const mergeCourseCollections = (current: Course[], incoming: Course[]): Course[] => {
    const registry = new Map<string, Course>();
    current.forEach((course) => {
        registry.set(course.id, course);
    });
    incoming.forEach((course) => {
        const existing = registry.get(course.id);
        registry.set(course.id, {
            ...course,
            isEnrolled: existing?.isEnrolled ?? course.isEnrolled,
            progress: existing?.progress ?? course.progress,
        });
    });
    return Array.from(registry.values());
};

const coursesData: Course[] = [
    {
        id: 'ai-native-fullstack-developer',
        title: 'AI in Web Development',
        description: 'Master the integration of AI technologies in modern web development. Learn to build intelligent applications using machine learning APIs, natural language processing, and computer vision.',
        instructor: 'Dr. Sarah Chen',
        duration: '8 hours',
        price: 3999,
        level: 'Beginner',
        students: 2847,
        rating: 4.8,
        category: 'AI & Machine Learning',
        thumbnail: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=800&q=80',
        isEnrolled: true,
        progress: 65
    },
    {
        id: 'full-stack-react-mastery',
        title: 'Full Stack React Mastery',
        description: 'Complete guide to React ecosystem including Next.js, TypeScript, state management, testing, and deployment. Build production-ready applications.',
        instructor: 'Alex Rodriguez',
        duration: '12 hours',
        price: 6499,
        level: 'Intermediate',
        students: 1523,
        rating: 4.9,
        category: 'Frontend Development',
        thumbnail: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'python-for-automation',
        title: 'Python for Automation',
        description: 'Automate repetitive tasks and build powerful scripts with Python. Cover web scraping, file processing, API integration, and task scheduling.',
        instructor: 'Maria Garcia',
        duration: '6 hours',
        price: 3199,
        level: 'Beginner',
        students: 3241,
        rating: 4.7,
        category: 'Python & Automation',
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'advanced-javascript-concepts',
        title: 'Advanced JavaScript Concepts',
        description: 'Deep dive into JavaScript fundamentals, closures, prototypes, async programming, design patterns, and performance optimization.',
        instructor: 'John Mitchell',
        duration: '10 hours',
        price: 5699,
        level: 'Advanced',
        students: 987,
        rating: 4.6,
        category: 'JavaScript',
        thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'devops-for-developers',
        title: 'DevOps for Developers',
        description: 'Learn essential DevOps practices including CI/CD, Docker, Kubernetes, cloud deployment, monitoring, and infrastructure as code.',
        instructor: 'David Kim',
        duration: '15 hours',
        price: 8199,
        level: 'Intermediate',
        students: 756,
        rating: 4.5,
        category: 'DevOps & Cloud',
        thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80'
    }
];

const getEnrollPath = (course: Course): string =>
    course.id === 'ai-native-fullstack-developer'
        ? '/course/ai-native-fullstack-developer/learn/welcome-to-ai-journey'
        : `/course/${course.id}/learn/welcome-to-ai-journey`;

const getContinuePath = (course: Course): string =>
    course.id === 'ai-native-fullstack-developer'
        ? '/course/ai-native-fullstack-developer/learn/introduction-to-ai-web-development'
        : `/course/${course.id}/learn/getting-started`;

// --- NEW COURSE DATA FOR LANDING PAGE COURSES ---
const landingCoursesData: Course[] = [
    {
        id: 'g-mastery',
        title: 'Google Workspace Mastery',
        description: 'Docs, Sheets, Slides with automation.',
        instructor: 'Google Experts',
        duration: '7 hours', price: 2499, level: 'Beginner', students: 1200, rating: 4.9, category: 'Productivity',
        thumbnail: 'https://images.unsplash.com/photo-1553484771-371a605b060b?q=80&w=900&auto=format&fit=crop'
    },
    {
        id: 'fs-begin',
        title: 'Full-Stack for Beginners',
        description: 'HTML, CSS, JS, APIs, deployment.',
        instructor: 'Sarah Doe',
        duration: '10 hours', price: 4999, level: 'Beginner', students: 850, rating: 4.5, category: 'Frontend Development',
        thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=900&auto=format&fit=crop'
    },
    {
        id: 'data-sheets',
        title: 'Data Analysis with Sheets',
        description: 'Pivot tables, charts, AI formulas.',
        instructor: 'Dr. Jane Smith',
        duration: '5 hours', price: 2999, level: 'Intermediate', students: 1500, rating: 4.8, category: 'Data Analysis',
        thumbnail: 'https://images.unsplash.com/photo-1551281044-8b29c9a5ef6e?q=80&w=900&auto=format&fit=crop'
    },
    {
        id: 'tutor-path',
        title: 'Become a Tutor',
        description: 'Teach online and scale impact.',
        instructor: 'Mark Johnson',
        duration: '4 hours', price: 1999, level: 'Beginner', students: 600, rating: 4.6, category: 'Business',
        thumbnail: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=900&auto=format&fit=crop'
    },
    {
        id: 'career-design',
        title: 'Career Design',
        description: 'Portfolio, projects, interviews.',
        instructor: 'Lisa Ray',
        duration: '6 hours', price: 3499, level: 'Advanced', students: 400, rating: 5.0, category: 'Career',
        thumbnail: 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=900&auto=format&fit=crop'
    }
];

// --- END NEW COURSE DATA ---

const HeroIconBadge: React.FC<{ className: string; dataTip: string; label: string; children: ReactNode }> = ({ className, dataTip, label, children }) => {
    return (
        <button
            className={`absolute w-11 h-11 rounded-xl grid place-items-center bg-white border border-gray-200 shadow-lg cursor-default transition-all duration-200 ease-out hover:scale-[1.06] hover:shadow-xl hover:ring-2 hover:ring-green-600/25 focus-visible:ring-2 focus-visible:ring-green-600/25 focus:outline-none ${className} animate-float hover:z-10`}
            data-tip={dataTip}
            aria-label={label}
        >
            {children}
        </button>
    );
};

// Tooltip implementation would require a custom component or external library to fully mimic the CSS
// For now, the data-tip attribute is preserved for context.

const getCategoryGradient = (category: string) => {
    switch (category) {
        // Keeping original gradients for enrolled courses
        case 'AI & Machine Learning': return 'from-[hsl(var(--gradient-ai-ml-from))] to-[hsl(var(--gradient-ai-ml-to))]';
        case 'Frontend Development': return 'from-[hsl(var(--gradient-frontend-from))] to-[hsl(var(--gradient-frontend-to))]';
        case 'Python & Automation': return 'from-[hsl(var(--gradient-python-from))] to-[hsl(var(--gradient-python-to))]';
        case 'JavaScript': return 'from-[hsl(var(--gradient-javascript-from))] to-[hsl(var(--gradient-javascript-to))]';
        case 'DevOps & Cloud': return 'from-[hsl(var(--gradient-devops-from))] to-[hsl(var(--gradient-devops-to))]';
        // Using fixed Tailwind for the new design course cards (for simplicity)
        case 'Productivity': return 'from-indigo-500 to-blue-600';
        case 'Data Analysis': return 'from-yellow-500 to-orange-600';
        case 'Business': return 'from-pink-500 to-red-600';
        case 'Career': return 'from-purple-500 to-indigo-600';
        default: return 'from-gray-500 to-gray-600';
    }
};

const getUserInitials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?';

export default function DashboardPage() {
    const [location, setLocation] = useLocation();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    // Use the new landing page data + existing data for the initial display
    const baseCatalog = useMemo(
        () => [...coursesData, ...landingCoursesData.filter(lc => !coursesData.some(c => c.id === lc.id))],
        [],
    );
    const [catalogCourses, setCatalogCourses] = useState<Course[]>(baseCatalog);
    const [filteredCourses, setFilteredCourses] = useState<Course[]>(baseCatalog);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authAction, setAuthAction] = useState<'enroll' | 'cart' | 'continue'>('enroll');
    const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AuthenticatedUser | null>(null);
    const [session, setSession] = useState<StoredSession | null>(null);
    const [authForm, setAuthForm] = useState({ email: '', password: '', name: '', phone: '' }); // Unused but kept for original component structure
    const handleNavClick = useCallback(
        (href: string) => {
            setLocation(href);
        },
        [setLocation],
    );

    // References for the horizontal scroller
    const railRef = useRef<HTMLDivElement>(null);

    // --- LOGIC FUNCTIONS (Unchanged) ---
    const enrichCartItems = useCallback((items: CartItem[]): CartItem[] => {
        return items.map((item) => {
            const fallback = catalogCourses.find((course) => course.id === item.courseId);
            if (!fallback) {
                return item;
            }
            return {
                description: fallback.description,
                instructor: fallback.instructor,
                duration: fallback.duration,
                rating: fallback.rating,
                students: fallback.students,
                level: fallback.level,
                thumbnail: fallback.thumbnail,
                ...item,
            };
        });
    }, [catalogCourses]);

    const handleUnauthorized = useCallback(() => {
        localStorage.removeItem("session");
        localStorage.removeItem("user");
        localStorage.setItem("isAuthenticated", "false");
        setIsAuthenticated(false);
        setUser(null);
        setSession(null);
        setCart([]);
        toast({
            variant: "destructive",
            title: "Session expired",
            description: "Please sign in again to continue.",
        });
    }, [toast]);

    const applyCartResponse = useCallback(
        async (response: Response): Promise<boolean> => {
            if (response.status === 401) {
                handleUnauthorized();
                return false;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Cart request failed: ${response.status}`);
            }

            const data = (await response.json()) as CartResponse;
            setCart(enrichCartItems(data.items ?? []));
            return true;
        },
        [enrichCartItems, handleUnauthorized],
    );

    const fetchCart = useCallback(async () => {
        if (!isAuthenticated || !session?.accessToken) {
            setCart([]);
            return;
        }

        try {
            // ✅ UPDATED: Use cartActions instead of direct fetch
            const items = await fetchCartAction(session);
            setCart(enrichCartItems(items));
        } catch (error) {
            console.error("Failed to fetch cart", error);
            if ((error as any).status === 401) {
                handleUnauthorized();
            }
        }
    }, [enrichCartItems, handleUnauthorized, isAuthenticated, session]);

    // Check authentication state on mount
    useEffect(() => {
        const authStatus = localStorage.getItem('isAuthenticated');
        const userData = localStorage.getItem('user');
        const sessionData = localStorage.getItem('session');

        if (authStatus === 'true' && userData) {
            try {
                const parsedUser = JSON.parse(userData) as Partial<AuthenticatedUser & { name?: string }>;
                if (parsedUser) {
                    setIsAuthenticated(true);
                    setUser({
                        id: parsedUser.id ?? "",
                        fullName: parsedUser.fullName ?? parsedUser.name ?? "",
                        email: parsedUser.email ?? "",
                        picture: parsedUser.picture,
                        emailVerified: parsedUser.emailVerified,
                    });
                }
            } catch (error) {
                console.error("Failed to parse stored user", error);
            }
        }

        if (sessionData) {
            try {
                setSession(JSON.parse(sessionData) as StoredSession);
            } catch (error) {
                console.error("Failed to parse stored session", error);
            }
        }
    }, []);

    useEffect(() => {
        fetchCart();
    }, [fetchCart]);

    useEffect(() => {
        const controller = new AbortController();
        async function fetchCatalogCourses() {
            try {
                // ✅ UPDATED: Use courseActions instead of direct fetch
                const courses = await fetchCourses(controller.signal);
                const normalized = courses.map(mapCourseSummaryToCourse);
                if (normalized.length > 0) {
                    setCatalogCourses((prev) => mergeCourseCollections(prev, normalized));
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') {
                    return;
                }
                console.error("Failed to load course catalogue", error);
            }
        }

        void fetchCatalogCourses();
        return () => controller.abort();
    }, []);

    // Filter courses based on search query
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredCourses(catalogCourses);
        } else {
            const filtered = catalogCourses.filter(course =>
                course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                course.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredCourses(filtered);
        }
    }, [searchQuery, catalogCourses]); // Depend on catalogCourses now

    const addToCart = async (course: Course) => {
        if (!isAuthenticated) {
            setPendingCourse(course);
            setAuthAction('cart');
            setShowAuthModal(true);
            return;
        }
        // ... (rest of addToCart logic remains the same)
        if (!session?.accessToken) {
            handleUnauthorized();
            return;
        }

        const isAlreadyInCart = cart.some(item => item.courseId === course.id);
        if (isAlreadyInCart) {
            toast({
                title: "Already in Cart",
                description: `${course.title} is already in your cart.`,
            });
            return;
        }

        try {
            // ✅ UPDATED: Use cartActions instead of direct fetch
            const items = await addToCartAction(
                {
                    id: course.id,
                    title: course.title,
                    price: course.price,
                    description: course.description,
                    instructor: course.instructor,
                    duration: course.duration,
                    rating: course.rating,
                    students: course.students,
                    level: course.level,
                    thumbnail: course.thumbnail,
                },
                session
            );
            setCart(enrichCartItems(items));

            toast({
                title: "Added to Cart",
                description: `${course.title} has been added to your cart.`,
            });
        } catch (error) {
            console.error("Failed to add course to cart", error);
            if ((error as any).status === 401) {
                handleUnauthorized();
                return;
            }
            toast({
                variant: "destructive",
                title: "Could not add to cart",
                description: "Please try again in a moment.",
            });
        }
    };

    // ... (removeFromCart and clearCart logic remains the same) ...

    const enrollNow = (course: Course) => {
        if (!isAuthenticated) {
            setPendingCourse(course);
            setAuthAction('enroll');
            setShowAuthModal(true);
            return;
        }

        setLocation(getEnrollPath(course));
    };

    const continueLearning = (course: Course) => {
        if (!isAuthenticated) {
            setPendingCourse(course);
            setAuthAction('continue');
            setShowAuthModal(true);
            return;
        }

        // Navigate to the course learning page with a default first lesson
        setLocation(getContinuePath(course));
    };

    // Kept for backward compatibility, though not used in new design
    const getLevelColor = (level: string) => {
        switch (level) {
            case 'Beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'Intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'Advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const startGoogleSignIn = (redirectPath?: string) => {
        setShowAuthModal(false);
        const safeRedirect =
            redirectPath && redirectPath.startsWith("/")
                ? redirectPath
                : window.location.pathname + window.location.search;

        sessionStorage.setItem("postLoginRedirect", safeRedirect);
        const target = `${buildApiUrl("/auth/google")}?redirect=${encodeURIComponent(safeRedirect)}`;
        window.location.assign(target);
    };

    const handleLogout = async () => {
        if (session) {
            try {
                // ✅ UPDATED: Use authActions instead of direct fetch
                await logoutAction(session);
            } catch (error) {
                console.error("Failed to revoke session", error);
            }
        }

        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('session');
        localStorage.removeItem('course-cart');
        setUser(null);
        setSession(null);
        setIsAuthenticated(false);
        setCart([]);

        toast({
            title: "Signed Out",
            description: "You have been successfully logged out",
        });
    };

    // --- NEW LOGIC FOR SCROLLER AND VIDEO MODAL ---
    const scrollRail = (direction: number) => {
        if (railRef.current) {
            // Scrolls by approximately 2.5 cards (250px min-width + 16px gap)
            railRef.current.scrollBy({ left: direction * 280, behavior: 'smooth' });
        }
    };

    const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
    const [videoSrc, setVideoSrc] = useState('');
    const HERO_VIDEO_URL = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0';

    const handleVideoModal = (open: boolean) => {
        if (open) {
            setVideoSrc(HERO_VIDEO_URL);
            setIsVideoDialogOpen(true);
        } else {
            setIsVideoDialogOpen(false);
            setVideoSrc('');
        }
    };
    // --- END NEW LOGIC ---

    const totalCartValue = cart.reduce((sum, item) => sum + item.price, 0);
    // Only courses in the base catalog are considered 'enrolled'
    const enrolledCourses = catalogCourses.filter(course => course.isEnrolled);
    const displayName = user?.fullName?.trim() || 'Learner';
    const firstName = displayName.split(' ').filter(Boolean)[0] ?? '';
    const userInitials = getUserInitials(displayName);

    // Filtered courses for the main "Explore Courses" section
    const exploreCourses = filteredCourses.filter(course => !course.isEnrolled);
    const heroCourse = catalogCourses[0];


    return (
        <SiteLayout
            headerProps={{
                cartCount: cart.length,
                currentPath: location,
                onNavigate: handleNavClick,
                showSearch: true,
                searchQuery,
                onSearchChange: setSearchQuery,
                isAuthenticated,
                user: user
                    ? {
                        name: displayName,
                        email: user.email,
                        avatarUrl: user.picture,
                        initials: userInitials,
                    }
                    : undefined,
                onLogout: handleLogout,
                onLoginClick: () => setShowAuthModal(true),
            }}
            mainProps={{ 'data-testid': 'page-dashboard' }}
        >
            {/* --- HERO SECTION --- */}
            <section className="grid lg:grid-cols-[1.2fr_1fr] gap-7 items-center pt-8 px-2 sm:px-4 lg:px-2 relative">
                {/* Left Content */}
                <div>
                    <div className="text-red-600 font-bold mb-2">Learn anywhere</div>
                    <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-[-0.02em]">
                        Your Next <br className="hidden sm:inline" />Online School
                    </h1>
                    <p className="text-gray-500 max-w-lg mt-3 mb-5">
                        Build your portfolio by earning certifications when you complete courses.
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Enroll Button (Functional) */}
                        <Button
                            className="bg-[#0ea5a7] text-white font-bold px-5 py-3 h-auto rounded-full shadow-lg shadow-[#0ea5a7]/30 hover:shadow-xl hover:translate-y-[-1px] transition-all"
                            onClick={() => heroCourse && enrollNow(heroCourse)} // Links to a default course for demo
                        >
                            Enroll
                            <ChevronRight className="w-5 h-5 ml-2" />
                        </Button>
                        {/* Play Video Link (Functional) */}
                        <a
                            className="flex items-center gap-2 text-gray-900 font-semibold cursor-pointer"
                            onClick={(e) => { e.preventDefault(); handleVideoModal(true); }}
                        >
                            <span className="w-10 h-10 rounded-full bg-red-500 grid place-items-center text-white shadow-lg shadow-red-500/30">
                                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                            </span>
                            Play Video
                        </a>
                    </div>
                </div>

                {/* Right Visual */}
                <div className="relative min-h-[360px] rounded-2xl overflow-visible hidden sm:block">
                    <div className="absolute inset-0 filter blur-xl opacity-20" style={{ background: 'conic-gradient(from 220deg, #0ea5a7 0 30%, #2563eb 30% 55%, #ef4444 55% 75%, #10b981 75% 100%)' }}></div>
                    <div
                        className="relative h-full min-h-[360px] rounded-2xl bg-center bg-cover bg-no-repeat shadow-2xl"
                        style={{
                            backgroundImage: "url('https://images.unsplash.com/photo-1573497491208-6b1acb260507?q=80&w=1200&auto=format&fit=crop')",
                            clipPath: 'polygon(10% 0, 90% 0, 70% 100%, 0% 100%)',
                        }}
                    ></div>

                    {/* Icon Badges (Tailwind converted & positioned) */}
                    <HeroIconBadge className="left-[14%] top-[52%]" dataTip="Google 101" label="Google 101">
                        <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 31.9 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.2-2.8-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.9 16 19.1 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5 29.5 3 24 3 15.4 3 8.1 8.1 6.3 14.7z" /><path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.4l-6.3-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C8 39.5 15.4 45 24 45z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3C34.8 31.5 29.8 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C8 39.5 15.4 45 24 45c10.5 0 20-7.6 20-21 0-1.4-.2-2.8-.4-3.5z" /></svg>
                    </HeroIconBadge>
                    <HeroIconBadge className="right-[7%] top-[18%]" dataTip="Sheets" label="Google Sheets">
                        <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#0F9D58" d="M8 8h22l10 10v22a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" /><path fill="#fff" d="M30 8v10h10" /><rect x="14" y="22" width="20" height="2" fill="#fff" /><rect x="14" y="27" width="20" height="2" fill="#fff" /><rect x="14" y="32" width="20" height="2" fill="#fff" /></svg>
                    </HeroIconBadge>
                    <HeroIconBadge className="right-[12%] bottom-[8%]" dataTip="Drive" label="Google Drive">
                        <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#0F9D58" d="M17 8h14l11 19-7 13H13L6 27 17 8z" /><path fill="#FFCD40" d="M17 8l7 12-11 7L6 27 17 8z" /><path fill="#4285F4" d="M31 8l-7 12 11 7 7-12L31 8z" /></svg>
                    </HeroIconBadge>
                    <HeroIconBadge className="left-[36%] bottom-[-12px]" dataTip="AI Assistant" label="AI Assistant">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#0ea5a7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v5M12 17v5M4.2 4.2l3.5 3.5M16.3 16.3l3.5 3.5M2 12h5M17 12h5M4.2 19.8l3.5-3.5M16.3 7.7l3.5-3.5" /></svg>
                    </HeroIconBadge>

                    {/* Ribbon Outline */}
                    <svg className="absolute right-[6%] top-[58%] opacity-25 rotate-6" width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="#0f172a" strokeOpacity=".4" strokeWidth="2">
                        <path d="M60 20a22 22 0 1 1 0 44 22 22 0 0 1 0-44Z" /><path d="M58 70 45 108l16-10 16 10-13-38" />
                    </svg>
                </div>
            </section>

            {/* --- 3. TRENDING COURSES (Mapped to the Explore Courses data, using new card style) --- */}
            <h2 className={`text-3xl sm:text-4xl ${FONT_PLAYFAIR} text-center mt-16 mb-6 font-bold`}>
                Trending Courses <span role="img" aria-label="fire">🔥</span>
            </h2>
            <section className="relative p-2 sm:p-4 lg:px-11">
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 hidden sm:grid"
                    onClick={() => scrollRail(-1)}
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>

                <div ref={railRef} className="flex gap-4 overflow-x-scroll scroll-smooth snap-x snap-mandatory pb-2 custom-scrollbar">
                    {/* NOTE: We use the `exploreCourses` data to populate this trending rail */}
                    {exploreCourses.map((course) => (
                        <article
                            key={course.id}
                            className="flex-shrink-0 w-[250px] sm:w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer snap-start overflow-hidden"
                            onClick={() => setSelectedCourse(course)}
                        >
                            {/* Image Placeholder */}
                            <div className="w-full h-36 bg-gray-200 overflow-hidden">
                                <img
                                    src={course.thumbnail} // Using the provided thumbnail link
                                    alt={course.title}
                                    className="w-full h-full object-cover"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                        e.currentTarget.src = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=900&auto=format&fit=crop';
                                    }}
                                />
                            </div>
                            <div className="p-4">
                                <h3 className="text-lg font-bold mb-1">{course.title}</h3>
                                <div className="text-yellow-500 text-sm flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                    <span className="font-semibold">{course.rating}</span>
                                    <span className="text-gray-500 font-normal"> • {course.students} students</span>
                                </div>
                                <p className="text-gray-500 text-sm mt-2 line-clamp-2">{course.description}</p>
                                <Button
                                    className="w-full mt-4 bg-[#0ea5a7] hover:bg-[#0c9092] text-white font-semibold shadow-md"
                                    onClick={(e) => { e.stopPropagation(); enrollNow(course); }}
                                >
                                    Enroll Now
                                </Button>
                            </div>
                        </article>
                    ))}
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 hidden sm:grid"
                    onClick={() => scrollRail(1)}
                    aria-label="Scroll right"
                >
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </section>


            {/* --- 5. VIDEO MODAL (Converted from HTML/JS to a React/TS Dialog) --- */}
            <Dialog open={isVideoDialogOpen} onOpenChange={handleVideoModal}>
                <DialogContent className="sm:max-w-4xl w-full max-w-[92vw] border-0 bg-transparent p-0 shadow-none">
                    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-black/40">
                        <iframe
                            id="yt"
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            src={videoSrc}
                            className="h-full w-full"
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- 6. AUTHENTICATION MODAL (Existing logic, styled to match) --- */}
            <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
                <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-center font-extrabold text-gray-900">Welcome to Ottolearn</DialogTitle>
                        <p className="text-center text-gray-500">Continue with your Google account</p>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                        <Button
                            variant="outline"
                            className="w-full px-6 py-4 flex items-center justify-center gap-3 border-gray-300 shadow-sm hover:shadow-md transition text-base font-semibold"
                            onClick={() => {
                                const redirectTarget =
                                    authAction === 'cart'
                                        ? '/cart'
                                        : pendingCourse
                                            ? authAction === 'continue'
                                                ? getContinuePath(pendingCourse)
                                                : getEnrollPath(pendingCourse)
                                            : undefined;
                                startGoogleSignIn(redirectTarget);
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.84-6.84C35.9 2.7 30.47 0 24 0 14.62 0 6.4 5.38 2.54 13.19l7.96 6.19C12.46 13.14 17.74 9.5 24 9.5z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.07-.41-4.55H24v9.02h13.03c-.56 2.88-2.23 5.33-4.74 6.98l7.68 5.96C43.96 38.27 46.98 31.96 46.98 24.55z" />
                                <path fill="#FBBC05" d="M10.5 28.94a14.47 14.47 0 0 1 0-9.88L2.54 13.19A23.86 23.86 0 0 0 0 24c0 3.88.93 7.54 2.54 10.81l7.96-5.87z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.89-5.81l-7.68-5.96c-2.14 1.44-4.9 2.3-8.21 2.3-6.26 0-11.54-3.64-13.5-8.87l-7.96 6.19C6.14 42.62 14.38 48 24 48z" />
                                <path fill="none" d="M0 0h48v48H0z" />
                            </svg>
                            <span className="font-semibold text-base">Sign in with Google</span>
                        </Button>
                        <p className="text-center text-sm text-gray-500">
                            We'll create an account if you're new.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </SiteLayout>
    );
}
