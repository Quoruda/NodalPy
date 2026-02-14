// Configuration for all available node types
export const availableNodes = [
    {
        type: 'CustomNode',
        label: 'Manuel Node',
        colorVar: '--color-custom',
        color: '#6c5ce7',
        category: 'Logic'
    },
    {
        type: 'FastNode',
        label: 'Fast Node',
        colorVar: '--color-fast',
        color: '#74b9ff',
        category: 'Logic'
    },
    {
        type: 'NumberNode',
        label: 'Number',
        colorVar: '--color-number',
        color: '#0984e3',
        category: 'Input'
    },
    {
        type: 'BooleanNode',
        label: 'Boolean',
        colorVar: '--color-boolean',
        color: '#fd79a8',
        category: 'Input'
    },
    {
        type: 'StringNode',
        label: 'String',
        colorVar: '--color-string',
        color: '#2ecc71', // Corrected from Yellow to Green
        category: 'Input'
    },
    {
        type: 'FileNode',
        label: 'File',
        colorVar: '--color-file',
        color: '#a29bfe',
        category: 'Input'
    },
    {
        type: 'ObserverNode',
        label: 'Observer',
        colorVar: '--color-observer',
        color: '#00d2d3', // Corrected from Green to Cyan
        category: 'Output'
    }
];
