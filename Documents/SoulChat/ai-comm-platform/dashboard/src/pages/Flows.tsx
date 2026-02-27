import {
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  type OnConnect,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlow, useFlowActions } from '../hooks/useFlows';
import type { Flow, FlowTriggerType } from '../lib/types';
import toast from 'react-hot-toast';

import {
  type FlowNodeData,
  type FlowNodeType,
  type ContentBlock,
  type MessageButton,
  type TemplateDefinition,
  isTriggerNode,
  createNodeData,
} from '../components/flows/flow-types';
import { TriggerNode } from '../components/flows/nodes/TriggerNode';
import { MessageNode } from '../components/flows/nodes/MessageNode';
import { AiAgentNode } from '../components/flows/nodes/AiAgentNode';
import { ActionNode } from '../components/flows/nodes/ActionNode';
import { ConditionNode } from '../components/flows/nodes/ConditionNode';
import { WaitNode } from '../components/flows/nodes/WaitNode';
import { DelayNode } from '../components/flows/nodes/DelayNode';
import { CheckWindowNode } from '../components/flows/nodes/CheckWindowNode';
import { FlowSidebar } from '../components/flows/FlowSidebar';
import { FlowToolbar } from '../components/flows/FlowToolbar';
import { FlowCanvas } from '../components/flows/FlowCanvas';
import { FlowList } from '../components/flows/FlowList';

/* ─────────────────────── Node Types Registry ─────────────────────── */

const nodeTypes: NodeTypes = {
  // Triggers
  message_received: TriggerNode,
  new_contact: TriggerNode,
  keyword: TriggerNode,
  webhook_trigger: TriggerNode,
  schedule: TriggerNode,
  manual: TriggerNode,
  // WhatsApp
  send_message: MessageNode,
  send_template: ActionNode,
  check_window: CheckWindowNode,
  // AI
  ai_agent: AiAgentNode,
  // Actions
  tag_update: ActionNode,
  http_request: ActionNode,
  transfer_agent: ActionNode,
  human_handoff: ActionNode,
  close_conversation: ActionNode,
  // Logic
  condition: ConditionNode,
  wait_reply: WaitNode,
  delay: DelayNode,
  // Backward-compat aliases
  trigger: TriggerNode,
  close: ActionNode,
};

/* ─────────────────────── Flow Editor ─────────────────────── */

