class UiRegistry {
    constructor() {
        this.slots = {
            sidebarTabs: [],
            menuItems: [],
            nodeTypes: [],
            demos: {},
            keyboardShortcuts: [],
            callbacks: {}   // { eventName: [callback, ...] }
        };
    }

    registerSidebarTab(tab) {
        this.slots.sidebarTabs.push(tab);
    }

    registerMenuItem(item) {
        this.slots.menuItems.push(item);
    }

    registerNodeType(node) {
        // Default UI schema for all plugins
        const defaultSchema = {
            category: 'Uncategorized',
            color: '#aaaaaa',
            colorVar: '--color-custom',
            supportsShadowing: false,
            autoTrigger: false,
            forceRunOnLoad: false,
            icon: '📦',
        };

        const configWithDefaults = {
            ...defaultSchema,
            ...(node.config || {})
        };

        this.slots.nodeTypes.push({
            ...node,
            config: configWithDefaults
        });
    }

    registerDemo(name, demoData) {
        this.slots.demos[name] = demoData;
    }

    /**
     * Register a plugin keyboard shortcut.
     * @param {object} def - Shortcut definition
     * @param {string} def.key - The key character (e.g. 'g', 's')
     * @param {boolean} [def.ctrl] - Requires Ctrl/Cmd
     * @param {boolean} [def.shift] - Requires Shift
     * @param {boolean} [def.alt] - Requires Alt
     * @param {string} [def.description] - Human-readable description
     * @param {function} def.action - Callback receiving an ActionContext object
     */
    registerShortcut(def) {
        this.slots.keyboardShortcuts.push(def);
    }

    /**
     * Register a callback for a canvas event.
     * Plugins use this to react to events like 'onNodeDragStop'.
     * @param {string} eventName - Event name (e.g. 'onNodeDragStop')
     * @param {function} callback - Receives (event, node, ActionContext)
     */
    registerCallback(eventName, callback) {
        if (!this.slots.callbacks[eventName]) {
            this.slots.callbacks[eventName] = [];
        }
        this.slots.callbacks[eventName].push(callback);
    }

    /**
     * Fire all registered callbacks for a given event.
     * @param {string} eventName
     * @param  {...any} args
     */
    fireCallbacks(eventName, ...args) {
        const cbs = this.slots.callbacks[eventName] || [];
        cbs.forEach(cb => cb(...args));
    }
}

export const uiRegistry = new UiRegistry();
