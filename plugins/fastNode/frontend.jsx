import FastNode from './FastNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

uiRegistry.registerNodeType({
    type: 'FastNode',
    component: FastNode,
    config: {
        type: 'FastNode',
        label: 'Fast Node',
        colorVar: '--color-fast',
        color: '#74b9ff',
        category: 'Logic',
        autoTrigger: true
    },
    defaultData: {
        title: 'Fast Node',
        code: "# Safe default: check if input exists\noutput = (input1 * 2) if 'input1' in locals() else 0",
        inputs: [{ id: 'in1', name: 'input1' }],
        outputs: [{ id: 'out1', name: 'output' }]
    }
});

uiRegistry.registerDemo("Mathematical Chain (FastNode)", {
    "nodes": [
        {
            "id": "401",
            "type": "NumberNode",
            "position": { "x": 104, "y": 114 },
            "data": {
                "title": "Input Number",
                "value": 5,
                "code": "output = 50",
                "outputs": [{ "id": "output", "name": "output" }]
            }
        },
        {
            "id": "402",
            "type": "FastNode",
            "position": { "x": 448, "y": 270 },
            "data": {
                "title": "Square",
                "code": "result = output ** 2",
                "inputs": [{ "id": "in-val", "name": "output" }],
                "outputs": [{ "id": "out-res", "name": "result" }]
            }
        },
        {
            "id": "403",
            "type": "FastNode",
            "position": { "x": 858, "y": 96 },
            "data": {
                "title": "Scaler",
                "code": "scaled = (result * 2) + 10",
                "inputs": [{ "id": "in-res", "name": "result" }],
                "outputs": [{ "id": "out-scale", "name": "scaled" }]
            }
        },
        {
            "id": "404",
            "type": "FastNode",
            "position": { "x": 1382, "y": 266 },
            "data": {
                "title": "Formatter",
                "code": "message = f\"Final calculated value: {scaled}\"",
                "inputs": [{ "id": "in-scale", "name": "scaled" }],
                "outputs": [{ "id": "out-msg", "name": "message" }]
            }
        },
        {
            "id": "405",
            "type": "ObserverNode",
            "position": { "x": 1870, "y": 64 },
            "data": {
                "title": "Result Viewer",
                "inputs": [{ "id": "in1", "name": "message" }]
            }
        }
    ],
    "edges": [
        { "id": "e401-402", "source": "401", "sourceHandle": "output", "target": "402", "targetHandle": "in-val" },
        { "id": "e402-403", "source": "402", "sourceHandle": "out-res", "target": "403", "targetHandle": "in-res" },
        { "id": "e403-404", "source": "403", "sourceHandle": "out-scale", "target": "404", "targetHandle": "in-scale" },
        { "id": "e404-405", "source": "404", "sourceHandle": "out-msg", "target": "405", "targetHandle": null }
    ]
});
