// ... (imports remain mostly same, adding useEffect)
import { useState, useEffect } from "react";

// Feature flags for future course availability
const ON_DEMAND_AVAILABLE = false; // set to true when on-demand courses are ready
const WORKSHOP_AVAILABLE = true; // set to true when workshop courses are ready
import { submitRegistration } from "@/lib/binding/actions/registrationActions";
import { supabase } from "@/lib/registrationSupabase";
import {
    RegistrationStepProps,
    RegistrationFormData,
    FormErrors,
} from "@/types/registration";

const RegistrationStep = ({ onSubmit, programType, selectedCourse, offeringId, onBack }: RegistrationStepProps) => {
    const [formData, setFormData] = useState<RegistrationFormData>({
        fullName: "",
        email: "",
        phoneNumber: "",
        collegeName: "",
        yearOfPassing: "",
        branch: "",
        selectedSlot: "",
        sessionTime: "",
        mode: "",
        specificCourse: selectedCourse || "",
        referredBy: "",
        programType: programType,
    });

    // Update formData if programType or selectedCourse prop changes
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            programType,
            specificCourse: selectedCourse || prev.specificCourse
        }));
    }, [programType, selectedCourse]);

    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);

    // Fetch slots on mount (only relevant for cohort)
    useEffect(() => {
        if (programType !== 'cohort') return;

        const fetchSlots = async () => {
            // @ts-ignore - Supabase client might be null in some environments
            if (!supabase) return;

            // @ts-ignore
            const { data, error } = await supabase
                .from("alloted_timeslotes")
                .select("slot_name")
                .order("created_at", { ascending: true });

            if (data) {
                setAvailableSlots(data.map((s: any) => s.slot_name));
            } else if (error) {
                console.error("Error fetching slots:", error);
                setAvailableSlots(["19th January", "2nd February"]);
            }
        };
        fetchSlots();
    }, [programType]);

    const validateEmail = (email: string): boolean => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const validatePhoneNumber = (phone: string): boolean => {
        const re =
            /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,5}[-\s.]?[0-9]{1,5}$/;
        return re.test(phone) && phone.replace(/\D/g, "").length >= 10;
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = "Full name is required";
        } else if (formData.fullName.trim().length < 2) {
            newErrors.fullName = "Name must be at least 2 characters";
        }

        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!validateEmail(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!formData.phoneNumber.trim()) {
            newErrors.phoneNumber = "Phone number is required";
        } else if (!validatePhoneNumber(formData.phoneNumber)) {
            newErrors.phoneNumber =
                "Please enter a valid phone number (at least 10 digits)";
        }

        if (!formData.collegeName.trim()) {
            newErrors.collegeName = "College name is required";
        }

        if (!formData.yearOfPassing) {
            newErrors.yearOfPassing = "Year of passing is required";
        }

        if (!formData.branch.trim()) {
            newErrors.branch = "Branch is required";
        }

        // Conditional Validation based on Program Type
        if (programType === 'cohort') {
            if (!formData.selectedSlot) {
                newErrors.selectedSlot = "Please select a slot";
            }

            if (!formData.sessionTime) {
                newErrors.sessionTime = "Please select a session time";
            }

            if (!formData.mode) {
                newErrors.mode = "Please select a preferred mode";
            }

            if (!formData.specificCourse) {
                newErrors.specificCourse = "Please select a course";
            }
        } else if (programType === 'ondemand' && ON_DEMAND_AVAILABLE) {
            if (!formData.specificCourse) {
                newErrors.specificCourse = "Please select a course";
            }
        } else if (programType === 'workshop' && WORKSHOP_AVAILABLE) {
            if (!formData.specificCourse) {
                newErrors.specificCourse = "Please select a course";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ): void => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const handleBlur = (
        e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
    ): void => {
        const { name } = e.target;
        setTouched((prev) => ({
            ...prev,
            [name]: true,
        }));
    };

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>,
    ): Promise<void> => {
        e.preventDefault();

        setTouched({
            fullName: true,
            email: true,
            phoneNumber: true,
            collegeName: true,
            yearOfPassing: true,
            branch: true,
            specificCourse: true, // This will be conditionally set based on programType in validateForm
            selectedSlot: programType === 'cohort',
            sessionTime: programType === 'cohort',
            mode: programType === 'cohort',
        });

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            if (!offeringId) {
                setErrors({ submit: "Please select a course offering first." });
                return;
            }

            const payload = {
                offeringId,
                fullName: formData.fullName,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                collegeName: formData.collegeName,
                yearOfPassing: formData.yearOfPassing,
                branch: formData.branch,
                selectedSlot: programType === 'cohort' ? formData.selectedSlot : null,
                sessionTime: programType === 'cohort' ? formData.sessionTime : null,
                mode: programType === 'cohort' ? formData.mode : null,
                referredBy: formData.referredBy || null,
            };

            const response = await submitRegistration(payload);
            const registrationId = response?.registration?.registrationId ?? `local-${Date.now()}`;

            onSubmit({ ...formData, id: registrationId, offeringId });
        } catch (error) {
            console.error("Error submitting registration:", error);
            setErrors({
                submit: `Error: ${(error as any).message || "Unknown error occurred"}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getProgramTitle = () => {
        switch (programType) {
            case 'ondemand': return 'On-Demand Learning Registration';
            case 'workshop': return 'Workshop Registration';
            default: return 'Cohort Registration';
        }
    };



    return (
        <div className="animate-fadeIn">
            <div className="card max-w-2xl mx-auto">
                <div className="mb-8">
                    {onBack && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onBack();
                            }}
                            className="text-gray-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium mb-4 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Change Course
                        </button>
                    )}
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        {getProgramTitle()}
                    </h2>
                    {programType === 'cohort' && (
                        <p className="text-gray-900 font-semibold mb-2">
                            Cohort is available for both online and offline
                        </p>
                    )}
                    <p className="text-gray-600">
                        Please provide your information to begin the enrollment
                        process
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Selected Course Display */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                        <label className="block text-sm font-medium text-indigo-900 mb-1">
                            Selected Course
                        </label>
                        <div className="text-lg font-bold text-indigo-700">
                            {formData.specificCourse || "No course selected"}
                        </div>
                    </div>
                    {/* Full Name */}
                    <div>
                        <label htmlFor="fullName" className="label">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="fullName"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`input-field ${touched.fullName && errors.fullName
                                ? "border-red-500"
                                : ""
                                }`}
                            placeholder="Enter your full name"
                        />
                        {touched.fullName && errors.fullName && (
                            <p className="error-text">{errors.fullName}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="label">
                            Email Address{" "}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`input-field ${touched.email && errors.email
                                ? "border-red-500"
                                : ""
                                }`}
                            placeholder="your.email@example.com"
                        />
                        {touched.email && errors.email && (
                            <p className="error-text">{errors.email}</p>
                        )}
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label htmlFor="phoneNumber" className="label">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            id="phoneNumber"
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`input-field ${touched.phoneNumber && errors.phoneNumber
                                ? "border-red-500"
                                : ""
                                }`}
                            placeholder="+1 (555) 123-4567"
                        />
                        {touched.phoneNumber && errors.phoneNumber && (
                            <p className="error-text">{errors.phoneNumber}</p>
                        )}
                    </div>

                    {/* College Name */}
                    <div>
                        <label htmlFor="collegeName" className="label">
                            College Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="collegeName"
                            name="collegeName"
                            value={formData.collegeName}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`input-field ${touched.collegeName && errors.collegeName
                                ? "border-red-500"
                                : ""
                                }`}
                            placeholder="Enter your college name"
                        />
                        {touched.collegeName && errors.collegeName && (
                            <p className="error-text">{errors.collegeName}</p>
                        )}
                    </div>

                    {/* Year of Passing */}
                    <div>
                        <label htmlFor="yearOfPassing" className="label">
                            Year of Passing{" "}
                            <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="yearOfPassing"
                            name="yearOfPassing"
                            value={formData.yearOfPassing}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`input-field ${touched.yearOfPassing && errors.yearOfPassing
                                ? "border-red-500"
                                : ""
                                }`}
                        >
                            <option value="">Select year</option>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2028">2028</option>
                        </select>
                        {touched.yearOfPassing && errors.yearOfPassing && (
                            <p className="error-text">{errors.yearOfPassing}</p>
                        )}
                    </div>

                    {/* Majors/Specialization */}
                    <div>
                        <label htmlFor="branch" className="label">
                            Majors/Specialization{" "}
                            <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="branch"
                            name="branch"
                            value={formData.branch}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`input-field ${touched.branch && errors.branch
                                ? "border-red-500"
                                : ""
                                }`}
                        >
                            <option value="">Select your major</option>
                            <option value="Computer Science Engineering (CSE)">
                                Computer Science Engineering (CSE)
                            </option>
                            <option value="Artificial Intelligence & Machine Learning (AIML)">
                                Artificial Intelligence & Machine Learning
                                (AIML)
                            </option>
                            <option value="Data Science">Data Science</option>
                            <option value="Information Technology (IT)">
                                Information Technology (IT)
                            </option>
                            <option value="Electronics and Communication Engineering (ECE)">
                                Electronics and Communication Engineering (ECE)
                            </option>
                            <option value="Electrical Engineering (EE)">
                                Electrical Engineering (EE)
                            </option>
                            <option value="Mechanical Engineering">
                                Mechanical Engineering
                            </option>
                            <option value="Civil Engineering">
                                Civil Engineering
                            </option>
                            <option value="Chemical Engineering">
                                Chemical Engineering
                            </option>
                            <option value="Biotechnology">Biotechnology</option>
                            <option value="Aerospace Engineering">
                                Aerospace Engineering
                            </option>
                            <option value="Automobile Engineering">
                                Automobile Engineering
                            </option>
                            <option value="Industrial Engineering">
                                Industrial Engineering
                            </option>
                            <option value="Robotics Engineering">
                                Robotics Engineering
                            </option>
                            <option value="Cyber Security">
                                Cyber Security
                            </option>
                            <option value="Other">Other</option>
                        </select>
                        {touched.branch && errors.branch && (
                            <p className="error-text">{errors.branch}</p>
                        )}
                    </div>



                    {/* Cohort Specific Fields */}
                    {programType === 'cohort' && (
                        <>
                            {/* Select Slot to Start Course */}
                            <div>
                                <label htmlFor="selectedSlot" className="label">
                                    Select Slot to Start Course{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="selectedSlot"
                                    name="selectedSlot"
                                    value={formData.selectedSlot}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={`input-field ${touched.selectedSlot && errors.selectedSlot
                                        ? "border-red-500"
                                        : ""
                                        }`}
                                >
                                    <option value="">Select your preferred slot</option>
                                    {availableSlots.length > 0 ? (
                                        availableSlots.map((slot) => (
                                            <option key={slot} value={slot}>
                                                {slot}
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="19th January">
                                                19th January
                                            </option>
                                            <option value="2nd February">
                                                2nd February
                                            </option>
                                        </>
                                    )}
                                </select>
                                {touched.selectedSlot && errors.selectedSlot && (
                                    <p className="error-text">{errors.selectedSlot}</p>
                                )}
                            </div>

                            {/* Session Time */}
                            <div>
                                <label htmlFor="sessionTime" className="label">
                                    Preferred Session Time <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="sessionTime"
                                    name="sessionTime"
                                    value={formData.sessionTime}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={`input-field ${touched.sessionTime && errors.sessionTime
                                        ? "border-red-500"
                                        : ""
                                        }`}
                                >
                                    <option value="">Select session time</option>
                                    <option value="Morning Session (10am-11.30am)">
                                        Morning Session (10am-11.30am)
                                    </option>
                                    <option value="Evening Session (5pm-6.30pm)">
                                        Evening Session (5pm-6.30pm)
                                    </option>
                                </select>
                                {touched.sessionTime && errors.sessionTime && (
                                    <p className="error-text">{errors.sessionTime}</p>
                                )}
                            </div>

                            {/* Mode */}
                            <div>
                                <label htmlFor="mode" className="label">
                                    Preferred Mode <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="mode"
                                    name="mode"
                                    value={formData.mode}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={`input-field ${touched.mode && errors.mode
                                        ? "border-red-500"
                                        : ""
                                        }`}
                                >
                                    <option value="">Select mode</option>
                                    <option value="Online">Online</option>
                                    <option value="Offline">Offline</option>
                                </select>
                                {touched.mode && errors.mode && (
                                    <p className="error-text">{errors.mode}</p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Referred By (Optional) */}
                    <div>
                        <label htmlFor="referredBy" className="label">
                            Referred By{" "}
                            <span className="text-gray-400 font-normal text-sm ml-1">
                                (Optional)
                            </span>
                        </label>
                        <input
                            type="text"
                            id="referredBy"
                            name="referredBy"
                            value={formData.referredBy}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className="input-field"
                            placeholder="Enter name of person who referred you"
                        />
                    </div>

                    {/* General Error Message */}
                    {errors.submit && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                            <p className="text-red-700 text-sm">
                                {errors.submit}
                            </p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            className="btn-primary w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg
                                        className="inline-block mr-2 w-5 h-5 animate-spin"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    Continue to Assessment
                                    <svg
                                        className="inline-block ml-2 w-5 h-5"
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
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegistrationStep;


