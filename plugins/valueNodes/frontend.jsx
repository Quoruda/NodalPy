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
