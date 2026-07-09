import ManualNode from './ManualNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

uiRegistry.registerNodeType({
    type: 'ManualNode',
    component: ManualNode,
    config: {
        type: 'ManualNode',
        label: 'Manual Node',
        colorVar: '--color-custom',
        color: '#6c5ce7',
        category: 'Logic'
    },
    defaultData: {
        title: 'Manual Node',
        code: "output = 'Hello World'",
        inputs: [{ id: 'in1', name: 'input1' }],
        outputs: [{ id: 'out1', name: 'output' }]
    }
});

uiRegistry.registerDemo("Fibonacci Sequence (ManualNode)", {
    "nodes": [
        {
            "id": "501",
            "type": "NumberNode",
            "position": { "x": 100, "y": 150 },
            "data": {
                "title": "Input Number",
                "value": 10,
                "code": "output = 10",
                "outputs": [{ "id": "output", "name": "output" }]
            }
        },
        {
            "id": "502",
            "type": "ManualNode",
            "position": { "x": 500, "y": 150 },
            "data": {
                "title": "Fibonacci Generator",
                "code": "limit = int(n)\n\nsequence = []\na, b = 0, 1\nfor _ in range(limit):\n    sequence.append(a)\n    a, b = b, a + b",
                "inputs": [{ "id": "in-n", "name": "n" }],
                "outputs": [{ "id": "out-seq", "name": "sequence" }]
            }
        },
        {
            "id": "503",
            "type": "ObserverNode",
            "position": { "x": 900, "y": 150 },
            "data": {
                "title": "Result Viewer",
                "inputs": [{ "id": "in1", "name": "sequence" }]
            }
        }
    ],
    "edges": [
        { "id": "e501-502", "source": "501", "sourceHandle": "output", "target": "502", "targetHandle": "in-n" },
        { "id": "e502-503", "source": "502", "sourceHandle": "out-seq", "target": "503", "targetHandle": null }
    ]
});
