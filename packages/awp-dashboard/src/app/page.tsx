import {
  FolderKanban,
  ListChecks,
  BookOpen,
  Shield,
  FileText,
  Brain,
} from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { AgentIdentityCard } from "@/components/dashboard/AgentIdentityCard";
import { HealthBanner } from "@/components/dashboard/HealthBanner";
import { ProjectSummary } from "@/components/dashboard/ProjectSummary";
import { ActiveTasks } from "@/components/dashboard/ActiveTasks";
import {
  readIdentity,
  readSoul,
  readManifest,
  listProjects,
  computeWorkspaceHealth,
  computeStats,
} from "@/lib/reader";

export default async function DashboardPage() {
  const [identity, soul, manifest, health, stats, projects] = await Promise.all([
    readIdentity(),
    readSoul(),
    readManifest(),
    computeWorkspaceHealth(),
    computeStats(),
    listProjects(),
  ]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Health Warnings */}
      <HealthBanner health={health} />

      {/* Agent Identity Hero */}
      <AgentIdentityCard identity={identity} soul={soul} manifest={manifest} />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 stagger-children">
        <MetricCard
          label="Projects"
          value={stats.projects}
          icon={FolderKanban}
          variant="accent"
        />
        <MetricCard
          label="Tasks"
          value={stats.tasks.total}
          icon={ListChecks}
          detail={`${stats.tasks.active} active · ${stats.tasks.completed} done`}
        />
        <MetricCard
          label="Artifacts"
          value={stats.artifacts}
          icon={BookOpen}
        />
        <MetricCard
          label="Agents"
          value={stats.reputationProfiles}
          icon={Shield}
        />
        <MetricCard
          label="Contracts"
          value={stats.contracts.total}
          icon={FileText}
          detail={`${stats.contracts.active} active`}
        />
        <MetricCard
          label="Memory"
          value={stats.memoryLogs}
          icon={Brain}
          detail="daily logs"
        />
      </div>

      {/* Projects + Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectSummary projects={projects} />
        <ActiveTasks projects={projects} />
      </div>
    </div>
  );
}
