// Load all plugins eagerly at application startup.
// By evaluating these modules, they will automatically execute their top-level code 
// and register themselves with the uiRegistry.
import.meta.glob('../../../plugins/*/frontend.jsx', { eager: true });
