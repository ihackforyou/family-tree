import { useCallback, useEffect, useMemo } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, MiniMap, ReactFlow, useNodesState, useReactFlow,
  type Connection, type Node,
} from '@xyflow/react';
import { computeRelations, dualLabel, relationLabel, type RelationInfo } from '../engine/relations';
import { layoutNetwork, layoutTree, ROW_H } from '../engine/layout';
import { CARD_SIZES, junctionPoint, type ChartLayout } from '../engine/chart';
import { layoutChartBest } from '../engine/chartBest';
import { isCriminal, socialLabel } from '../engine/social';
import type { SocialType } from '../types';
import { useStore } from '../store';
import { PersonNode, type PersonFlowNode } from './PersonNode';
import { EdgeMarkers, JunctionNode, KinEdge, LaneNode, RowLabelNode, type KinFlowEdge, type KinVariant } from './FlowParts';
import { ROLE_META } from './meta';
import { useT } from '../i18n/useT';

const nodeTypes = { person: PersonNode, lane: LaneNode, rowlabel: RowLabelNode, junction: JunctionNode };
const edgeTypes = { kin: KinEdge };

export function Canvas() {
  const cf = useStore((s) => s.cf)!;
  const lang = useStore((s) => s.lang);
  const t = useT();
  const view = useStore((s) => s.view);
  const collapsed = useStore((s) => s.collapsed);
  const selectedId = useStore((s) => s.selectedId);
  const pathFrom = useStore((s) => s.pathFrom);
  const pathTo = useStore((s) => s.pathTo);
  const roleFilter = useStore((s) => s.roleFilter);
  const select = useStore((s) => s.select);
  const setFocus = useStore((s) => s.setFocus);
  const setDialog = useStore((s) => s.setDialog);

  const theme = useStore((s) => s.theme);
  const cardSize = useStore((s) => s.cardSize);
  const lineStyle = useStore((s) => s.lineStyle);
  const allLabels = useStore((s) => s.allLabels);
  const moveCard = useStore((s) => s.moveCard);
  const size = CARD_SIZES[cardSize];
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

  // The chart search is the costly part: redo it only when people, links, focus or card size change.
  const chartLayout = useMemo(
    () => (view === 'chart' ? layoutChartBest(cf, rel, cardSize) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, cf.persons, cf.edges, rel, cardSize],
  );
  const manualMoved = view !== 'table' && !!cf.layout?.[view] && Object.keys(cf.layout[view]!).length > 0;

  const computed = useMemo(() => {
    const nodes: Node[] = [];
    let positions: Map<string, { x: number; y: number }>;
    let chart: ChartLayout | null = null;
    if (view === 'chart') {
      chart = chartLayout!;
      positions = chart.positions;
    } else if (view === 'tree') {
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

    // Cards the user dragged keep their place in this view.
    const manual = view === 'table' ? undefined : cf.layout?.[view];
    if (manual) {
      positions = new Map(positions);
      for (const [id, pos] of Object.entries(manual)) if (positions.has(id)) positions.set(id, pos);
    }
    if (chart) {
      for (const j of chart.junctions) {
        const a = positions.get(j.parents[0]);
        const b = positions.get(j.parents[1]);
        if (!a || !b) continue;
        const pt = junctionPoint(a, b, size.w, size.h);
        nodes.push({
          id: j.id, type: 'junction', position: { x: pt.x - 1, y: pt.y - 1 }, data: {},
          style: { width: 2, height: 2 }, draggable: false, selectable: false, focusable: false, zIndex: -1,
        });
      }
    }

    // Associates are labelled by how they connect ("Account provider · Arjun") instead of a long path from the focus.
    const relCache = new Map<string, Map<string, RelationInfo>>();
    const relFrom = (id: string) => relCache.get(id) ?? relCache.set(id, computeRelations(cf, id)).get(id)!;
    const first = (id: string) => (cf.persons[id]?.isGhost ? t('common.unknown') : (cf.persons[id]?.name ?? '').split(' ')[0]);
    const socialLang = lang === 'hi' ? 'hi' : 'en';
    const nonKinLabel = (pid: string, info: RelationInfo | undefined): string | null => {
      if (!info || info.kinship || info.side === 'unlinked' || info.side === 'self') return null;
      let k = -1;
      info.steps.forEach((st, i) => { if (st.kind === 'social') k = i; });
      if (k < 0) return null;
      const st = info.steps[k];
      if (k === info.steps.length - 1) return `${socialLabel(st.socialType ?? 'other', socialLang)} · ${first(st.from)}`;
      const anchor = st.to;
      return `${relationLabel(relFrom(anchor).get(pid), lang)} · ${first(anchor)}`;
    };

    // Clicking a person lights up their trail: everyone directly linked (parents, children,
    // spouse, siblings, associates) and those lines; everything else fades back.
    const trail = selectedId && !path && cf.persons[selectedId] ? new Set<string>([selectedId]) : null;
    if (trail && selectedId) {
      const parentsOfSel = new Set<string>();
      for (const e of Object.values(cf.edges)) {
        if (e.from === selectedId) trail.add(e.to);
        if (e.to === selectedId) { trail.add(e.from); if (e.kind === 'parent') parentsOfSel.add(e.from); }
      }
      for (const e of Object.values(cf.edges)) if (e.kind === 'parent' && parentsOfSel.has(e.from)) trail.add(e.to);
    }
    for (const p of Object.values(cf.persons)) {
      const pos = positions.get(p.id);
      if (!pos) continue;
      const info = rel.get(p.id);
      const dual = dualLabel(info, lang);
      const assoc = nonKinLabel(p.id, info);
      const dimByRole = roleFilter.size > 0 && !roleFilter.has(p.role);
      const dimByPath = !!path && !path.nodes.has(p.id);
      const n: PersonFlowNode = {
        id: p.id,
        type: 'person',
        position: pos,
        selected: p.id === selectedId,
        data: {
          person: p,
          primary: assoc ?? dual.primary,
          secondary: assoc ? dual.primary : dual.secondary,
          isFocus: p.id === focusId,
          dim: dimByRole || dimByPath || (!!trail && !trail.has(p.id)),
          onPath: (!!path && path.nodes.has(p.id)) || (!!trail && trail.has(p.id) && p.id !== selectedId),
        },
        style: { width: size.w, height: size.h },
      };
      nodes.push(n);
    }

    const shown = new Set(nodes.map((n) => n.id));
    const edges: KinFlowEdge[] = [];
    const drawnFromJunction = new Set<string>();
    const touchesSelection = (a: string, b: string) => !!selectedId && (a === selectedId || b === selectedId);
    for (const e of Object.values(cf.edges)) {
      if (!shown.has(e.from) || !shown.has(e.to)) continue;
      const hl = !!path && path.edges.has(e.id);
      const showLabel = allLabels || hl || touchesSelection(e.from, e.to);
      if (chart && e.kind === 'parent') {
        const sources = chart.childSource.get(e.to) ?? [];
        const viaJunction = sources.find((src) => src.startsWith('j:') && src.split(':').includes(e.from));
        if (viaJunction && shown.has(viaJunction)) {
          const key = `${viaJunction}>${e.to}`;
          if (drawnFromJunction.has(key)) continue;
          drawnFromJunction.add(key);
          const onTrail = !!trail && !!selectedId && (viaJunction.split(':').includes(selectedId) || e.to === selectedId || (chart.childSource.get(selectedId) ?? []).includes(viaJunction));
          edges.push({
            id: key, source: viaJunction, target: e.to, type: 'kin',
            data: {
              variant: e.subtype && e.subtype !== 'biological' ? 'adopt' : 'blood', confidence: e.confidence,
              highlight: hl || onTrail, dim: (!!path && !hl) || (!!trail && !onTrail), floating: false, lineStyle, showLabel: false,
              route: chart && !manualMoved ? chart.routes.get(key) : undefined,
            },
            zIndex: hl || onTrail ? 5 : 0,
          });
          continue;
        }
      }
      let variant: KinVariant;
      let label: string | undefined;
      switch (e.kind) {
        case 'parent':
          variant = e.subtype && e.subtype !== 'biological' ? 'adopt' : 'blood';
          if (variant === 'adopt') label = t(e.subtype === 'step' ? 'sub.step' : e.subtype === 'adoptive' ? 'sub.adoptive' : e.subtype === 'guardian' ? 'line.guardian' : 'sub.foster');
          break;
        case 'spouse':
          variant = e.subtype === 'divorced' || e.subtype === 'separated' ? 'divorced' : e.subtype === 'live-in' ? 'livein' : 'marriage';
          if (e.subtype === 'divorced') label = t('sub.divorced');
          else if (e.subtype === 'separated') label = t('sub.separated');
          else if (e.subtype === 'live-in') label = t('sub.livein');
          else if (e.subtype === 'widowed') label = t('sub.widowed');
          break;
        case 'sibling':
          variant = e.subtype === 'fictive' ? 'adopt' : 'sibling';
          if (e.subtype === 'fictive') label = t('line.fictive');
          break;
        default:
          variant = isCriminal(e.subtype as SocialType) ? 'criminal' : 'social';
          label = socialLabel((e.subtype as SocialType) ?? 'other', socialLang);
      }
      edges.push({
        id: e.id, source: e.from, target: e.to, type: 'kin',
        data: {
          variant, confidence: e.confidence, highlight: hl || (!!trail && touchesSelection(e.from, e.to)), dim: (!!path && !hl) || (!!trail && !touchesSelection(e.from, e.to)),
          floating: false, label, lineStyle, showLabel: showLabel || (e.kind !== 'social' && !!label),
          route: chart && !manualMoved ? chart.routes.get(e.id) : undefined,
        },
        zIndex: hl || (!!trail && touchesSelection(e.from, e.to)) ? 5 : e.kind === 'social' ? 1 : 0,
      });
    }
    return { nodes, edges };
  }, [cf, rel, view, collapsed, lang, selectedId, roleFilter, path, focusId, size, lineStyle, allLabels, t, chartLayout, manualMoved]);

  const legend = useStore((s) => s.legend);
  const minimap = useStore((s) => s.minimap);
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
        await setCenter(fx + size.w / 2, fy + size.h / 2, { zoom: 0.85, duration: 450 });
      }
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.id, focusId, view, collapsed, cardSize]);

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
        onNodeDragStop={(_, n) => { if (n.type === 'person' && view !== 'table') moveCard(view, n.id, n.position); }}
        onNodeDoubleClick={(_, n) => n.type === 'person' && setFocus(n.id)}
        onPaneClick={() => select(null)}
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        colorMode={theme}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--bg-grid)" />
        {minimap && <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === 'person' ? ROLE_META[(n.data as { person: { role: keyof typeof ROLE_META } }).person.role].color : 'transparent')}
          nodeStrokeWidth={0}
          maskColor={theme === 'dark' ? 'rgba(24,24,24,0.6)' : 'rgba(240,240,240,0.65)'}
          style={{ width: 168, height: 112 }}
        />}
      </ReactFlow>

      {legend && <div className="legend">
        <LegendRow label={t('legend.blood')}><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="1.6" /></LegendRow>
        <LegendRow label={t('legend.marriage')}>
          <line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="5" />
          <line x1="2" y1="6" x2="30" y2="6" stroke="var(--surface)" strokeWidth="2" />
        </LegendRow>
        <LegendRow label={t('legend.divorced')}><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="2" strokeDasharray="7 5" /></LegendRow>
        <LegendRow label={t('legend.adopt')}><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge)" strokeWidth="1.6" strokeDasharray="2 4" /></LegendRow>
        <LegendRow label={t('legend.social')}><line x1="2" y1="6" x2="30" y2="6" stroke="var(--edge-social)" strokeWidth="1" /></LegendRow>
        <LegendRow label={t('legend.criminal')}><line x1="2" y1="6" x2="30" y2="6" stroke="var(--danger)" strokeWidth="2" /></LegendRow>
        <div className="muted" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{t('legend.dblClick')}</div>
      </div>}
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
