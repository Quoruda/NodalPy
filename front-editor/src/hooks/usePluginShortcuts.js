import { useEffect, useRef } from 'react';
import { uiRegistry } from '../core/uiRegistry';

/**
 * Generic hook that listens for keyboard shortcuts registered by plugins.
 * Plugins declare their own shortcuts via uiRegistry.registerShortcut().
 *
 * The ActionContext passed to each shortcut's action callback contains:
 *   - nodes, edges: current graph state (read-only, use setters to mutate)
 *   - selectedNodes, selectedEdges: current selection
 *   - setNodes, setEdges: React state setters
 *   - takeSnapshot: call before any mutation to enable Ctrl+Z undo
 */
export const usePluginShortcuts = (context) => {
    // Always keep a ref to the latest context so the event listener
    // never becomes stale, without re-registering on every render.
    const contextRef = useRef(context);
    useEffect(() => {
        contextRef.current = context;
    });

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
    }, []); // Empty deps: shortcuts are registered once at module load time
};
