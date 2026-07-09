import ObserverNode from './ObserverNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

uiRegistry.registerNodeType({
    type: 'ObserverNode',
    component: ObserverNode,
    config: {
        type: 'ObserverNode',
        label: 'Observer',
        colorVar: '--color-observer',
        color: '#00d2d3',
        category: 'Output'
    },
    defaultData: {
        title: 'Observer',
        outputs: []
    }
});
