
/**
 * Checks if adding a new edge would create a cycle in the graph.
 * @param {Array} nodes - Current nodes
 * @param {Array} edges - Current edges
 * @param {Object} newEdge - The potential new edge { source, target }
 * @returns {boolean} - True if a cycle would be created
 */
export const wouldCreateCycle = (nodes, edges, newEdge) => {
    // 1. Self-loop check
    if (newEdge.source === newEdge.target) return true;

    // 2. Build adjacency list for the EXISTING graph
    const adj = {};
    nodes.forEach(node => {
        adj[node.id] = [];
    });

    edges.forEach(edge => {
        if (adj[edge.source]) {
            adj[edge.source].push(edge.target);
        }
    });

    // 3. Check if path exists from Target -> Source
    // If we can reach Source from Target, adding Source -> Target would close the loop.
    return pathExists(adj, newEdge.target, newEdge.source);
};


/**
 * Helper: Check if a path exists between start and end using BFS
 */
const pathExists = (adj, start, end) => {
    if (start === end) return true;

    const queue = [start];
    const visited = new Set([start]);

    while (queue.length > 0) {
        const curr = queue.shift();

        if (curr === end) return true;

        if (adj[curr]) {
            for (const neighbor of adj[curr]) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
    }
    return false;
};

/**
 * Checks if the given graph contains any cycle.
 * Used for validating imports.
 * @param {Array} nodes 
 * @param {Array} edges 
 * @returns {boolean}
 */
export const containsCycle = (nodes, edges) => {
    const adj = {};
    nodes.forEach(node => adj[node.id] = []);
    edges.forEach(edge => {
        if (adj[edge.source]) adj[edge.source].push(edge.target);
    });

    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (nodeId) => {
        visited.add(nodeId);
        recStack.add(nodeId);

        if (adj[nodeId]) {
            for (const neighbor of adj[nodeId]) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor)) return true;
                } else if (recStack.has(neighbor)) {
                    return true;
                }
            }
        }

        recStack.delete(nodeId);
        return false;
    };

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            if (hasCycle(node.id)) return true;
        }
    }
    return false;
};
