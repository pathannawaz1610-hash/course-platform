import { useState } from 'react';
import CourseSidebar from '../CourseSidebar';

export default function CourseSidebarExample() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const mockModules = [
    {
      id: "getting-started",
      title: "1. Getting Started",
      lessons: [
        { id: "intro", slug: "introduction-to-react", title: "Introduction to React", duration: "8 min", type: "video" as const, completed: true },
        { id: "setup", slug: "development-setup", title: "Development Setup", duration: "12 min", type: "video" as const, completed: true },
        { id: "quiz1", slug: "knowledge-check", title: "Knowledge Check", duration: "5 min", type: "quiz" as const, completed: true }
      ]
    },
    {
      id: "fundamentals",
      title: "2. React Fundamentals",
      lessons: [
        { id: "components", slug: "components-and-jsx", title: "Components and JSX", duration: "15 min", type: "video" as const, completed: true },
        { id: "props", slug: "props-and-state", title: "Props and State", duration: "18 min", type: "video" as const, completed: false, current: true },
        { id: "events", slug: "event-handling", title: "Event Handling", duration: "10 min", type: "video" as const, completed: false },
        { id: "reading1", slug: "best-practices-guide", title: "Best Practices Guide", duration: "8 min", type: "reading" as const, completed: false }
      ]
    },
    {
      id: "advanced",
      title: "3. Advanced Patterns",
      lessons: [
        { id: "hooks", slug: "custom-hooks", title: "Custom Hooks", duration: "20 min", type: "video" as const, completed: false },
        { id: "context", slug: "context-api", title: "Context API", duration: "16 min", type: "video" as const, completed: false },
        { id: "performance", slug: "performance-optimization", title: "Performance Optimization", duration: "22 min", type: "video" as const, completed: false }
      ]
    }
  ];

  const handleLessonSelect = (lessonSlug: string) => {
    console.log('Selected lesson slug:', lessonSlug);
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="h-screen bg-background flex">
      <CourseSidebar
        modules={mockModules}
        progressPercent={45}
        completedCount={4}
        totalCount={10}
        onLessonSelect={handleLessonSelect}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-4">Course Content Sidebar</h2>
        <p className="text-muted-foreground">
          This sidebar shows the course structure with progress tracking and search functionality.
          Try collapsing/expanding and searching for lessons.
        </p>
      </div>
    </div>
  );
}
