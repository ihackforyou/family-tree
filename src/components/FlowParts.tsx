import { memo } from 'react';
import {
  BaseEdge, getSmoothStepPath, useInternalNode, type EdgeProps, type Edge as FlowEdge, type Node, type NodeProps,
} from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Side } from '../engine/relations';
import { useStore } from '../store';
import { GEN_NAMES, SIDE_META, genLabel } from './meta';

// ---------------------------------------------------------------- lanes

export type LaneData = { side: Side; count: number; collapsed: boolean };
export type LaneFlowNode = Node<LaneData, 'lane'>;

function LaneNodeInner({ data }: NodeProps<LaneFlowNode>) {
  const toggle = useStore((s) => s.toggleLane);
  const meta = SIDE_META[data.side];
  const canCollapse = data.side !== 'core';
  return (
    <div className={`lane lane-${data.side}`}>
      <div className="lane-head">
        {!data.collapsed && <span>{meta.hi}</span>}
        {!data.collapsed && <span className="en">{meta.en}</span>}
        {data.collapsed && <span>{meta.hi.split(' ')[0]}</span>}
        <span className="count">{data.collapsed ? `+${data.count}` : data.count}</span>
        {canCollapse && (
          <button className="nodrag" title={data.collapsed ? 'खोलें' : 'छोटा करें'} onClick={() => toggle(data.side)}>
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
  return (
    <div className={`row-label ${data.gen === 0 ? 'zero' : ''}`}>
      <span className="g">{genLabel(data.gen)}</span>
      <span className="n">{GEN_NAMES[data.gen] ?? ''}</span>
    </div>
  );
}
export const RowLabelNode = memo(RowLabelInner);

// ---------------------------------------------------------------- edges

export type KinVariant = 'blood' | 'adopt' | 'marriage' | 'divorced' | 'livein' | 'sibling' | 'social' | 'criminal';
export type KinEdgeData = {
  variant: KinVariant;
  confidence: 'confirmed' | 'probable' | 'suspected';
  highlight: boolean;
  dim: boolean;
  floating: boolean;
  label?: string;
};
export type KinFlowEdge = FlowEdge<KinEdgeData, 'kin'>;

function centerOf(n: ReturnType<typeof useInternalNode>) {
  if (!n) return { x: 0, y: 0 };
  const w = n.measured?.width ?? 220;
  const h = n.measured?.height ?? 92;
  return { x: n.internals.positionAbsolute.x + w / 2, y: n.internals.positionAbsolute.y + h / 2 };
}

function KinEdgeInner(props: EdgeProps<KinFlowEdge>) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const sNode = useInternalNode(source);
  const tNode = useInternalNode(target);
  if (!data) return null;

  let path: string;
  let lx: number;
  let ly: number;
  if (data.floating) {
    const a = centerOf(sNode);
    const b = centerOf(tNode);
    path = `M${a.x},${a.y} L${b.x},${b.y}`;
    lx = (a.x + b.x) / 2;
    ly = (a.y + b.y) / 2;
  } else {
    [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14, offset: 18 });
  }

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
  const width = data.highlight ? 3 : v === 'criminal' ? 2 : v === 'social' ? 1 : 1.6;

  const markerEnd = v === 'criminal' || v === 'social' ? `url(#sft-arrow-${v === 'criminal' && !data.highlight ? 'red' : data.highlight ? 'accent' : 'grey'})` : undefined;

  if (v === 'marriage' || v === 'divorced') {
    // double line for marriage
    return (
      <g style={{ opacity }}>
        <path d={path} fill="none" stroke={color} strokeWidth={data.highlight ? 6 : 5} strokeDasharray={dash} />
        <path d={path} fill="none" stroke="var(--bg)" strokeWidth={data.highlight ? 2.4 : 2} strokeDasharray={dash} />
        {data.label && <EdgeText x={lx} y={ly} text={data.label} />}
      </g>
    );
  }
  return (
    <g style={{ opacity }}>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: width, strokeDasharray: dash }} />
      {data.label && <EdgeText x={lx} y={ly} text={data.label} />}
    </g>
  );
}

function EdgeText({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(40, text.length * 6.6 + 14);
  return (
    <g transform={`translate(${x - w / 2}, ${y - 10})`}>
      <rect width={w} height={20} rx={10} fill="var(--surface)" stroke="var(--border)" />
      <text x={w / 2} y={14} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{text}</text>
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
