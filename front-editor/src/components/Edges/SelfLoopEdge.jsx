import React from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

export default function SelfLoopEdge({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    id,
    source,
    target
}) {
    // Check if it is a self-loop
    if (source === target) {
        // Custom loop path logic
        // We assume Left/Right handles for now, or just calculate based on positions
        // For a self-loop on the same node (Left Input, Right Output), we want a loop above or below.

        // Calculate loop bounds
        const loopHeight = 100; // Height of the loop arc
        const loopWidth = 50;   // Distance from node

        // Assuming source is Right (Output) and target is Left (Input)
        // If we draw a path that goes Up, Left, Down

        // Control points
        // P1: Out from Source
        // P2: Up/Out
        // P3: Up/In
        // P4: In to Target

        // Simple Path: M sourceX,sourceY C (sourceX+50),(sourceY-50) (targetX-50),(targetY-50) targetX,targetY
        // But since it's the same node, sourceX > targetX (usually output on right, input on left)

        const radius = 50;
        // Path: 
        // Start at Source (Right)
        // Curve Out/Up
        // Go Left above the node
        // Curve Down/In to Target (Left)

        // Let's make a big arc over the node
        const topY = Math.min(sourceY, targetY) - loopHeight;

        const path = `M ${sourceX} ${sourceY} C ${sourceX + radius} ${sourceY} ${sourceX + radius} ${topY} ${sourceX} ${topY} L ${targetX} ${topY} C ${targetX - radius} ${topY} ${targetX - radius} ${targetY} ${targetX} ${targetY}`;

        return (
            <BaseEdge path={path} markerEnd={markerEnd} style={style} />
        );
    }

    // Fallback to standard Bezier for normal edges
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
    );
}
