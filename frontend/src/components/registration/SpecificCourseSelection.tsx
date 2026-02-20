import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { fetchOfferings } from '@/lib/binding/actions/registrationActions'

interface SpecificCourseSelectionProps {
    programType: 'cohort' | 'ondemand' | 'workshop'
    onSelect: (selection: { offeringId: string; title: string }) => void
    onBack: () => void
    courseSlug?: string
}

type OfferingCard = {
    id: string
    title: string
    description: string
    disabled?: boolean
}

const SpecificCourseSelection = ({ programType, onSelect, onBack, courseSlug = 'ai-native-fullstack-developer' }: SpecificCourseSelectionProps) => {
    const [, setLocation] = useLocation()
    const [selectedCourse, setSelectedCourse] = useState<string>('')
    const [offerings, setOfferings] = useState<OfferingCard[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const data = await fetchOfferings({ courseSlug })
                const filtered = (data.offerings || [])
                    .filter((o: any) => o.programType === programType && o.isActive)
                    .map((o: any) => ({
                        id: o.offeringId,
                        title: o.title,
                        description: o.description || 'Program offering',
                    }))
                setOfferings(filtered)
            } catch (error) {
                console.error('Failed to load offerings:', error)
                setOfferings([])
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [courseSlug, programType])

    const handleContinue = () => {
        const selected = offerings.find(o => o.id === selectedCourse)
        if (selected) {
            onSelect({ offeringId: selected.id, title: selected.title })
            const slug = selected.title.toLowerCase().replace(/ /g, '-')
            setLocation(`/registration/${programType}/${slug}`)
        }
    }

    return (
        <div className="animate-fadeIn">
            <div className="card max-w-2xl mx-auto">
                <div className="mb-6">
                    {/* WORKSHOP_ONLY_MODE: Back button hidden
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium mb-4 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Programs
                    </button>
                    */}

                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            Select a Course
                        </h2>
                        <p className="text-gray-600">
                            Choose the specific course you'd like to enroll in
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {loading && (
                        <div className="text-center py-6 text-gray-500">Loading offerings...</div>
                    )}
                    {!loading && offerings.map((course) => {
                        const isDisabled = course.disabled
                        return (
                            <div
                                key={course.id}
                                className={`p-5 rounded-xl border-2 transition-all ${isDisabled
                                    ? 'bg-gray-50 border-gray-200 opacity-70 cursor-not-allowed'
                                    : `cursor-pointer hover:border-indigo-400 ${selectedCourse === course.id
                                        ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                                        : 'border-gray-200 bg-white'}`
                                    }`}
                                onClick={() => !isDisabled && setSelectedCourse(course.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className={`text-lg font-bold ${isDisabled ? 'text-gray-500' : (selectedCourse === course.id ? 'text-indigo-900' : 'text-gray-900')}`}>
                                                {course.title}
                                            </h3>
                                            {isDisabled && (
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                                    Coming Soon
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-sm mt-1 ${isDisabled ? 'text-gray-400' : (selectedCourse === course.id ? 'text-indigo-700' : 'text-gray-500')}`}>
                                            {course.description}
                                        </p>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ml-4 flex items-center justify-center ${isDisabled ? 'border-gray-200' : (selectedCourse === course.id ? 'border-indigo-600' : 'border-gray-300')
                                        }`}>
                                        {selectedCourse === course.id && !isDisabled && (
                                            <div className="w-3 h-3 rounded-full bg-indigo-600" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {!loading && offerings.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No courses available for this program type yet.
                        </div>
                    )}
                </div>

                <div className="mt-8">
                    <button
                        onClick={handleContinue}
                        disabled={!selectedCourse}
                        className={`w-full py-3 px-6 rounded-xl font-bold text-lg transition-all transform ${selectedCourse
                            ? 'bg-gradient-to-r from-orange-300 to-orange-400 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        Continue to Registration
                        <svg
                            className={`inline-block ml-2 w-5 h-5 ${selectedCourse ? 'animate-pulse' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SpecificCourseSelection
