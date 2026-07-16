import React, { useMemo, useCallback, memo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { useFlowContext } from '../FlowContext.jsx';
import InputHandle from './InputHandle.jsx';
import OutputHandle from './OutputHandle.jsx';
import NodeShell, { NodeShellHeader } from './NodeShell.jsx';
import './NodeShell.css';

// Reusable header for all code nodes (adds run/state buttons)
const CodeNodeHeader = memo(({
    nodeClass,
    tempTitle,
    setTempTitle,
    handleSave,
    state,
    runCode,
    hideRunButton = false,
    children,
}) => (
    <NodeShellHeader
        nodeClass={nodeClass}
        title={tempTitle}
        onTitleChange={(e) => setTempTitle(e.target.value)}
        onTitleBlur={handleSave}
        onTitleKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        rightChildren={
            !hideRunButton && (
                <div className="controls-section">
                    {(state === 0 || state === undefined) && (
                        <button onClick={runCode} className="execute-button nodrag" title="Execute">▶</button>
                    )}
                    {state === 1 && (
                        <div className="running-button nodrag" title="Running">⏱</div>
                    )}
                    {(state === 2 || state === 3) && (
                        <button onClick={runCode} className="execute-button nodrag" title="Re-execute">🔄</button>
                    )}
                </div>
            )
        }
    >
        {children}
    </NodeShellHeader>
), (prev, next) =>
    prev.tempTitle === next.tempTitle &&
    prev.state === next.state &&
    prev.handleSave === next.handleSave &&
    prev.setTempTitle === next.setTempTitle &&
    prev.runCode === next.runCode &&
    prev.hideRunButton === next.hideRunButton
);

CodeNodeHeader.displayName = 'CodeNodeHeader';

// Universal container for code-based nodes.
// Plugins simply wrap this and inject their extra content via `children`.
const BaseCodeNode = ({
    id,
    data,
    nodeTypeClass,
    tempTitle,
    setTempTitle,
    handleSave,
    runCode,
    inputs,
    updateInput,
    removeInput,
    addInput,
    outputs,
    updateOutput,
    removeOutput,
    addOutput,
    handleCodeChange,
    updateNode,
    hideRunButton = false,
    headerChildren = null,
    children = null,
}) => {
    const { edges } = useFlowContext();
    const nodeId = id || data.id;

    const isCodeOpen = data.isCodeOpen !== false;
    const isLogsOpen = data.isLogsOpen !== false;

    const toggleCode = useCallback((e) => {
        e.stopPropagation();
        updateNode(nodeId, { isCodeOpen: !isCodeOpen });
    }, [updateNode, nodeId, isCodeOpen]);

    const toggleLogs = useCallback((e) => {
        e.stopPropagation();
        updateNode(nodeId, { isLogsOpen: !isLogsOpen });
    }, [updateNode, nodeId, isLogsOpen]);

    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    const connectionStatus = useMemo(() => {
        const nodeEdges = edges.filter(e => e.target === nodeId);
        return inputs.map((input) =>
            nodeEdges.filter(e => e.targetHandle === input.id).length < 1
        );
    }, [edges, inputs, nodeId]);

    const inputHandles = useMemo(() =>
        inputs.map((input, index) => (
            <InputHandle
                key={input.id}
                id={input.id}
                input={input.name}
                index={index}
                updateInput={updateInput}
                removeInput={removeInput}
                isConnectable={connectionStatus[index]}
            />
        )),
        [inputs, updateInput, removeInput, connectionStatus]
    );

    const outputHandles = useMemo(() =>
        outputs.map((output, index) => (
            <OutputHandle
                key={output.id}
                id={output.id}
                output={output.name}
                index={index}
                updateOutput={updateOutput}
                removeOutput={removeOutput}
            />
        )),
        [outputs, updateOutput, removeOutput]
    );

    return (
        <NodeShell id={id} selected={data.selected} nodeClass={nodeTypeClass}>
            <CodeNodeHeader
                nodeClass={nodeTypeClass}
                tempTitle={tempTitle}
                setTempTitle={setTempTitle}
                handleSave={handleSave}
                state={data.state}
                runCode={runCode}
                hideRunButton={hideRunButton}
            >
                {headerChildren}
            </CodeNodeHeader>

            <div className="node-body">
                <div className="node-inputs">
                    {inputHandles}
                    <button className="add-io-btn" onClick={addInput} title="Add Input">+</button>
                </div>

                <div className="node-center" onMouseDown={stopPropagation}>
                    {/* Extra content injected by the plugin */}
                    {children}

                    {/* Code section */}
                    <div className="node-section">
                        <div className="section-toggle nodrag" onClick={toggleCode}>
                            <span>Code</span>
                            <span>{isCodeOpen ? '▼' : '▶'}</span>
                        </div>
                        {isCodeOpen && (
                            <div className="nodrag node-content-container" onMouseDown={stopPropagation}>
                                <CodeMirror
                                    value={data.code || ''}
                                    height="auto"
                                    extensions={[python()]}
                                    onChange={handleCodeChange}
                                    theme={vscodeDark}
                                    basicSetup={{
                                        lineNumbers: true,
                                        foldGutter: true,
                                        dropCursor: true,
                                        allowMultipleSelections: true,
                                        indentOnInput: true,
                                        bracketMatching: true,
                                        closeBrackets: true,
                                        autocompletion: true,
                                        highlightActiveLine: true,
                                        highlightSelectionMatches: true,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Logs / Error section */}
                    {(data.logs || data.error) && (
                        <div className="node-section">
                            <div
                                className="section-toggle nodrag"
                                onClick={toggleLogs}
                                style={{ color: data.error ? '#ff6b6b' : 'inherit' }}
                            >
                                <span>{data.error ? 'Error' : 'Output Logs'}</span>
                                <span>{isLogsOpen ? '▼' : '▶'}</span>
                            </div>
                            {isLogsOpen && (
                                <>
                                    {data.logs && !data.error && (
                                        <div className="node-output nodrag" onMouseDown={stopPropagation}>
                                            <div className="node-content-container" style={{ maxHeight: '150px', resize: 'vertical', overflow: 'auto' }}>
                                                <pre>{data.logs}</pre>
                                            </div>
                                        </div>
                                    )}
                                    {data.error && (
                                        <div className="node-error nodrag" onMouseDown={stopPropagation}>
                                            <div className="node-content-container" style={{ maxHeight: '150px', resize: 'vertical', overflow: 'auto', borderColor: '#ff4444' }}>
                                                <pre style={{ color: '#ff6b6b' }}>{data.error}</pre>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="node-outputs">
                    {outputHandles}
                    <button className="add-io-btn" onClick={addOutput} title="Add Output">+</button>
                </div>
            </div>
        </NodeShell>
    );
};

export { CodeNodeHeader };
export default BaseCodeNode;
