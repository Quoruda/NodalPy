import {memo} from "react";

const ObserverNode = memo( ({data}) => {
    return (
        <div>
            ObserverNode
        </div>
    )
});



ObserverNode.displayName = 'ObserverNode';
export default ObserverNode;