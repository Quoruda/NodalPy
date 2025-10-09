import {memo} from "react";

import '../nodes.css'
import './ObserverNode.css'

const ObserverNode = memo( ({data}) => {
    return (
        <div className="node observer-node">

            <div className="observer-header">
                <div className="observer-eyes">
                    <div className="eye">
                        <div className="pupil"></div>
                    </div>
                    <div className="eye">
                        <div className="pupil"></div>
                    </div>
                </div>
                <span className="observer-title">Observer</span>
            </div>
        </div>
    )
});


ObserverNode.displayName = 'ObserverNode';
export default ObserverNode;