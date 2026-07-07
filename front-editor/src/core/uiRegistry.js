class UiRegistry {
    constructor() {
        this.slots = {
            sidebarTabs: [],
            menuItems: [],
            nodeTypes: [],
            demos: {}
        };
    }

    registerSidebarTab(tab) {
        this.slots.sidebarTabs.push(tab);
    }

    registerMenuItem(item) {
        this.slots.menuItems.push(item);
    }

    registerNodeType(node) {
        this.slots.nodeTypes.push(node);
    }

    registerDemo(name, demoData) {
        this.slots.demos[name] = demoData;
    }
}

export const uiRegistry = new UiRegistry();
