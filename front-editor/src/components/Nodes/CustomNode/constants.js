import { python } from '@codemirror/lang-python';
import { EditorView } from '@codemirror/view';

// ✅ Utilitaires de comparaison optimisés
export const arraysEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

// ✅ Extensions CodeMirror memoized globalement
export const CODE_EXTENSIONS = [python()];
export const OUTPUT_EXTENSIONS = [python(), EditorView.lineWrapping];

// ✅ Configurations CodeMirror stables
export const CODE_BASIC_SETUP = {
    lineNumbers: true,
    foldGutter: false,
    dropCursor: false,
    allowMultipleSelections: false
};

export const OUTPUT_BASIC_SETUP = {
    ...CODE_BASIC_SETUP,
    searchKeymap: false,
    closeBrackets: false,
    autocompletion: false
};