import CustomNode from './CustomNode/CustomNode.jsx';
import ObserverNode from "./ObserverNode/ObserverNode.jsx";
import NumberNode from "./ValueNodes/NumberNode.jsx";
import BooleanNode from "./ValueNodes/BooleanNode.jsx";
import StringNode from "./ValueNodes/StringNode.jsx";

export const NodeTypes = {
    CustomNode: CustomNode,
    ObserverNode: ObserverNode,
    NumberNode: NumberNode,
    BooleanNode: BooleanNode,
    StringNode: StringNode
};