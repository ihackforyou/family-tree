import { memo } from 'react';
import { Handle, Position, useStore as useFlowStore, type NodeProps, type Node } from '@xyflow/react';
import { Lock, Plus, Skull, Users } from 'lucide-react';
import type { Person } from '../types';
import { useStore } from '../store';
import { ROLE_META, ageText, avatarColor, initials } from './meta';

export type PersonNodeData = {
  person: Person;
  primary: string;
  secondary: string;
  isFocus: boolean;
  dim: boolean;
  onPath: boolean;
};

export type PersonFlowNode = Node<PersonNodeData, 'person'>;

const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2] < 0.42;

function Handles() {
  // every side has a source and a target handle so edges can attach anywhere
  return (
    <>
      <Handle id="t" type="source" position={Position.Top} className="h-dot" />
      <Handle id="t-in" type="target" position={Position.Top} className="h-dot" />
      <Handle id="b" type="source" position={Position.Bottom} className="h-dot" />
      <Handle id="b-in" type="target" position={Position.Bottom} className="h-dot" />
      <Handle id="l" type="source" position={Position.Left} className="h-dot" />
      <Handle id="l-in" type="target" position={Position.Left} className="h-dot" />
      <Handle id="r" type="source" position={Position.Right} className="h-dot" />
      <Handle id="r-in" type="target" position={Position.Right} className="h-dot" />
    </>
  );
}

export function Avatar({ person, size }: { person: Person; size?: number }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.36 } : undefined;
  if (person.photo) {
    return <div className="avatar" style={style}><img src={person.photo} alt="" /></div>;
  }
  return (
    <div className="avatar" style={{ ...style, background: person.isGhost ? 'var(--surface-3)' : avatarColor(person.id) }}>
      {person.isGhost ? '?' : initials(person.name)}
    </div>
  );
}

function PersonNodeInner({ data, selected }: NodeProps<PersonFlowNode>) {
  const { person, primary, secondary, isFocus, dim, onPath } = data;
  const compact = useFlowStore(zoomSelector);
  const setDialog = useStore((s) => s.setDialog);
  const role = ROLE_META[person.role];

  if (compact) {
    return (
      <div className={`pdot ${isFocus ? 'focus' : ''}`} style={{ opacity: dim ? 0.25 : 1 }}>
        <Handles />
        <div className="dot" style={{ background: person.role === 'relative' ? avatarColor(person.id) : role.color }}>
          {person.isGhost ? '?' : initials(person.name)}
        </div>
      </div>
    );
  }

  const cls = [
    'pcard',
    selected && 'selected',
    isFocus && 'focus',
    person.isGhost && 'ghost',
    dim && 'dim',
    onPath && 'onpath',
    person.status === 'deceased' && 'deceased',
    person.status === 'absconding' && 'absconding',
  ].filter(Boolean).join(' ');

  const add = (preset: 'up' | 'down' | 'sibling' | 'spouse' | 'social') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setDialog({ type: 'add', anchorId: person.id, preset });
  };

  const meta = [ageText(person.dob, person.approxAge), person.address].filter(Boolean).join(' · ');

  return (
    <div className={cls} title={person.aliases.length ? `उर्फ़: ${person.aliases.join(', ')}` : undefined}>
      <Handles />
      {person.role !== 'relative' && person.role !== 'unknown' && (
        <span className="role-badge" style={{ background: role.color }}>{role.hi}</span>
      )}
      <Avatar person={person} />
      <div className="pbody">
        <div className="pname">
          {person.status === 'deceased' && '† '}
          {person.isGhost ? 'अज्ञात' : person.name}
        </div>
        <div className="rel-chip" title={`${primary}${secondary ? ' · ' + secondary : ''}`}>
          {primary}
          {secondary && <span className="sec"> · {secondary}</span>}
        </div>
        <div className="pmeta">{meta || (person.isGhost ? 'नाम भरने के लिए click करें' : ' ')}</div>
      </div>
      {person.status === 'arrested' && <span className="status-icon arrested" title="गिरफ़्तार"><Lock size={14} /></span>}
      {person.status === 'deceased' && <span className="status-icon" title="मृत"><Skull size={14} /></span>}

      <button className="plus top nodrag" title="माता / पिता जोड़ें" onClick={add('up')}><Plus size={13} /></button>
      <button className="plus bottom nodrag" title="बेटा / बेटी जोड़ें" onClick={add('down')}><Plus size={13} /></button>
      <button className="plus left nodrag" title="भाई / बहन जोड़ें" onClick={add('sibling')}><Plus size={13} /></button>
      <button className="plus right nodrag" title="पति / पत्नी जोड़ें" onClick={add('spouse')}><Plus size={13} /></button>
      <button className="plus social nodrag" title="दोस्त / सहयोगी जोड़ें" onClick={add('social')}><Users size={12} /></button>
    </div>
  );
}

export const PersonNode = memo(PersonNodeInner);
