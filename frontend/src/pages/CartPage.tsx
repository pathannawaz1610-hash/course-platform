import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { CartItem, CartResponse } from '@/types/cart';
import type { StoredSession } from '@/types/session';
import { fetchCart as fetchCartAction, removeFromCart as removeFromCartAction, clearCart as clearCartAction } from '@/lib/binding/actions/cartActions';
import { ShoppingCart, Trash2, Star, Clock, Users, CreditCard, Home, PartyPopper, CheckCircle2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle'; // Import ThemeToggle
import { SiteLayout } from '@/components/layout/SiteLayout';

const COURSE_PLAYER_PATH = '/course/ai-native-fullstack-developer/learn/welcome-to-ai-journey';

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => INR_FORMATTER.format(Math.max(0, Math.round(value)));

export default function CartPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState(true);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("session");
    localStorage.removeItem("user");
    localStorage.setItem("isAuthenticated", "false");
    setIsAuthenticated(false);
    setSession(null);
    setCart([]);
    setIsLoadingCart(false);
    toast({
      variant: "destructive",
      title: "Session expired",
      description: "Please sign in again to view your cart.",
    });
  }, [toast]);

  const updateCartFromResponse = useCallback(
    async (response: Response): Promise<boolean> => {
      if (response.status === 401) {
        handleUnauthorized();
        return false;
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Cart request failed: ${response.status}`);
      }

      const data = (await response.json()) as CartResponse;
      setCart(data.items ?? []);
      return true;
    },
    [handleUnauthorized],
  );

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated || !session?.accessToken) {
      setCart([]);
      setIsLoadingCart(false);
      return;
    }

    setIsLoadingCart(true);
    try {
      // ✅ UPDATED: Use cartActions instead of direct fetch
      const items = await fetchCartAction(session);
      setCart(items);
    } catch (error) {
      console.error("Failed to load cart", error);
      if ((error as any).status === 401) {
        handleUnauthorized();
      }
    } finally {
      setIsLoadingCart(false);
    }
  }, [handleUnauthorized, isAuthenticated, session]);

  useEffect(() => {
    const syncAuthState = () => {
      const authStatus = localStorage.getItem('isAuthenticated');
      const sessionData = localStorage.getItem('session');

      if (authStatus === 'true' && sessionData) {
        try {
          const parsedSession = JSON.parse(sessionData) as StoredSession;
          setSession(parsedSession);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Failed to parse stored session", error);
          setSession(null);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
        setSession(null);
        setCart([]);
        setIsLoadingCart(false);
      }
    };

    syncAuthState();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'isAuthenticated' || event.key === 'session' || event.key === 'user') {
        syncAuthState();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const totalCartValue = cart.reduce((sum, item) => sum + item.price, 0);
  const totalSavings = cart.reduce((sum, item) => sum + (item.price * 0.2), 0);

  const getLevelColor = (level: string = 'Beginner') => {
    switch (level) {
      case 'Beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const removeFromCart = useCallback(
    async (courseId: string, options?: { silent?: boolean }) => {
      if (!isAuthenticated || !session?.accessToken) {
        setCart(prevCart => prevCart.filter(item => item.courseId !== courseId));
        if (!options?.silent) {
          toast({
            title: "Removed from Cart",
            description: "Course has been removed from your cart.",
          });
        }
        return;
      }

      try {
        // ✅ UPDATED: Use cartActions instead of direct fetch
        const items = await removeFromCartAction(courseId, session);
        setCart(items);

        if (!options?.silent) {
          toast({
            title: "Removed from Cart",
            description: "Course has been removed from your cart.",
          });
        }
      } catch (error) {
        console.error("Failed to remove course from cart", error);
        if ((error as any).status === 401) {
          handleUnauthorized();
        }
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Could not update cart",
            description: "Please try again.",
          });
        }
      }
    },
    [handleUnauthorized, isAuthenticated, session, toast],
  );

  const clearCart = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAuthenticated || !session?.accessToken) {
        setCart([]);
        if (!silent) {
          toast({
            title: "Cart Cleared",
            description: "All courses have been removed from your cart.",
          });
        }
        return;
      }

      try {
        // ✅ UPDATED: Use cartActions instead of direct fetch
        await clearCartAction(session);
        setCart([]);
        if (!silent) {
          toast({
            title: "Cart Cleared",
            description: "All courses have been removed from your cart.",
          });
        }
      } catch (error) {
        console.error("Failed to clear cart", error);
        if ((error as any).status === 401) {
          handleUnauthorized();
        }
        if (!silent) {
          toast({
            variant: "destructive",
            title: "Could not clear cart",
            description: "Please try again.",
          });
        }
        if (silent) {
          throw error instanceof Error ? error : new Error("Failed to clear cart");
        }
      }
    },
    [handleUnauthorized, isAuthenticated, session, toast],
  );

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;

    setIsProcessingCheckout(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      await clearCart({ silent: true });

      toast({
        title: "Checkout Successful!",
        description: `You've enrolled in ${cart.length} course${cart.length > 1 ? 's' : ''}. Check your dashboard to start learning.`,
      });

      setLocation(COURSE_PLAYER_PATH);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Checkout Failed",
        description: "Please try again or contact support.",
      });
    } finally {
      setIsProcessingCheckout(false);
    }
  }, [cart.length, clearCart, setLocation, toast]);

  const handleEnrollSingle = async (courseId: string) => {
    await removeFromCart(courseId, { silent: true });
    toast({
      title: "Enrolled Successfully!",
      description: "Course has been added to your learning dashboard.",
    });
    setLocation(`/course/${courseId}/learn/welcome-to-ai-journey`);
  };

  return (
    <SiteLayout
      headerProps={{
        cartCount: cart.length,
        currentPath: location,
        onNavigate: (href) => setLocation(href),
        showSearch: false,
        isAuthenticated,
        onLoginClick: () => setLocation(COURSE_PLAYER_PATH),
      }}
      contentClassName="space-y-8"
    >
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/70 p-4 transition-all duration-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600">Cart overview</p>
          <h1 className="text-3xl font-bold text-slate-900">Shopping Cart</h1>
          <p className="text-sm text-slate-500">Review your curated courses and continue checkout whenever you’re ready.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setLocation(COURSE_PLAYER_PATH)}
            className="hidden sm:inline-flex border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-sm transition-all duration-500 sm:p-6">
        {isLoadingCart ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" />
              </div>
              <p className="text-sm text-slate-500">Loading your cart...</p>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center text-center">
            <div className="space-y-4">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-100">
                <ShoppingCart className="h-10 w-10 text-slate-400" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Your cart is empty</h2>
              <p className="text-sm text-slate-500">
                Explore new tracks and add them to your cart to build a personalised learning plan.
              </p>
              <Button
                onClick={() => setLocation(COURSE_PLAYER_PATH)}
                className="mt-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
              >
                Continue learning
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Cart Items - Takes 2 columns on large screens */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">
                  {cart.length} {cart.length === 1 ? 'Course' : 'Courses'} in Cart
                </h2>
                {cart.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void clearCart()}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="space-y-4">
                {cart.map((item) => (
                  <Card key={item.courseId} className="hover:shadow-lg transition-shadow bg-card">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Course Thumbnail */}
                        <div className="flex-shrink-0">
                          <div className="w-full sm:w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-3xl sm:text-2xl text-white">
                            {item.thumbnail || 'AI'}
                          </div>
                        </div>

                        {/* Course Details */}
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base sm:text-lg leading-tight mb-1 text-foreground">
                                {item.title}
                              </h3>
                              {item.instructor && (
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  by {item.instructor}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                              {item.level && (
                                <Badge className={`${getLevelColor(item.level)} text-xs whitespace-nowrap`}>
                                  {item.level}
                                </Badge>
                              )}
                              <span className="text-lg sm:text-xl font-bold whitespace-nowrap text-foreground">
                                {formatCurrency(item.price)}
                              </span>
                            </div>
                          </div>

                          {item.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {/* Course Stats */}
                          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                            {item.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400" />
                                <span>{item.rating}</span>
                              </div>
                            )}
                            {item.students && (
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">{item.students.toLocaleString()}</span>
                                <span className="sm:hidden">{(item.students / 1000).toFixed(1)}k</span>
                              </div>
                            )}
                            {item.duration && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{item.duration}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col xs:flex-row gap-2 pt-2 border-t border-border">
                            <Button
                              size="sm"
                              onClick={() => handleEnrollSingle(item.courseId)}
                              className="bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm"
                            >
                              Enroll Now
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void removeFromCart(item.courseId)}
                              className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs sm:text-sm"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Order Summary - Sticky on large screens */}
            <div className="lg:col-span-1">
              <Card className="lg:sticky lg:top-24 bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg sm:text-xl text-foreground">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm sm:text-base">
                      <span className="text-muted-foreground">Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                      <span className="font-medium text-foreground">{formatCurrency(totalCartValue)}</span>
                    </div>
                    {cart.length > 1 && (
                      <div className="flex justify-between text-sm sm:text-base text-green-600 dark:text-green-400">
                        <span>Bundle Discount (20%)</span>
                        <span>-{formatCurrency(totalSavings)}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between font-semibold text-lg sm:text-xl">
                        <span className="text-foreground">Total</span>
                        <span className="bg-gradient-to-r from-[hsl(var(--gradient-text-from))] to-[hsl(var(--gradient-text-to))] bg-clip-text text-transparent">
                          {formatCurrency(cart.length > 1 ? totalCartValue - totalSavings : totalCartValue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {cart.length > 1 && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400">
                      <PartyPopper className="h-4 w-4" />
                      <span>You're saving {formatCurrency(totalSavings)} with the bundle discount!</span>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <Button
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-sm sm:text-base py-5 sm:py-6"
                      onClick={handleCheckout}
                      disabled={isProcessingCheckout}
                    >
                      {isProcessingCheckout ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </span>
                      ) : (
                        `Checkout - ${formatCurrency(cart.length > 1 ? totalCartValue - totalSavings : totalCartValue)}`
                      )}
                    </Button>

                    <div className="text-xs text-center text-muted-foreground">
                      30-day money-back guarantee
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 pt-4 border-t border-border">
                    <h4 className="font-semibold text-sm text-foreground">What's included:</h4>
                    <ul className="text-xs sm:text-sm text-muted-foreground space-y-2">
                      {[
                        'Lifetime access to every lesson and update',
                        'Shareable certificate of completion',
                        'Optimised for mobile and desktop',
                        '24/7 mentor-supported chat',
                      ].map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
