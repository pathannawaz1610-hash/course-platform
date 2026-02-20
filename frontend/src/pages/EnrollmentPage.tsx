import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { login, signup } from '@/lib/binding/actions/authActions';
import { enrollInCourse, fetchCourseSections, fetchCourse } from '@/lib/binding/actions/courseActions';
import EnrollmentGateway from '@/components/EnrollmentGateway';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '@/lib/api';
import type { CourseSummary } from '@/types/content';

const COURSE_PLAYER_PATH = '/course/ai-native-fullstack-developer/learn/welcome-to-ai-journey';

export default function EnrollmentPage() {
  const { id } = useParams(); // This is the course slug
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch course data
  const { data: course, isLoading: courseLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: () => fetchCourse(id!),
    enabled: !!id,
  });

  const courseInfo = course ? { course } : undefined;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // ✅ UPDATED: Use authActions
      return await login(email, password);
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Logged in successfully!",
      });

      // Enroll the user in the course
      if (courseInfo?.course?.id) {
        try {
          // Construct session strictly from the login response
          // We cast the role to be compatible with StoredSession interface
          const session = {
            ...data.session,
            role: data.user?.role || "learner",
            userId: data.user?.id,
            email: data.user?.email,
            fullName: data.user?.fullName
          };

          // ✅ UPDATED: Use courseActions
          await enrollInCourse(courseInfo.course.id, session);

          // Find first lesson to redirect to
          const sections = await fetchCourseSections(courseInfo.course.id, session);
          if (sections?.[0]?.lessons?.[0]) {
            setLocation(`/course/${courseInfo.course.id}/learn/${sections[0].lessons[0].slug}`);
          } else {
            setLocation(`/course/${courseInfo.course.id}/learn`);
          }
        } catch (enrollError) {
          console.error('Enrollment error:', enrollError);
          setLocation(`/course/${courseInfo.course.id}/learn`);
        }
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid credentials",
      });
    },
  });

  // Signup mutation  
  const signupMutation = useMutation({
    mutationFn: async ({ email, password, name, phone }: { email: string; password: string; name: string; phone: string }) => {
      // Generate username from email for now
      const username = email.split('@')[0];
      // ✅ UPDATED: Use authActions
      return await signup({
        email,
        password,
        fullName: name,
        username,
        phone,
      });
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Account created successfully! Welcome to your learning journey!",
      });

      // Navigate to dashboard
      setTimeout(() => {
        setLocation(COURSE_PLAYER_PATH);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "Failed to create account",
      });
    },
  });

  const handleLogin = async (email: string, password: string) => {
    // Bypass authentication - allow any dummy credentials
    console.log('Login bypassed with dummy credentials:', email, password);

    toast({
      title: "Success",
      description: "Welcome to your learning dashboard!",
    });

    // Navigate to dashboard
    setTimeout(() => {
      setLocation(COURSE_PLAYER_PATH);
    }, 1000);
  };

  const handleSignup = async (email: string, password: string, name: string, phone: string) => {
    // Redirect to dashboard to use Google Sign-In
    toast({
      title: "Use Google Sign-In",
      description: "Please sign in with your Google account to continue",
    });
    setLocation(COURSE_PLAYER_PATH);
  };

  const handleSocialLogin = (provider: string) => {
    toast({
      title: "Not implemented",
      description: `${provider} login is not yet available`,
    });
  };

  // Show loading state
  if (courseLoading) {
    return (
      <div data-testid="page-enrollment" className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading course information...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !courseInfo?.course) {
    return (
      <div data-testid="page-enrollment" className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Course not found</h2>
          <p className="text-muted-foreground mb-4">The course you're looking for doesn't exist.</p>
          <button onClick={() => setLocation('/')} className="bg-primary text-primary-foreground px-4 py-2 rounded">
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  // Transform course data to match expected format
  const transformedCourseInfo = {
    title: courseInfo.course.title,
    description: courseInfo.course.description,
    instructor: courseInfo.course.instructor ?? 'Ottolearn Instructor',
    rating: courseInfo.course.rating ?? 0,
    students: courseInfo.course.studentsCount ?? 0,
    duration: courseInfo.course.durationLabel ?? 'Self-paced',
    price: courseInfo.course.price ?? 0,
    originalPrice: undefined,
  };

  return (
    <div data-testid="page-enrollment">
      <EnrollmentGateway
        courseInfo={transformedCourseInfo}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onSocialLogin={handleSocialLogin}
      />
    </div>
  );
}
