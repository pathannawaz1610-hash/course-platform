import { useState, useEffect, useRef } from 'react'
import { fetchRegistrationAssessmentQuestions, submitRegistration } from '@/lib/binding/actions/registrationActions'
import { AssessmentStepProps, Question, Answer, FormErrors } from '@/types/registration'

const AssessmentStep = ({ onSubmit, studentData }: AssessmentStepProps) => {
    const [questions, setQuestions] = useState<any[]>([])
    const [answers, setAnswers] = useState<Answer>({})
    const [errors, setErrors] = useState<FormErrors>({})
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState<boolean>(true)

    // Timer: Ref to store start time (initialized on mount)
    const startTimeRef = useRef<number>(Date.now())

    // Fetch questions from API on component mount
    useEffect(() => {
        startTimeRef.current = Date.now()

        const fetchQuestions = async (): Promise<void> => {
            try {
                if (!studentData?.offeringId) {
                    setErrors({ fetch: "Missing offering selection. Please go back and select a course." })
                    setIsLoading(false)
                    return
                }

                const programType = studentData.programType || 'cohort'
                const { questions: data } = await fetchRegistrationAssessmentQuestions({
                    offeringId: studentData.offeringId,
                    programType,
                })

                if (!data || data.length === 0) {
                    setQuestions([])
                    setErrors({ fetch: "No assessment questions found for this program." })
                    setIsLoading(false)
                    return
                }

                const mcqs = data.filter((q: any) => q.questionType === 'mcq')
                const texts = data.filter((q: any) => q.questionType === 'text')

                const interleaved: Question[] = []
                let mcqIdx = 0
                let textIdx = 0

                while (mcqIdx < mcqs.length || textIdx < texts.length) {
                    for (let i = 0; i < 3 && mcqIdx < mcqs.length; i++) {
                        interleaved.push(mcqs[mcqIdx++])
                    }
                    for (let i = 0; i < 2 && textIdx < texts.length; i++) {
                        interleaved.push(texts[textIdx++])
                    }
                }

                setQuestions(interleaved)
                const initialAnswers: Answer = interleaved.reduce((acc, q: any) => ({ ...acc, [q.questionId]: '' }), {})
                setAnswers(initialAnswers)
            } catch (error) {
                console.error('Error fetching questions:', error)
                setErrors({ fetch: `Failed to load questions: ${(error as Error).message}` })
            } finally {
                setIsLoading(false)
            }
        }

        fetchQuestions()
    }, [studentData])

    const handleAnswerChange = (questionId: string, value: string): void => {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
        if (errors[questionId]) {
            setErrors(prev => ({ ...prev, [questionId]: '' }))
        }
    }

    const validateAnswers = (): boolean => {
        const newErrors: FormErrors = {}
        questions.forEach((q: any) => {
            const answer = answers[q.questionId]?.trim()
            if (!answer) {
                newErrors[q.questionId] = 'This question requires an answer'
            } else if (q.questionType === 'text' && answer.length < 50) {
                newErrors[q.questionId] = 'Please provide a more detailed answer (minimum 50 characters)'
            }
        })
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault()

        if (!validateAnswers()) {
            const firstErrorId = Object.keys(errors)[0]
            const element = document.getElementById(`ans_${firstErrorId}`)
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }

        if (!studentData?.offeringId) {
            setErrors({ submit: 'System Error: Offering selection missing.' })
            return
        }

        setIsSubmitting(true)

        try {
            const now = Date.now()
            const start = startTimeRef.current
            let durationSeconds = Math.floor((now - start) / 1000)
            if (isNaN(durationSeconds) || durationSeconds < 0) durationSeconds = 0

            const payload = {
                offeringId: studentData.offeringId,
                fullName: studentData.fullName,
                email: studentData.email,
                phoneNumber: studentData.phoneNumber,
                collegeName: studentData.collegeName,
                yearOfPassing: studentData.yearOfPassing,
                branch: studentData.branch,
                selectedSlot: studentData.selectedSlot || null,
                sessionTime: studentData.sessionTime || null,
                mode: studentData.mode || null,
                referredBy: studentData.referredBy || null,
                status: "assessed",
                answersJson: answers,
                questionsSnapshot: questions,
                assessmentSubmittedAt: new Date().toISOString(),
                durationSeconds,
            }

            await submitRegistration(payload)
            onSubmit(answers)
        } catch (error) {
            console.error('Submission error:', error)
            setErrors({ submit: `Error: ${(error as Error).message}` })
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } finally {
            setIsSubmitting(false)
        }
    }

    const getAnsweredCount = (): number => Object.values(answers).filter(a => a.trim().length > 0).length

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Entrance Assessment</h2>

                    <div className="space-y-4 text-gray-700">
                        <p>
                            Welcome, <span className="text-orange-600 font-bold">{studentData?.fullName || 'Student'}</span>! Please answer the following questions thoughtfully. Your responses will be manually reviewed by our team.
                        </p>

                        <p>Write 5-10 sentences for each answer if possible.</p>

                        <p>We care more about "how you think" than what you know.</p>

                        <div>
                            <p className="mb-2">Try to answer according to "STAR" method:</p>
                            <ul className="list-disc pl-5 space-y-1 text-gray-600">
                                <li><strong>S: Situation</strong> (Specific situation you were in)</li>
                                <li><strong>T: Task</strong> (What is your task in that situation)</li>
                                <li><strong>A: Action</strong> (what action/approach you did)</li>
                                <li><strong>R: Result</strong> (Output whether it is success or failure, what you learnt)</li>
                            </ul>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-8 bg-orange-50 rounded-xl p-4 border border-orange-100">
                        <div className="flex justify-between text-sm font-semibold text-orange-800 mb-2">
                            <span>Progress: {getAnsweredCount()} of {questions.length} questions answered</span>
                            <span>{Math.round((getAnsweredCount() / (questions.length || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-orange-200 rounded-full h-2.5">
                            <div
                                className="bg-orange-400 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                                style={{ width: `${(getAnsweredCount() / (questions.length || 1)) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Warning Note */}
                    <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">
                                    <strong className="font-medium">Important:</strong> Do not refresh the page as your responses may be lost. Please maintain a stable network connection throughout the exam.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {errors.fetch && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-8">
                        <p className="text-red-700 mb-4">{errors.fetch}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {questions.map((question: any, index) => (
                        <div key={question.questionId} id={`ans_${question.questionId}`} className="p-6 rounded-xl border border-gray-100 bg-gray-50/50">
                            <div className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                    {index + 1}
                                </span>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{question.questionText}</h3>
                                    {question.questionType === 'mcq' ? (
                                        <div className="space-y-3">
                                            {question.mcqOptions?.map((option: string, idx: number) => (
                                                <label key={idx} className="flex items-center p-4 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 transition-colors cursor-pointer group">
                                                    <input
                                                        type="radio"
                                                        name={`q_${question.questionId}`}
                                                        value={option}
                                                        checked={answers[question.questionId] === option}
                                                        onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                                                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="ml-3 text-gray-700 group-hover:text-indigo-900">{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-500 mb-2">Please use the STAR method (Situation, Task, Action, Result).</p>
                                            <textarea
                                                className={`w-full p-4 rounded-lg border bg-white focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px] transition-all ${errors[question.questionId] ? 'border-red-300' : 'border-gray-200'}`}
                                                placeholder="Enter your detailed response here..."
                                                value={answers[question.questionId]}
                                                onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
                                            />
                                            <div className="flex items-center justify-between mt-2">
                                                <span className={`text-sm ml-auto ${(answers[question.questionId]?.length || 0) >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {answers[question.questionId]?.length || 0} characters
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {errors[question.questionId] && <p className="text-red-500 text-sm mt-2">{errors[question.questionId]}</p>}
                                </div>
                            </div>
                        </div>
                    ))}

                    {errors.submit && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6">
                            <p className="text-red-700 text-sm">{errors.submit}</p>
                        </div>
                    )}

                    <div className="pt-6 flex gap-4">
                        <button type="submit" className="flex-1 py-4 px-6 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center" disabled={getAnsweredCount() === 0 || isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                        </button>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
                        <p className="text-sm text-yellow-800">
                            <strong>Note:</strong> Please review your answers before submitting. Your responses will be manually evaluated by our team.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AssessmentStep
