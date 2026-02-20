import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchCourse, fetchAssessmentQuestions, submitAssessment } from '@/lib/binding/actions/courseActions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import QuizCard from '@/components/QuizCard';
import AssessmentResults from '@/components/AssessmentResults';
import ThemeToggle from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Clock, Users, Award } from 'lucide-react';
import { AssessmentQuestion, Course } from '@/types/content';

interface Question {
  id: string;
  question: string;
  options: { id: string; text: string; isCorrect?: boolean }[];
}

export default function AssessmentPage() {
  const { id: courseId } = useParams(); // This is the course ID
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [startTime] = useState(Date.now());
  const [assessmentResults, setAssessmentResults] = useState<any>(null);

  // Fetch course data by slug
  const { data: courseResponse, isLoading: courseLoading } = useQuery<{ course: Course }>({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !!courseId,
  });
  const course = courseResponse?.course;

  // Fetch assessment questions using course ID
  const { data: assessmentData, isLoading: questionsLoading } = useQuery<{ questions: AssessmentQuestion[] }>({
    queryKey: ['assessment-questions', course?.id],
    queryFn: () => fetchAssessmentQuestions(course?.id!),
    enabled: !!course?.id,
  });

  // Extract questions array from response
  const questions = assessmentData?.questions || [];

  // Submit assessment mutation
  const submitAssessmentMutation = useMutation({
    mutationFn: async (assessmentData: any) => {
      const response = await submitAssessment(course?.id!, assessmentData);
      return response;
    },
    onSuccess: (data: { result: any }) => {
      const results = data.result;
      setAssessmentResults(results);
      setShowResults(true);
      toast({
        title: "Assessment Completed",
        description: "Your results have been saved!",
      });
    },
    onError: (error: any) => {
      // Handle unauthenticated users gracefully by calculating results locally
      if (error?.status === 401 || error?.message?.includes('401')) {
        const results = calculateResults();
        setAssessmentResults(results);
        setShowResults(true);
        toast({
          title: "Assessment completed",
          description: "Results calculated locally. Please log in to save progress.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to submit assessment",
        });
      }
    },
  });

  // Transform assessment questions to the expected format
  const transformedQuestions = questions.map(q => ({
    id: q.id,
    question: q.question,
    options: Array.isArray(q.options)
      ? q.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        isCorrect: opt.isCorrect
      }))
      : []
  }));

  const handleAnswer = (selectedOptionId: string) => {
    const currentQuestion = transformedQuestions[currentQuestionIndex];

    // Compute next answers to avoid stale closure
    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: selectedOptionId
    };

    setAnswers(nextAnswers);

    if (currentQuestionIndex < transformedQuestions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 1000);
    } else {
      // Submit assessment results using the computed answers
      setTimeout(() => {
        const timeSpent = Math.round((Date.now() - startTime) / 1000); // in seconds

        // Calculate score and correct answers
        const correctAnswers = transformedQuestions.filter(question => {
          const selectedAnswer = nextAnswers[question.id];
          return question.options.find(opt => opt.id === selectedAnswer)?.isCorrect;
        }).length;

        const score = Math.round((correctAnswers / transformedQuestions.length) * 100);

        submitAssessmentMutation.mutate({
          answers: nextAnswers,
          timeSpent,
          score,
          totalQuestions: transformedQuestions.length,
          correctAnswers
        });
      }, 1000);
    }
  };

  const calculateResults = () => {
    if (!assessmentResults) {
      // Fallback calculation if no results from backend
      const correctAnswers = transformedQuestions.filter(question => {
        const selectedAnswer = answers[question.id];
        return question.options.find(opt => opt.id === selectedAnswer)?.isCorrect;
      }).length;

      const score = Math.round((correctAnswers / transformedQuestions.length) * 100);
      const timeSpent = Math.round((Date.now() - startTime) / 1000 / 60);

      return {
        score,
        correctAnswers,
        timeSpent: `${timeSpent} minutes`,
        recommendations: [
          "Continue practicing with real projects",
          "Review the concepts you found challenging",
          "Consider taking the full course for deeper understanding"
        ]
      };
    }

    return {
      score: assessmentResults.score,
      correctAnswers: assessmentResults.correctAnswers,
      timeSpent: `${Math.round(assessmentResults.timeSpent / 60)} minutes`,
      recommendations: assessmentResults.recommendations || []
    };
  };

  const handleEnroll = () => {
    setLocation(`/course/${courseId}/enroll`);
  };

  const handleRetake = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResults(false);
    setAssessmentResults(null);
  };

  // Show loading state
  if (courseLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="page-assessment-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading assessment...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (!course || transformedQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="page-assessment-error">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Assessment not available</h2>
          <p className="text-muted-foreground mb-4">This course doesn't have an assessment available.</p>
          <Button onClick={() => setLocation('/')}>Go Back Home</Button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const results = calculateResults();
    return (
      <div className="min-h-screen bg-background" data-testid="page-assessment-results">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold" data-testid="title-header">Assessment Results</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <AssessmentResults
            score={results.score}
            totalQuestions={transformedQuestions.length}
            correctAnswers={results.correctAnswers}
            timeSpent={results.timeSpent}
            recommendations={results.recommendations}
            onEnroll={handleEnroll}
            onRetake={handleRetake}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-assessment">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold" data-testid="title-header">Course Assessment</h1>
            <Badge variant="secondary" data-testid="badge-difficulty">{course?.difficulty || 'Intermediate'}</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {currentQuestionIndex === 0 && Object.keys(answers).length === 0 && (
          <div className="max-w-4xl mx-auto mb-8" data-testid="section-course-intro">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-3xl mb-4" data-testid="title-course">{course?.title}</CardTitle>
                <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-course-description">
                  {course?.description}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="flex items-center space-x-3" data-testid="stat-lessons">
                    <BookOpen className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-semibold">Course Content</p>
                      <p className="text-sm text-muted-foreground">Comprehensive curriculum</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3" data-testid="stat-duration">
                    <Clock className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-semibold">{course?.duration}</p>
                      <p className="text-sm text-muted-foreground">Self-paced learning</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3" data-testid="stat-students">
                    <Users className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-semibold">{course?.studentsCount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Active students</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-6" data-testid="section-assessment-info">
                  <div className="flex items-start space-x-3">
                    <Award className="w-6 h-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold mb-2">Pre-Course Knowledge Assessment</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This quick assessment helps us understand your current knowledge level and provide
                        personalized recommendations for your learning journey.
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• {transformedQuestions.length} multiple choice questions</li>
                        <li>• Estimated time: 5-8 minutes</li>
                        <li>• No right or wrong answers - it's about finding your starting point</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <QuizCard
            question={transformedQuestions[currentQuestionIndex].question}
            options={transformedQuestions[currentQuestionIndex].options}
            onAnswer={handleAnswer}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={transformedQuestions.length}
            showResult={!!answers[transformedQuestions[currentQuestionIndex].id]}
            selectedAnswer={answers[transformedQuestions[currentQuestionIndex].id]}
          />
        </div>
      </main>
    </div>
  );
}