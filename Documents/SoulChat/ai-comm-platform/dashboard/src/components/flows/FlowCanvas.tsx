import { forwardRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MarkerType,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { FlowNodeData } from './flow-types';

/* ─── Props ─── */

export interface FlowCanvasProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onInit: (instance: ReactFlowInstance) => void;
  onNodeClick: (e: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onAddNodeBetween?: (sourceId: string, targetId: string, position: { x: number; y: number }) => void;
  nodeTypes: NodeTypes;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

/* ─── Default edge options ─── */

const defaultEdgeOptions = {
  animated: true,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  style: { stroke: '#94a3b8', strokeWidth: 1.5 },
};

/* ─── Component ─── */

export const FlowCanvas = forwardRef<HTMLDivElement, FlowCanvasProps>(
  function FlowCanvas(
    {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onInit,
      onNodeClick,
      onPaneClick,
      nodeTypes,
      onDrop,
      onDragOver,
    },
    ref,
  ) {
    return (
      <div className="flex-1 h-full" ref={ref}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineType={ConnectionLineType.SmoothStep}
          deleteKeyCode="Delete"
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="bg-gray-50"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
          <Controls
            position="bottom-left"
            className="!bg-white !border-gray-200 !shadow-md !rounded-lg"
          />
          <MiniMap
            position="bottom-left"
            style={{ marginBottom: 100 }}
            nodeColor={(n) => {
              const d = n.data as FlowNodeData | undefined;
              return d?.color ?? '#ccc';
            }}
            className="!bg-white !border-gray-200 !shadow-md !rounded-lg"
            maskColor="rgba(0,0,0,0.08)"
          />
        </ReactFlow>
      </div>
    );
  },
);
