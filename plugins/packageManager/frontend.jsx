import React from 'react';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';
import PackageManager from './PackageManager.jsx';

uiRegistry.registerSidebarTab({
    id: 'packages',
    label: '📦 Packages',
    component: PackageManager
});

export default PackageManager;
