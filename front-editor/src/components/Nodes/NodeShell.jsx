import React, { memo, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useFlowContext } from '../FlowContext.jsx';
import './NodeShell.css';

/**
 * Hook utilitaire pour les nœuds.
 * Fournit les fonctions courantes (updateNode, stopPropagation).
 */
export const useNodeShell = (id) => {
    const { updateNode } = useFlowContext();
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);
    return { updateNode, stopPropagation };
};

/**
 * Composant de base pour l'en-tête d'un nœud.
 * Gère le champ de titre et peut recevoir des enfants (comme des boutons Play).
 */
export const NodeShellHeader = memo(({ 
    nodeClass, 
    title, 
    onTitleChange, 
    onTitleBlur,
    onTitleKeyDown,
    readOnly = false,
    children,
    rightChildren
}) => {
    return (
        <div className={`node-header ${nodeClass}-header`}>
            {children}
            <div className="title-section">
                {readOnly ? (
                    <span className="title-readonly">{title}</span>
                ) : (
                    <input
                        type="text"
                        className="node-shell-title title-input nodrag"
                        placeholder="Title"
                        value={title || ''}
                        onChange={onTitleChange}
                        onBlur={onTitleBlur}
                        onKeyDown={onTitleKeyDown}
                    />
                )}
            </div>
            {rightChildren}
        </div>
    );
});
NodeShellHeader.displayName = 'NodeShellHeader';

/**
 * Composant universel pour tous les nœuds NodalPy.
 * Gère le conteneur, l'état de sélection, et optionnellement les handles simples.
 */
export const NodeShell = memo(({ 
    id, 
    selected, 
    nodeClass, 
    inputs = [], 
    outputs = [], 
    children,
    // Rend automatiquement les handles basiques si des tableaux sont fournis
    renderBasicHandles = false 
}) => {
    
    // Rendu automatique de handles basiques statiques (utile pour Observer, Value Nodes)
    const baseClass = nodeClass.replace('-node', '');

    const basicInputHandles = renderBasicHandles && inputs.map((input, i) => (
        <Handle
            key={`in-${i}`}
            type="target"
            position={Position.Left}
            id={input.id || input}
            className={`${baseClass}-handle`}
            style={{ top: `${50 + (i * 20)}%` }} // Décalage si multiples
        />
    ));

    const basicOutputHandles = renderBasicHandles && outputs.map((output, i) => (
        <Handle
            key={`out-${i}`}
            type="source"
            position={Position.Right}
            id={output.id || output}
            className={`${baseClass}-handle`}
            style={{ top: `${50 + (i * 20)}%` }} // Décalage si multiples
        />
    ));

    return (
        <div className={`node node-shell ${nodeClass} ${selected ? 'selected' : ''}`}>
            {basicInputHandles}
            {children}
            {basicOutputHandles}
        </div>
    );
});
NodeShell.displayName = 'NodeShell';

export default NodeShell;
