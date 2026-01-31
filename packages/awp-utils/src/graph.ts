/**
 * Dependency graph algorithms for task ordering and cycle detection.
 *
 * Implements:
 * - Topological sort (Kahn's algorithm)
 * - Cycle detection (DFS-based)
 * - Critical path analysis
 * - Blocked task identification
 */

/**
 * Minimal task node for graph operations.
 */
export interface TaskNode {
  /** Task ID in format task:<project>/<slug> */
  id: string;
  /** Task IDs that must complete before this task */
  blockedBy: string[];
  /** Task IDs that are waiting on this task */
  blocks: string[];
  /** Current task status */
  status: string;
}

/**
 * Adjacency list representation of a dependency graph.
 */
export interface DependencyGraph {
  /** Map of task ID to task node */
  nodes: Map<string, TaskNode>;
  /** Adjacency list: task ID -> IDs of tasks it depends on (blockedBy) */
  inEdges: Map<string, Set<string>>;
  /** Reverse adjacency: task ID -> IDs of tasks that depend on it (blocks) */
  outEdges: Map<string, Set<string>>;
}

/**
 * Result of analyzing a task dependency graph.
 */
export interface GraphAnalysis {
  /** Topologically sorted task IDs (null if cycle exists) */
  sorted: string[] | null;
  /** Detected cycles (each cycle is an array of task IDs) */
  cycles: string[][];
  /** Critical path (longest dependency chain) */
  criticalPath: string[];
  /** Tasks blocked by incomplete dependencies: task ID -> blocking task IDs */
  blocked: Map<string, string[]>;
  /** True if the graph is a valid DAG (no cycles) */
  isValid: boolean;
}

/**
 * Build a dependency graph from a list of task nodes.
 *
 * @param tasks - Array of task nodes
 * @returns Dependency graph with adjacency lists
 */
export function buildGraph(tasks: TaskNode[]): DependencyGraph {
  const nodes = new Map<string, TaskNode>();
  const inEdges = new Map<string, Set<string>>();
  const outEdges = new Map<string, Set<string>>();

  // Initialize all nodes
  for (const task of tasks) {
    nodes.set(task.id, task);
    inEdges.set(task.id, new Set());
    outEdges.set(task.id, new Set());
  }

  // Build adjacency lists from blockedBy relationships
  for (const task of tasks) {
    for (const dep of task.blockedBy) {
      // Only add edge if both nodes exist in the graph
      if (nodes.has(dep)) {
        inEdges.get(task.id)!.add(dep);
        outEdges.get(dep)!.add(task.id);
      }
    }
  }

  return { nodes, inEdges, outEdges };
}

/**
 * Topologically sort tasks using Kahn's algorithm.
 * Returns null if a cycle is detected.
 *
 * @param graph - Dependency graph
 * @returns Sorted task IDs in execution order, or null if cycle exists
 */
export function topologicalSort(graph: DependencyGraph): string[] | null {
  const { nodes, inEdges } = graph;
  const result: string[] = [];

  // Calculate in-degrees (copy to avoid mutation)
  const inDegree = new Map<string, number>();
  for (const [id, deps] of inEdges) {
    inDegree.set(id, deps.size);
  }

  // Start with nodes that have no dependencies
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    // Reduce in-degree of dependent tasks
    const dependents = graph.outEdges.get(current) || new Set();
    for (const dep of dependents) {
      const newDegree = inDegree.get(dep)! - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        queue.push(dep);
      }
    }
  }

  // If we didn't process all nodes, there's a cycle
  if (result.length !== nodes.size) {
    return null;
  }

  return result;
}

