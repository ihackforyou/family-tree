import { useCallback, useEffect, useMemo } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow, useNodesState, useReactFlow,
  type Connection, type Node,
} from '@xyflow/react';
import { computeRelations, dualLabel } from '../engine/relations';
import { layoutNetwork, layoutTree, CARD_H, ROW_H } from '../engine/layout';
import { isCriminal, socialLabel } from '../engine/social';
import type { SocialType } from '../types';
import { useStore } from '../store';
import { PersonNode, type PersonFlowNode } from './PersonNode';
import { EdgeMarkers, KinEdge, LaneNode, RowLabelNode, type KinFlowEdge, type KinVariant } from './FlowParts';
import { ROLE_META } from './meta';

const nodeTypes = { person: PersonNode, lane: LaneNode, rowlabel: RowLabelNode };
const edgeTypes = { kin: KinEdge };

export function Canvas() {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const view = useStore((s) => s.view);
  const collapsed = useStore((s) => s.collapsed);
  const selectedId = useStore((s) => s.selectedId);
  const pathFrom = useStore((s) => s.pathFrom);
  const pathTo = useStore((s) => s.pathTo);
  const roleFilter = useStore((s) => s.roleFilter);
  const select = useStore((s) => s.select);
  const setFocus = useStore((s) => s.setFocus);
  const setDialog = useStore((s) => s.setDialog);
  const toggleRole = useStore((s) => s.toggleRole);
  const theme = useStore((s) => s.theme);
  const { fitView, getZoom, setCenter } = useReactFlow();

  const focusId = cf.focusId && cf.persons[cf.focusId] ? cf.focusId : Object.keys(cf.persons)[0];

  const rel = useMemo(
    () => (focusId ? computeRelations(cf, focusId) : new Map()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cf.persons, cf.edges, focusId],
  );

  const path = useMemo(() => {
    if (!pathFrom || !pathTo) return null;
    const info = computeRelations(cf, pathFrom).get(pathTo);
    if (!info || info.side === 'unlinked') return null;
    const nodes = new Set<string>([pathFrom, ...info.steps.map((s) => s.to)]);
    const edges = new Set<string>(info.steps.map((s) => s.edgeId).filter(Boolean) as string[]);
    // derived sibling steps go through the shared parent: light those parent edges too
    for (const s of info.steps) {
      if (s.kind === 'sibling' && !s.edgeId) {
        for (const e of Object.values(cf.edges)) {
          if (e.kind === 'parent' && (e.to === s.from || e.to === s.to)) {
            const other = e.to === s.from ? s.to : s.from;
            if (Object.values(cf.edges).some((x) => x.kind === 'parent' && x.from === e.from && x.to === other)) edges.add(e.id);
          }
        }
      }
    }
    return { nodes, edges };
  }, [cf, pathFrom, pathTo]);

  const computed = useMemo(() => {
    const nodes: Node[] = [];
    let positions: Map<string, { x: number; y: number }>;
    if (view === 'tree') {
      const lay = layoutTree(rel, collapsed);
      positions = lay.positions;
      for (const lane of lay.lanes) {
        nodes.push({
          id: `lane:${lane.side}`, type: 'lane', position: { x: lane.x, y: lane.y },
          data: { side: lane.side, count: lane.count, collapsed: lane.collapsed },
          style: { width: lane.w, height: lane.h }, draggable: false, selectable: false, focusable: false, zIndex: -10,
        });
      }
      for (const row of lay.rows) {
        nodes.push({
          id: `row:${row.gen}`, type: 'rowlabel', position: { x: -84, y: row.y + ROW_H / 2 - 22 },
          data: { gen: row.gen }, draggable: false, selectable: false, focusable: false, zIndex: -5,
        });
      }
    } else {
      positions = layoutNetwork(rel);
    }

    for (const p of Object.values(cf.persons)) {
      const pos = positions.get(p.id);
      if (!pos) continue;
      const info = rel.get(p.id);
      const { primary, secondary } = dualLabel(info, lang);
      const dimByRole = roleFilter.size > 0 && !roleFilter.has(p.role);
      const dimByPath = !!path && !path.nodes.has(p.id);
      const n: PersonFlowNode = {
        id: p.id,
        type: 'person',
        position: pos,
        selected: p.id === selectedId,
        data: {
          person: p,
          primary,
          secondary,
          isFocus: p.id === focusId,
          dim: dimByRole || dimByPath,
          onPath: !!path && path.nodes.has(p.id),
        },
        style: { width: 220, height: CARD_H },
      };
      nodes.push(n);
    }

    const shown = new Set(nodes.map((n) => n.id));
    const posOf = (id: string) => positions.get(id)!;
    const edges: KinFlowEdge[] = [];
    for (const e of Object.values(cf.edges)) {
      if (!shown.has(e.from) || !shown.has(e.to)) continue;
      let variant: KinVariant;
      let sourceHandle: string;
      let targetHandle: string;
      let label: string | undefined;
      const a = posOf(e.from);
      const b = posOf(e.to);
      const horiz = () => (a.x <= b.x ? (['r', 'l-in'] as const) : (['l', 'r-in'] as const));
      switch (e.kind) {
        case 'parent':
          variant = e.subtype && e.subtype !== 'biological' ? 'adopt' : 'blood';
          [sourceHandle, targetHandle] = ['b', 't-in'];
          if (variant === 'adopt') label = e.subtype === 'step' ? 'सौतेला' : e.subtype === 'adoptive' ? 'गोद' : e.subtype === 'guardian' ? 'संरक्षक' : 'पालक';
          break;
        case 'spouse':
          variant = e.subtype === 'divorced' || e.subtype === 'separated' ? 'divorced' : e.subtype === 'live-in' ? 'livein' : 'marriage';
          [sourceHandle, targetHandle] = Math.abs(a.y - b.y) < 10 ? horiz() : ['b', 't-in'];
          if (e.subtype === 'divorced') label = 'तलाक';
          else if (e.subtype === 'separated') label = 'अलग';
          else if (e.subtype === 'live-in') label = 'लिव-इन';
          else if (e.subtype === 'widowed') label = 'विधुर/विधवा';
          break;
        case 'sibling':
          variant = e.subtype === 'fictive' ? 'adopt' : 'sibling';
          [sourceHandle, targetHandle] = Math.abs(a.y - b.y) < 10 ? horiz() : ['t', 't-in'];
          if (e.subtype === 'fictive') label = 'मुँहबोला';
          break;
        default:
          variant = isCriminal(e.subtype as SocialType) ? 'criminal' : 'social';
          [sourceHandle, targetHandle] = horiz();
          label = socialLabel((e.subtype as SocialType) ?? 'other', lang === 'hi' ? 'hi' : 'en');
      }
      const hl = !!path && path.edges.has(e.id);
      edges.push({
        id: e.id, source: e.from, target: e.to, type: 'kin', sourceHandle, targetHandle,
        data: {
          variant, confidence: e.confidence, highlight: hl, dim: !!path && !hl,
          floating: view === 'network', label,
        },
        zIndex: hl ? 5 : 0,
      });
    }
    return { nodes, edges };
  }, [cf, rel, view, collapsed, lang, selectedId, roleFilter, path, focusId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computed.nodes);
  useEffect(() => setNodes(computed.nodes), [computed.nodes, setNodes]);

  // Fit everything if cards stay readable; otherwise zoom in on the focus person.
  const focusPos = computed.nodes.find((n) => n.id === focusId)?.position;
  const fx = focusPos?.x;
  const fy = focusPos?.y;
  useEffect(() => {
    const t = setTimeout(async () => {
      await fitView({ padding: 0.1, maxZoom: 1 });
      if (getZoom() < 0.55 && fx != null && fy != null) {
        await setCenter(fx + 110, fy + 46, { zoom: 0.85, duration: 450 });
      }
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.id, focusId, view, collapsed]);

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target && c.source !== c.target) setDialog({ type: 'link', aId: c.target, bId: c.source });
  }, [setDialog]);

  return (
    <div className="canvas" data-testid="canvas">
      <EdgeMarkers />
      <ReactFlow
        nodes={nodes}
        edges={computed.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, n) => n.type === 'person' && select(n.id)}
        onNodeDoubleClick={(_, n) => n.type === 'person' && setFocus(n.id)}
        onPaneClick={() => select(null)}
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        colorMode={theme}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--bg-grid)" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === 'person' ? ROLE_META[(n.data as { person: { role: keyof typeof ROLE_META } }).person.role].color : 'transparent')}
          nodeStrokeWidth={0}
          maskColor={theme === 'dark' ? 'rgba(11,18,32,0.55)' : 'rgba(226,232,240,0.6)'}
          style={{ width: 200, height: 140 }}
        />
        <Controls showInteractive={false} position="bottom-right" style={{ marginBottom: 160 }} />
      </ReactFlow>

      <div className="filters">
        {(['suspect', 'accused', 'witness', 'victim', 'associate', 'relative'] as const).map((r) => (
          <button key={r} className={`chip ${roleFilter.has(r) ? 'on' : ''}`} onClick={() => toggleRole(r)}>
            <span className="sw" style={{ background: ROLE_META[r].color }} />
            {ROLE_META[r].hi}
          </button>
        ))}
      </div>

      <div className="legend">
        <LegendRow label="खून का रिश्ता"><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="1.6" /></LegendRow>
        <LegendRow label="शादी">
          <line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="5" />
          <line x1="2" y1="6" x2="30" y2="6" stroke="var(--surface)" strokeWidth="2" />
        </LegendRow>
        <LegendRow label="तलाक / अलग"><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="2" strokeDasharray="7 5" /></LegendRow>
        <LegendRow label="गोद / सौतेला / मुँहबोला"><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="1.6" strokeDasharray="2 4" /></LegendRow>
        <LegendRow label="दोस्त / सहयोगी"><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge-social)" strokeWidth="1" /></LegendRow>
        <LegendRow label="Criminal link"><line x1="2" y1="6" x2="30" y2="6" stroke="var(--danger)" strokeWidth="2" /></LegendRow>
        <div className="muted" style={{ fontSize: 11 }}>Double-click = उस व्यक्ति को focus बनाएँ</div>
      </div>
    </div>
  );
}

function LegendRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <svg width="32" height="12">{children}</svg>
      {label}
    </div>
  );
}
