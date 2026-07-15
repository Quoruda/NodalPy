import { useEffect, useRef } from 'react';
import { uiRegistry } from '../core/uiRegistry';

/**
 * Hook that listens for native keyboard shortcuts (e.g., Ctrl+S)
 * AND shortcuts registered by plugins via uiRegistry.registerShortcut().
 *
 * The ActionContext passed to each shortcut's action callback contains:
 *   - nodes, edges: current graph state (read-only, use setters to mutate)
 *   - selectedNodes, selectedEdges: current selection
 *   - setNodes, setEdges: React state setters
 *   - takeSnapshot: call before any mutation to enable Ctrl+Z undo
 */
export const useKeyboardShortcuts = (context, { saveProjectToFile }) => {
    // Always keep a ref to the latest context and actions
    const contextRef = useRef(context);
    const actionsRef = useRef({ saveProjectToFile });
    
    // Update refs synchronously during render
    contextRef.current = context;
    actionsRef.current = { saveProjectToFile };

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Never intercept shortcuts while typing in text fields or code editors
            if (
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.closest('.cm-editor') ||
                e.target.closest('.nodrag')
            ) {
                return;
            }

            // Native Shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                actionsRef.current.saveProjectToFile();
                return;
            }

            // Plugin Shortcuts
            const shortcuts = uiRegistry.slots.keyboardShortcuts;
            for (const shortcut of shortcuts) {
                const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
                const shiftMatch = !!shortcut.shift === e.shiftKey;
                const altMatch = !!shortcut.alt === e.altKey;
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

                if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
                    e.preventDefault();
                    shortcut.action(contextRef.current);
                    return; // first match wins
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []); 
};
