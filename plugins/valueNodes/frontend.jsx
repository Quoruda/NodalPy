import NumberNode from './NumberNode.jsx';
import BooleanNode from './BooleanNode.jsx';
import StringNode from './StringNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

uiRegistry.registerNodeType({
    type: 'NumberNode',
    component: NumberNode,
    config: {
        type: 'NumberNode',
        label: 'Number',
        colorVar: '--color-number',
        color: '#0984e3',
        category: 'Input'
    },
    defaultData: {
        title: 'Number',
        value: 0,
        code: "output = 0",
        outputs: [{ id: 'output', name: 'output' }]
    }
});

uiRegistry.registerNodeType({
    type: 'BooleanNode',
    component: BooleanNode,
    config: {
        type: 'BooleanNode',
        label: 'Boolean',
        colorVar: '--color-boolean',
        color: '#fd79a8',
        category: 'Input'
    },
    defaultData: {
        title: 'Boolean',
        value: false,
        code: "output = False",
        outputs: [{ id: 'output', name: 'output' }]
    }
});

uiRegistry.registerNodeType({
    type: 'StringNode',
    component: StringNode,
    config: {
        type: 'StringNode',
        label: 'String',
        colorVar: '--color-string',
        color: '#2ecc71',
        category: 'Input'
    },
    defaultData: {
        title: 'String',
        value: "",
        code: 'output = ""',
        outputs: [{ id: 'output', name: 'output' }]
    }
});

uiRegistry.registerDemo("String Processing (Word Counter)", {
    "nodes": [
        {
            "id": "101",
            "type": "StringNode",
            "position": { "x": 100, "y": 150 },
            "data": {
                "title": "Source Text",
                "value": "Hello NodalPy editor from scratch",
                "code": "output = \"Hello NodalPy editor from scratch\"",
                "outputs": [{ "id": "output", "name": "output" }]
            }
        },
        {
            "id": "102",
            "type": "FastNode",
            "position": { "x": 500, "y": 150 },
            "data": {
                "title": "Word Counter",
                "code": "word_count = len(output.split())",
                "inputs": [{ "id": "in-text", "name": "output" }],
                "outputs": [{ "id": "out-count", "name": "word_count" }]
            }
        },
        {
            "id": "103",
            "type": "ObserverNode",
            "position": { "x": 900, "y": 150 },
            "data": {
                "title": "Result Viewer",
                "inputs": [{ "id": "in1", "name": "word_count" }]
            }
        }
    ],
    "edges": [
        { "id": "e101-102", "source": "101", "sourceHandle": "output", "target": "102", "targetHandle": "in-text" },
        { "id": "e102-103", "source": "102", "sourceHandle": "out-count", "target": "103", "targetHandle": null }
    ]
});

uiRegistry.registerDemo("Number Processing (Square)", {
    "nodes": [
        {
            "id": "201",
            "type": "NumberNode",
            "position": { "x": 100, "y": 150 },
            "data": {
                "title": "Source Number",
                "value": 6,
                "code": "output = 6",
                "outputs": [{ "id": "output", "name": "output" }]
            }
        },
        {
            "id": "202",
            "type": "FastNode",
            "position": { "x": 500, "y": 150 },
            "data": {
                "title": "Square Calculator",
                "code": "square = output ** 2",
                "inputs": [{ "id": "in-val", "name": "output" }],
                "outputs": [{ "id": "out-sq", "name": "square" }]
            }
        },
        {
            "id": "203",
            "type": "ObserverNode",
            "position": { "x": 900, "y": 150 },
            "data": {
                "title": "Result Viewer",
                "inputs": [{ "id": "in1", "name": "square" }]
            }
        }
    ],
    "edges": [
        { "id": "e201-202", "source": "201", "sourceHandle": "output", "target": "202", "targetHandle": "in-val" },
        { "id": "e202-203", "source": "202", "sourceHandle": "out-sq", "target": "203", "targetHandle": null }
    ]
});

uiRegistry.registerDemo("Boolean Inverter (NOT Gate)", {
    "nodes": [
        {
            "id": "301",
            "type": "BooleanNode",
            "position": { "x": 100, "y": 150 },
            "data": {
                "title": "Source Boolean",
                "value": true,
                "code": "output = True",
                "outputs": [{ "id": "output", "name": "output" }]
                }
            },
            {
                "id": "302",
                "type": "FastNode",
                "position": { "x": 500, "y": 150 },
                "data": {
                    "title": "Logic Gate NOT",
                    "code": "inverted = not output",
                    "inputs": [{ "id": "in-bool", "name": "output" }],
                    "outputs": [{ "id": "out-inv", "name": "inverted" }]
                }
            },
            {
                "id": "303",
                "type": "ObserverNode",
                "position": { "x": 900, "y": 150 },
                "data": {
                    "title": "Result Viewer",
                    "inputs": [{ "id": "in1", "name": "inverted" }]
                }
            }
        ],
        "edges": [
            { "id": "e301-302", "source": "301", "sourceHandle": "output", "target": "302", "targetHandle": "in-bool" },
            { "id": "e302-303", "source": "302", "sourceHandle": "out-inv", "target": "303", "targetHandle": null }
        ]
    });
