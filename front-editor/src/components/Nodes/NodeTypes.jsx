import CustomNode from './CustomNode/CustomNode.jsx';
import ObserverNode from "./ObserverNode/ObserverNode.jsx";
import FastNode from "./FastNode/FastNode.jsx";

// ✅ Export simple et propre - Fast Refresh compatible
export const NodeTypes = {
    CustomNode: CustomNode,
    ObserverNode: ObserverNode,
    FastNode: FastNode
};