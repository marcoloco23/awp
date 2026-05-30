import { Network, Users, Wallet, ShieldCheck, AlertTriangle, Building2, Boxes } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { readOrgChart } from "@/lib/reader";
import type { OrgUnitNode, OrgValidationIssueSummary } from "@/lib/types";

export const metadata = { title: "Organizations" };

// The chart is read from workspace files at request time, so it must not be
// statically prerendered against the build-time (empty) workspace.
export const dynamic = "force-dynamic";

const KIND_META: Record<OrgUnitNode["kind"], { icon: typeof Building2; label: string }> = {
  org: { icon: Building2, label: "org" },
  division: { icon: Boxes, label: "division" },
  team: { icon: Users, label: "team" },
};

function UnitRow({ unit }: { unit: OrgUnitNode }) {
  const { icon: KindIcon, label } = KIND_META[unit.kind];
  return (
    <div>
      <div className="flex items-start gap-3 py-2" style={{ marginLeft: unit.depth * 24 }}>
        {unit.depth > 0 && (
          <span aria-hidden className="self-stretch border-l border-[var(--border-subtle)] -ml-3" />
        )}
        <Card padding="md" className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <KindIcon size={15} className="text-[var(--text-muted)] shrink-0" />
                <h3 className="text-title text-[var(--text-primary)] truncate">{unit.name}</h3>
                <Badge variant="muted">{label}</Badge>
                <StatusBadge status={unit.status} />
                {unit.overBudget && (
                  <Badge variant="danger">over budget: {unit.exceededBudgetLines.join(", ")}</Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                {unit.mission}
              </p>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{unit.id}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              <Users size={12} /> {unit.memberCount} member{unit.memberCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <Network size={12} /> {unit.directChildren} child
              {unit.directChildren !== 1 ? "ren" : ""}
              {unit.totalDescendants > unit.directChildren && (
                <span className="text-[var(--text-muted)]"> ({unit.totalDescendants} total)</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={12} /> {unit.ownCapabilityCount} own
              {unit.effectiveCapabilityCount > unit.ownCapabilityCount && (
                <span className="text-[var(--text-muted)]">
                  {" "}
                  / {unit.effectiveCapabilityCount} effective
                </span>
              )}
            </span>
            {unit.overBudget && (
              <span className="inline-flex items-center gap-1 text-[var(--danger)]">
                <Wallet size={12} /> over budget
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 mt-1.5 text-[10px] font-mono text-[var(--text-muted)]">
            <span>accountable: {unit.accountableAgent}</span>
            <span>owner: {unit.humanOwner}</span>
          </div>
        </Card>
      </div>

      {unit.children.map((child) => (
        <UnitRow key={child.id} unit={child} />
      ))}
    </div>
  );
}

function IssuePanel({ issues }: { issues: OrgValidationIssueSummary[] }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-[var(--warning)]" />
        <h2 className="text-title text-[var(--text-primary)]">Structural issues</h2>
        <Badge variant={errors.length > 0 ? "danger" : "warning"}>
          {errors.length} error{errors.length !== 1 ? "s" : ""}, {warnings.length} warning
          {warnings.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <ul className="space-y-2.5">
        {issues.map((issue, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-start gap-2">
              <Badge variant={issue.severity === "error" ? "danger" : "warning"}>
                {issue.severity}
              </Badge>
              <div className="min-w-0">
                <span className="text-[var(--text-primary)]">
                  <span className="font-mono text-[var(--text-muted)]">
                    {issue.orgId || "(structure)"}
                  </span>{" "}
                  — {issue.message}
                </span>
                {issue.remediation && (
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    <span className="text-[var(--accent)]">fix:</span> {issue.remediation}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function OrgPage() {
  const chart = await readOrgChart();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">Organizations</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Recursive machine org chart (OGP) — units, capability scope, budgets, and accountability
        </p>
      </div>

      {chart.unitCount === 0 ? (
        <EmptyState
          icon={Network}
          title="No organizations"
          description="Create one with: awp org create <slug> --kind org"
        />
      ) : (
        <>
          {chart.issues.length > 0 && <IssuePanel issues={chart.issues} />}

          <div className="space-y-1">
            {chart.roots.map((root) => (
              <UnitRow key={root.id} unit={root} />
            ))}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            {chart.unitCount} unit{chart.unitCount !== 1 ? "s" : ""} · OGP gates are advisory —
            humans decide.
          </p>
        </>
      )}
    </div>
  );
}
