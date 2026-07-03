/**
 * Builds the list of variables to pass to the backend for node execution.
 * Maps edges, source node outputs, and target node inputs.
 *
 * @param {Object} node   - Target node data (must have `id` and `inputs`)
 * @param {Array}  edges  - List of edges in the graph
 * @param {Array}  nodes  - List of nodes in the graph
 * @returns {Array} List of { source, name, target }
 */
export const buildVariables = (node, edges, nodes) => {
    const variables = [];

    for (const edge of edges) {
        if (edge.target !== node.id) continue;

        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) continue;

        // Find the target variable name from the node's input definition
        const targetInput = (node.inputs || []).find(v => v.id === edge.targetHandle);
        if (!targetInput) continue;

        // Find the source variable name from the source node's output definition
        const sourceOutput = (sourceNode.data.outputs || []).find(o => o.id === edge.sourceHandle);

        // Fallback: if only one output exists and handle ID doesn't match, use it anyway
        const resolvedOutput =
            sourceOutput ?? (sourceNode.data.outputs?.length === 1 ? sourceNode.data.outputs[0] : null);

        if (resolvedOutput) {
            variables.push({
                source: edge.source,
                name: resolvedOutput.name,
                target: targetInput.name,
            });
        }
    }

    return variables;
};
