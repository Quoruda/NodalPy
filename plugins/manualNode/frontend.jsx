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
