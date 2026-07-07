class UiRegistry {
    constructor() {
        this.slots = {
            sidebarTabs: [],
            menuItems: []
        };
    }

    registerSidebarTab(tab) {
        this.slots.sidebarTabs.push(tab);
    }

    registerMenuItem(item) {
        this.slots.menuItems.push(item);
    }
}

export const uiRegistry = new UiRegistry();