/**
 * Detect all cycles in the dependency graph using DFS.
 *
 * @param graph - Dependency graph
 * @returns Array of cycles, where each cycle is an array of task IDs
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const { nodes, inEdges } = graph;
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const parent = new Map<string, string | null>();

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const deps = inEdges.get(nodeId) || new Set();
    for (const dep of deps) {
      if (!visited.has(dep)) {
        parent.set(dep, nodeId);
        dfs(dep, [...path]);
      } else if (recStack.has(dep)) {
        // Found a cycle - extract it
        const cycleStart = path.indexOf(dep);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(dep); // Close the cycle
          cycles.push(cycle);
        }
      }
    }

    recStack.delete(nodeId);
  }

  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      parent.set(nodeId, null);
      dfs(nodeId, []);
    }
  }

  // Deduplicate cycles (same cycle can be found from different starting points)
  const uniqueCycles = new Map<string, string[]>();
  for (const cycle of cycles) {
    // Normalize: rotate to start with smallest ID
    const minIdx = cycle.indexOf(cycle.slice(0, -1).reduce((a, b) => (a < b ? a : b)));
    const normalized = [...cycle.slice(minIdx, -1), ...cycle.slice(0, minIdx), cycle[minIdx]];
    const key = normalized.join("→");
    if (!uniqueCycles.has(key)) {
      uniqueCycles.set(key, normalized);
    }
  }

  return Array.from(uniqueCycles.values());
}

/**
 * Find the critical path (longest dependency chain) in the graph.
 * Uses dynamic programming on the DAG.
 *
 * @param graph - Dependency graph
 * @returns Array of task IDs forming the critical path
 */
export function findCriticalPath(graph: DependencyGraph): string[] {
  const sorted = topologicalSort(graph);
  if (!sorted) {
    // Graph has cycles, can't compute critical path
    return [];
  }

  const { inEdges } = graph;
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  // Initialize distances
  for (const id of sorted) {
    dist.set(id, 0);
    prev.set(id, null);
  }

  // Process in topological order
  for (const nodeId of sorted) {
    const deps = inEdges.get(nodeId) || new Set();
    for (const dep of deps) {
      const newDist = dist.get(dep)! + 1;
      if (newDist > dist.get(nodeId)!) {
        dist.set(nodeId, newDist);
        prev.set(nodeId, dep);
      }
    }
  }

  // Find the node with maximum distance (end of critical path)
  let maxDist = 0;
  let endNode: string | null = null;
  for (const [id, d] of dist) {
    if (d >= maxDist) {
      maxDist = d;
      endNode = id;
    }
  }

  if (!endNode) {
    return [];
  }

  // Reconstruct the critical path
  const path: string[] = [];
  let current: string | null = endNode;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) || null;
  }

  return path;
}

/**
 * Find tasks that are blocked by incomplete dependencies.
 *
 * @param graph - Dependency graph
 * @returns Map of task ID -> array of blocking (incomplete) task IDs
 */
export function getBlockedTasks(graph: DependencyGraph): Map<string, string[]> {
  const { nodes, inEdges } = graph;
  const blocked = new Map<string, string[]>();

  const incompleteTasks = new Set(
    Array.from(nodes.values())
      .filter((t) => t.status !== "completed" && t.status !== "cancelled")
      .map((t) => t.id)
  );

  for (const [taskId, deps] of inEdges) {
    const task = nodes.get(taskId)!;
    // Skip already completed/cancelled tasks
    if (task.status === "completed" || task.status === "cancelled") {
      continue;
    }

    const blockingDeps = Array.from(deps).filter((dep) => incompleteTasks.has(dep));
    if (blockingDeps.length > 0) {
      blocked.set(taskId, blockingDeps);
    }
  }

  return blocked;
}

/**
 * Perform a complete analysis of the task dependency graph.
 *
 * @param tasks - Array of task nodes
 * @returns Full graph analysis including sort, cycles, critical path, and blocked tasks
 */
export function analyzeGraph(tasks: TaskNode[]): GraphAnalysis {
  const graph = buildGraph(tasks);
  const sorted = topologicalSort(graph);
  const cycles = detectCycles(graph);
  const criticalPath = findCriticalPath(graph);
  const blocked = getBlockedTasks(graph);

  return {
    sorted,
    cycles,
    criticalPath,
    blocked,
    isValid: cycles.length === 0,
  };
}

/**
 * Extract the task slug from a full task ID.
 * e.g., "task:q3-launch/research" -> "research"
 *
 * @param taskId - Full task ID
 * @returns Task slug
 */
export function getTaskSlug(taskId: string): string {
  const parts = taskId.split("/");
  return parts[parts.length - 1];
}

/**
 * Extract the project slug from a full task ID.
 * e.g., "task:q3-launch/research" -> "q3-launch"
 *
 * @param taskId - Full task ID
 * @returns Project slug
 */
export function getProjectSlug(taskId: string): string {
  const match = taskId.match(/^task:([^/]+)/);
  return match ? match[1] : "";
}
