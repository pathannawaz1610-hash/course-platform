import React from "react";

export type SimulationPayload = {
  title: string;
  body: unknown;
};

type NormalizedStep = {
  title: string;
  description?: string;
  challenge?: string;
  task?: string;
};

type NormalizedSimulation = {
  scenario?: string;
  contextStory?: string;
  goal?: string;
  overview?: string;
  progressionNote?: string;
  estimatedTimeMinutes?: number;
  dependencyFromPrevious?: string | null;
  steps: NormalizedStep[];
  constraints: string[];
  deliverables: string[];
  validationChecklist: string[];
  commonFailureModes: string[];
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
};

const normalizeSimulation = (simulation: SimulationPayload): NormalizedSimulation => {
  let raw: Record<string, unknown> | null = null;

  if (typeof simulation.body === "string" && simulation.body.trim().length > 0) {
    try {
      raw = JSON.parse(simulation.body);
    } catch (e) {
      console.error("Failed to parse simulation body string", e);
    }
  } else if (typeof simulation.body === "object" && simulation.body !== null) {
    raw = simulation.body as Record<string, unknown>;
  }

  const scenario = typeof raw?.scenario === "string" ? raw.scenario : undefined;
  const contextStory = typeof raw?.context_story === "string" ? raw.context_story : undefined;
  const goal = typeof raw?.goal === "string" ? raw.goal : undefined;
  const overview = typeof raw?.overview === "string" ? raw.overview : undefined;
  const progressionNote = typeof raw?.progression_note === "string" ? raw.progression_note : undefined;
  const estimatedTimeMinutes =
    typeof raw?.estimated_time_minutes === "number" ? raw.estimated_time_minutes : undefined;
  const dependencyFromPrevious =
    typeof raw?.dependency_from_previous === "string" || raw?.dependency_from_previous === null
      ? (raw?.dependency_from_previous as string | null)
      : undefined;
  const stepsSource = Array.isArray(raw?.steps) ? raw?.steps : [];
  const steps: NormalizedStep[] = stepsSource
    .map((entry, index): NormalizedStep | null => {
      if (typeof entry === "string") {
        return { title: `Step ${index + 1}`, description: entry };
      }
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const node = entry as Record<string, unknown>;
      const title =
        typeof node.title === "string" && node.title.trim().length > 0
          ? node.title.trim()
          : `Step ${index + 1}`;
      const description = typeof node.description === "string" ? node.description : undefined;
      const challenge = typeof node.challenge === "string" ? node.challenge : undefined;
      const task = typeof node.task === "string" ? node.task : undefined;
      return { title, description, challenge, task };
    })
    .filter((step): step is NormalizedStep => step !== null);

  return {
    scenario,
    contextStory,
    goal,
    overview,
    progressionNote,
    estimatedTimeMinutes,
    dependencyFromPrevious,
    steps,
    constraints: asStringArray(raw?.constraints),
    deliverables: asStringArray(raw?.deliverables),
    validationChecklist: asStringArray(raw?.validation_checklist),
    commonFailureModes: asStringArray(raw?.common_failure_modes),
  };
};

export const SimulationExercise: React.FC<{ simulation: SimulationPayload }> = ({ simulation }) => {
  const normalized = normalizeSimulation(simulation);
  const renderListSection = (title: string, items: string[]) => {
    if (items.length === 0) return null;
    return (
      <div className="rounded-2xl border border-[#f2ebe0] bg-[#fff8f4] p-4 sm:p-5">
        <p className="text-xs uppercase tracking-[0.4em] text-[#E5583E]/80 font-semibold">{title}</p>
        <ul className="mt-3 space-y-2 text-sm text-[#4a4845]/90 list-disc list-inside">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="mt-8 rounded-[32px] border border-[#e8e1d8] bg-white shadow-lg shadow-[#000000]/5">
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[#E5583E] font-semibold mb-2">Simulation Exercise</p>
          <h3 className="text-2xl font-black text-[#1E3A47]">{simulation.title}</h3>
          <div className="mt-3 space-y-3">
            {normalized.scenario && (
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#E5583E]/80 font-semibold">Scenario</p>
                <p className="text-base sm:text-lg text-[#4a4845] leading-relaxed">{normalized.scenario}</p>
              </div>
            )}
            {normalized.contextStory && (
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#E5583E]/80 font-semibold">Context story</p>
                <p className="text-base sm:text-lg text-[#4a4845] leading-relaxed">{normalized.contextStory}</p>
              </div>
            )}
            {normalized.goal && (
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#E5583E]/80 font-semibold">Goal</p>
                <p className="text-base sm:text-lg text-[#4a4845] leading-relaxed">{normalized.goal}</p>
              </div>
            )}
            {normalized.overview && (
              <p className="text-base sm:text-lg text-[#4a4845] leading-relaxed">{normalized.overview}</p>
            )}
            {(normalized.estimatedTimeMinutes !== undefined || normalized.dependencyFromPrevious) && (
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-[#4a4845]/80">
                {normalized.estimatedTimeMinutes !== undefined && (
                  <span>Estimated time: {normalized.estimatedTimeMinutes} minutes</span>
                )}
                {normalized.dependencyFromPrevious && (
                  <span>Depends on: {normalized.dependencyFromPrevious}</span>
                )}
              </div>
            )}
            {normalized.progressionNote && (
              <div className="rounded-xl bg-[#fff8f4] border border-[#f5c4b6] p-3 text-sm text-[#782f1b]">
                <span className="font-semibold text-[#C03520]">Progression note:</span> {normalized.progressionNote}
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-4">
          {normalized.steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="rounded-2xl border border-[#f2ebe0] bg-[#fff8f4] p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-[#E5583E]/80 font-semibold">Step {index + 1}</p>
              <h4 className="text-lg font-bold text-[#1E3A47] mt-1">{step.title}</h4>
              {step.description && <p className="text-sm text-[#4a4845]/80 mt-2 leading-relaxed">{step.description}</p>}
              {step.challenge && <p className="text-sm text-[#4a4845]/80 mt-2 leading-relaxed">{step.challenge}</p>}
              {step.task && (
                <div className="mt-3 rounded-xl bg-white border border-[#f5c4b6] p-3 text-sm text-[#782f1b]">
                  <span className="font-semibold text-[#C03520]">Task:</span> {step.task}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {renderListSection("Constraints", normalized.constraints)}
          {renderListSection("Deliverables", normalized.deliverables)}
          {renderListSection("Validation checklist", normalized.validationChecklist)}
          {renderListSection("Common failure modes", normalized.commonFailureModes)}
        </div>
      </div>
    </div>
  );
};

export default SimulationExercise;
