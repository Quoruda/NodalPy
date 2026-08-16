import TimerNode from './TimerNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

const defaultTz = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

uiRegistry.registerNodeType({
    type: 'TimerNode',
    component: TimerNode,
    config: {
        type: 'TimerNode',
        label: 'Timer Trigger',
        icon: '⏱️',
        colorVar: '--color-custom',
        color: '#e67e22',
        category: 'Triggers',
        isTrigger: true,
        supportsShadowing: true
    },
    defaultData: {
        title: 'Timer Trigger',
        isActive: false,
        mode: 'interval',
        interval: 5,
        unit: 'minutes',
        targetTime: '12:00:00',
        timezone: defaultTz,
        repeatDaily: true,
        tickCount: 0,
        lastTriggeredAt: null,
        outputs: [{ id: 'out1', name: 'trigger' }]
    }
});