function FlowEditor({
  flow,
  onBack,
}: {
  flow: Flow | null;
  onBack: () => void;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [flowName, setFlowName] = useState(flow?.name ?? 'אוטומציה חדשה');
  const { update, remove, activate, deactivate, test } = useFlowActions();

  const initialNodes = useMemo(() => {
    if (!flow?.nodes?.length) return [] as Node<FlowNodeData>[];
    return flow.nodes as Node<FlowNodeData>[];
  }, [flow]);

  const initialEdges = useMemo(() => {
    if (!flow?.edges?.length) return [] as Edge[];
    return flow.edges as Edge[];
  }, [flow]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  /* ── Connection handler with edge colors/labels ── */
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      let edgeStyle = {};
      let label: string | undefined;
      const sourceHandle = params.sourceHandle;

      if (sourceHandle === 'yes' || sourceHandle === 'open') {
        edgeStyle = { stroke: '#22c55e', strokeWidth: 2 };
        label = sourceHandle === 'yes' ? 'כן' : 'פתוח';
      } else if (sourceHandle === 'no' || sourceHandle === 'closed') {
        edgeStyle = { stroke: '#ef4444', strokeWidth: 2 };
        label = sourceHandle === 'no' ? 'לא' : 'סגור';
      } else if (sourceNode) {
        edgeStyle = { stroke: (sourceNode.data as FlowNodeData).color };
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: edgeStyle,
            ...(label ? { label } : {}),
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds,
        ),
      );
    },
    [nodes, setEdges],
  );

  /* ── Add node from sidebar click ── */
  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      const data = createNodeData(type);

      // Place new node below the last node or at a default position
      let y = 100;
      if (nodes.length > 0) {
        const maxY = Math.max(...nodes.map((n) => n.position.y));
        y = maxY + 150;
      }

      const newNode: Node<FlowNodeData> = {
        id: `${type}_${Date.now()}`,
        type,
        position: { x: 250, y },
        data,
      };

      setNodes((nds) => [...nds, newNode]);

      // Auto-select the new node for editing
      setSelectedNode(newNode);
    },
    [nodes, setNodes],
  );

  /* ── Node click → select for sidebar editing ── */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node as Node<FlowNodeData>);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* ── Config change from sidebar editor ── */
  const handleNodeConfigChange = useCallback(
    (config: Record<string, unknown>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, config } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, config } } : null,
      );
    },
    [selectedNode, setNodes],
  );

  /* ── Content blocks change (send_message) ── */
  const handleContentBlocksChange = useCallback(
    (blocks: ContentBlock[]) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, contentBlocks: blocks } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, contentBlocks: blocks } } : null,
      );
    },
    [selectedNode, setNodes],
  );

  /* ── Buttons change (send_message) ── */
  const handleButtonsChange = useCallback(
    (buttons: MessageButton[]) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, buttons } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, buttons } } : null,
      );
    },
    [selectedNode, setNodes],
  );

  /* ── Save ── */
  const handleSave = useCallback(() => {
    if (!flow) return;
    const triggerNode = nodes.find((n) => {
      const d = n.data as FlowNodeData;
      return isTriggerNode(d.nodeType);
    });
    const triggerConfig = triggerNode
      ? ((triggerNode.data as FlowNodeData).config as Record<string, unknown>)
      : {};
    const triggerType = (triggerConfig.triggerType as FlowTriggerType) ?? flow.triggerType;

    update.mutate(
      {
        id: flow.id,
        name: flowName,
        triggerType,
        triggerConfig,
        nodes: nodes as unknown[],
        edges: edges as unknown[],
      },
      {
        onSuccess: () => toast.success('נשמר בהצלחה'),
        onError: () => toast.error('שגיאה בשמירה'),
      },
    );
  }, [flow, nodes, edges, flowName, update]);

  const handleToggleActive = useCallback(() => {
    if (!flow) return;
    if (flow.active) {
      deactivate.mutate(flow.id, {
        onSuccess: () => toast.success('האוטומציה כובתה'),
      });
    } else {
      activate.mutate(flow.id, {
        onSuccess: () => toast.success('האוטומציה הופעלה'),
      });
    }
  }, [flow, activate, deactivate]);

  const handleTest = useCallback(() => {
    if (!flow) return;
    test.mutate(flow.id, {
      onSuccess: () => toast.success('הבדיקה נשלחה'),
      onError: () => toast.error('שגיאה בבדיקה'),
    });
  }, [flow, test]);

  const handleDelete = useCallback(() => {
    if (!flow) return;
    if (!confirm('למחוק את האוטומציה?')) return;
    remove.mutate(flow.id, {
      onSuccess: () => {
        toast.success('האוטומציה נמחקה');
        onBack();
      },
    });
  }, [flow, remove, onBack]);

  return (
    <div className="h-full flex flex-col">
      <FlowToolbar
        flowName={flowName}
        onFlowNameChange={setFlowName}
        onBack={onBack}
        onSave={handleSave}
        onToggleActive={handleToggleActive}
        onTest={handleTest}
        onDelete={handleDelete}
        isActive={flow?.active ?? false}
        isSaving={update.isPending}
        isTesting={test.isPending}
        hasFlow={!!flow}
      />

      {/* ManyChat layout: Canvas LEFT (70%) + Sidebar RIGHT (30%) */}
      <div className="flex-1 flex overflow-hidden">
        <FlowCanvas
          ref={reactFlowWrapper}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
        />

        <FlowSidebar
          selectedNode={selectedNode}
          onDeselectNode={() => setSelectedNode(null)}
          onAddNode={handleAddNode}
          onNodeConfigChange={handleNodeConfigChange}
          onContentBlocksChange={handleContentBlocksChange}
          onButtonsChange={handleButtonsChange}
        />
      </div>
    </div>
  );
}

/* ─────────────────────── Main Page Component ─────────────────────── */

export function FlowBuilder() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const { data: flowData } = useFlow(editingFlowId);
  const { create } = useFlowActions();

  const handleSelectFlow = useCallback((flow: Flow) => {
    setEditingFlowId(flow.id);
    setView('editor');
  }, []);

  const handleCreateFlow = useCallback(
    (template?: TemplateDefinition) => {
      const base: Partial<Flow> = {
        name: template?.name ?? 'אוטומציה חדשה',
        description: template?.description ?? null,
        triggerType: template?.triggerType ?? 'message_received',
        triggerConfig: {},
        nodes: (template?.nodes ?? []) as unknown[],
        edges: (template?.edges ?? []) as unknown[],
        active: false,
      };

      create.mutate(base, {
        onSuccess: (newFlow) => {
          toast.success('האוטומציה נוצרה');
          setEditingFlowId(newFlow.id);
          setView('editor');
        },
        onError: () => toast.error('שגיאה ביצירת אוטומציה'),
      });
    },
    [create],
  );

  const handleBack = useCallback(() => {
    setEditingFlowId(null);
    setView('list');
  }, []);

  if (view === 'editor') {
    return (
      <div className="h-full">
        <FlowEditor flow={flowData ?? null} onBack={handleBack} />
      </div>
    );
  }

  return <FlowList onSelectFlow={handleSelectFlow} onCreateFlow={handleCreateFlow} />;
}

// Backward-compatible export for App.tsx
export { FlowBuilder as Flows };
