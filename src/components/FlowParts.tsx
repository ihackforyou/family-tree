import { memo } from 'react';
import {
  BaseEdge, Handle, Position, getBezierPath, getSmoothStepPath, getStraightPath, useInternalNode, type EdgeProps, type Edge as FlowEdge, type Node, type NodeProps,
} from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Side } from '../engine/relations';
import { useStore } from '../store';
import { SIDE_META, genLabel, genName } from './meta';
import { pick, pickOther } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';

// ---------------------------------------------------------------- lanes

export type LaneData = { side: Side; count: number; collapsed: boolean };
export type LaneFlowNode = Node<LaneData, 'lane'>;

function LaneNodeInner({ data }: NodeProps<LaneFlowNode>) {
  const toggle = useStore((s) => s.toggleLane);
  const t = useT();
  const ui = useUiLang();
  const meta = SIDE_META[data.side];
  const name = pick(meta, ui);
  const canCollapse = data.side !== 'core';
  return (
    <div className={`lane lane-${data.side}`}>
      <div className="lane-head">
        <span title={pickOther(meta, ui)}>{data.collapsed ? name.split(' ')[0] : name}</span>
        <span className="count">{data.collapsed ? `+${data.count}` : data.count}</span>
        {canCollapse && (
          <button className="nodrag" title={data.collapsed ? t('lane.expand') : t('lane.collapse')} aria-label={data.collapsed ? t('lane.expand') : t('lane.collapse')} onClick={() => toggle(data.side)}>
            {data.collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}
export const LaneNode = memo(LaneNodeInner);

export type RowData = { gen: number };
export type RowFlowNode = Node<RowData, 'rowlabel'>;

function RowLabelInner({ data }: NodeProps<RowFlowNode>) {
  const ui = useUiLang();
  return (
    <div className={`row-label ${data.gen === 0 ? 'zero' : ''}`}>
      <span className="g">{genLabel(data.gen)}</span>
      <span className="n">{genName(data.gen, ui)}</span>
    </div>
  );
}
export const RowLabelNode = memo(RowLabelInner);

// ---------------------------------------------------------------- family chart helpers

/** Invisible point on a couple's marriage line; their children's lines start here. */
export type JunctionFlowNode = Node<Record<string, never>, 'junction'>;
function JunctionInner() {
  return (
    <div className="junction">
      <Handle id="b" type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
export const JunctionNode = memo(JunctionInner);

/** Background block for associates / people not linked by family in the chart view. */
export type SideBlockFlowNode = Node<{ count: number }, 'sideblock'>;
function SideBlockInner({ data }: NodeProps<SideBlockFlowNode>) {
  const ui = useUiLang();
  return (
    <div className="side-block">
      <div className="lane-head">
        <span>{pick(SIDE_META.associate, ui)}</span>
        <span className="count">{data.count}</span>
      </div>
    </div>
  );
}
export const SideBlockNode = memo(SideBlockInner);

// ---------------------------------------------------------------- edges

export type KinVariant = 'blood' | 'adopt' | 'marriage' | 'divorced' | 'livein' | 'sibling' | 'social' | 'criminal';
export type KinEdgeData = {
  variant: KinVariant;
  confidence: 'confirmed' | 'probable' | 'suspected';
  highlight: boolean;
  dim: boolean;
  /** legacy: straight centre-to-centre line */
  floating: boolean;
  label?: string;
  lineStyle?: 'step' | 'curve' | 'straight';
  showLabel?: boolean;
};
export type KinFlowEdge = FlowEdge<KinEdgeData, 'kin'>;

type Rect = { x: number; y: number; w: number; h: number };
function rectOf(n: ReturnType<typeof useInternalNode>): Rect | null {
  if (!n) return null;
  return {
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
    w: n.measured?.width ?? 2,
    h: n.measured?.height ?? 2,
  };
}

/**
 * Picks the facing sides of two cards from where they actually are, so lines stay tidy
 * after cards are dragged: mostly-vertical pairs join bottom → top, side-by-side pairs join right → left.
 */
function facingSides(a: Rect, b: Rect) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const gapY = b.y > a.y + a.h ? b.y - (a.y + a.h) : a.y > b.y + b.h ? a.y - (b.y + b.h) : 0;
  const vertical = gapY > 12 && (overlapX || Math.abs(bc.y - ac.y) > Math.abs(bc.x - ac.x) * 0.45);
  if (vertical) {
    const down = bc.y > ac.y;
    return {
      sx: ac.x, sy: down ? a.y + a.h : a.y, sp: down ? Position.Bottom : Position.Top,
      tx: bc.x, ty: down ? b.y : b.y + b.h, tp: down ? Position.Top : Position.Bottom,
    };
  }
  const right = bc.x > ac.x;
  return {
    sx: right ? a.x + a.w : a.x, sy: ac.y, sp: right ? Position.Right : Position.Left,
    tx: right ? b.x : b.x + b.w, ty: bc.y, tp: right ? Position.Left : Position.Right,
  };
}

function KinEdgeInner(props: EdgeProps<KinFlowEdge>) {
  const { id, source, target, data } = props;
  const s = rectOf(useInternalNode(source));
  const t = rectOf(useInternalNode(target));
  if (!data || !s || !t) return null;

  const f = facingSides(s, t);
  const style = data.lineStyle ?? 'step';
  let path: string;
  let lx: number;
  let ly: number;
  const common = { sourceX: f.sx, sourceY: f.sy, targetX: f.tx, targetY: f.ty, sourcePosition: f.sp, targetPosition: f.tp };
  if (data.floating || style === 'straight') [path, lx, ly] = getStraightPath(common);
  else if (style === 'curve') [path, lx, ly] = getBezierPath(common);
  else [path, lx, ly] = getSmoothStepPath({ ...common, borderRadius: 12, offset: 14 });

  const v = data.variant;
  const color = data.highlight
    ? 'var(--accent)'
    : v === 'criminal' ? 'var(--danger)' : v === 'social' ? 'var(--edge-social)' : 'var(--edge)';
  const opacity = data.dim ? 0.15 : data.confidence === 'probable' ? 0.85 : 1;
  let dash: string | undefined;
  if (v === 'divorced') dash = '7 5';
  else if (v === 'adopt' || v === 'livein') dash = '2 4';
  else if (v === 'sibling') dash = '4 4';
  if (data.confidence === 'suspected' && !dash) dash = '2 5';
  const width = data.highlight ? 3 : v === 'criminal' ? 1.8 : v === 'social' ? 1.2 : 1.6;
  const markerEnd = v === 'criminal' || v === 'social' ? `url(#sft-arrow-${v === 'criminal' && !data.highlight ? 'red' : data.highlight ? 'accent' : 'grey'})` : undefined;
  const text = data.label && data.showLabel ? <EdgeText x={lx} y={ly} text={data.label} /> : null;

  if (v === 'marriage' || v === 'divorced') {
    return (
      <g style={{ opacity }}>
        <path d={path} fill="none" stroke={color} strokeWidth={data.highlight ? 6 : 5} strokeDasharray={dash} />
        <path d={path} fill="none" stroke="var(--bg)" strokeWidth={data.highlight ? 2.4 : 2} strokeDasharray={dash} />
        {text}
      </g>
    );
  }
  return (
    <g style={{ opacity }}>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={14} style={{ stroke: color, strokeWidth: width, strokeDasharray: dash }} />
      {text}
    </g>
  );
}

function EdgeText({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(40, text.length * 6.6 + 14);
  return (
    <g transform={`translate(${x - w / 2}, ${y - 10})`}>
      <rect width={w} height={20} rx={4} fill="var(--bg)" />
      <text x={w / 2} y={14} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">{text}</text>
    </g>
  );
}

export const KinEdge = memo(KinEdgeInner);

export function EdgeMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {[['red', 'var(--danger)'], ['grey', 'var(--edge-social)'], ['accent', 'var(--accent)']].map(([k, c]) => (
          <marker key={k} id={`sft-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={c} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
