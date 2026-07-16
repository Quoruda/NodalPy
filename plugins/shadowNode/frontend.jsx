import ShadowNode from './ShadowNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

uiRegistry.registerNodeType({
    type: 'shadowNode',
    component: ShadowNode,
    config: {
        type: 'shadowNode',
        label: 'Link Node',
        category: 'Utilities',
        color: '#2a2a35', // Dark theme
        inputs: 0,
        outputs: 0,
        autoTrigger: false
    },
    defaultData: {
        title: 'Link',
        masterId: null
    }
});
