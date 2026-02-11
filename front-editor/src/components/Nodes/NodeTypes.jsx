import CustomNode from './CustomNode/CustomNode.jsx';
import ObserverNode from "./ObserverNode/ObserverNode.jsx";
import FastNode from "./FastNode/FastNode.jsx";
import IntegerNode from "./ValueNodes/IntegerNode.jsx";
import FloatNode from "./ValueNodes/FloatNode.jsx";

// ✅ Export simple et propre - Fast Refresh compatible
export const NodeTypes = {
    CustomNode: CustomNode,
    ObserverNode: ObserverNode,
    FastNode: FastNode,
    IntegerNode: IntegerNode,
    FloatNode: FloatNode
};