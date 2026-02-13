import CustomNode from './CustomNode/CustomNode.jsx';
import ObserverNode from "./ObserverNode/ObserverNode.jsx";
import FastNode from "./FastNode/FastNode.jsx";
import NumberNode from "./ValueNodes/NumberNode.jsx";
import BooleanNode from "./ValueNodes/BooleanNode.jsx";
import StringNode from "./ValueNodes/StringNode.jsx";
import FileNode from "./ValueNodes/FileNode.jsx";

// ✅ Export simple et propre - Fast Refresh compatible
export const NodeTypes = {
    CustomNode: CustomNode,
    ObserverNode: ObserverNode,
    FastNode: FastNode,
    NumberNode: NumberNode,
    BooleanNode: BooleanNode,
    StringNode: StringNode,
    FileNode: FileNode
};