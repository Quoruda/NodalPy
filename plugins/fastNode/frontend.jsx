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
