import { memo } from 'react';
import { Handle, Position, useStore as useFlowStore, type NodeProps, type Node } from '@xyflow/react';
import { Lock, Plus, Skull, Users } from 'lucide-react';
import type { Person } from '../types';
import { useStore } from '../store';
import { ROLE_META, STATUS_META, ageText, avatarColor, initials } from './meta';
import { pick } from '../i18n';
import { useT, useUiLang } from '../i18n/useT';

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
  const small = useStore((s) => s.cardSize === 'compact');
  const t = useT();
  const ui = useUiLang();
  const role = ROLE_META[person.role];
  const roleName = pick(role, ui);
  const displayName = person.isGhost ? t('common.unknown') : person.name;
  const alias = person.aliases.length ? t('card.alias', { list: person.aliases.join(', ') }) : '';

  if (compact && !small) {
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
    small && 'mini',
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

  const meta = [ageText(person.dob, person.approxAge, ui), person.address].filter(Boolean).join(' · ');
  const arrested = pick(STATUS_META.arrested, ui);

  if (small) {
    // Minimal card: avatar, name, one relation word. Details are in the side panel / tooltip.
    const tip = [displayName, `${primary}${secondary ? ' · ' + secondary : ''}`, meta, alias]
      .filter(Boolean).join('\n');
    return (
      <div className={cls} title={tip}>
        <Handles />
        <Avatar person={person} size={28} />
        <div className="pbody">
          <div className="pname">
            {person.role !== 'relative' && person.role !== 'unknown' && (
              <span className="rd" style={{ background: role.color }} aria-label={roleName} />
            )}
            <span className="nm">{person.status === 'deceased' && '† '}{displayName}</span>
          </div>
          <div className="rel-chip">{primary}</div>
        </div>
        {person.status === 'arrested' && <span className="status-icon arrested" title={arrested}><Lock size={11} /></span>}
        <button className="plus top nodrag" title={t('add.up')} aria-label={t('add.up')} onClick={add('up')}><Plus size={11} /></button>
        <button className="plus bottom nodrag" title={t('add.down')} aria-label={t('add.down')} onClick={add('down')}><Plus size={11} /></button>
        <button className="plus left nodrag" title={t('add.sibling')} aria-label={t('add.sibling')} onClick={add('sibling')}><Plus size={11} /></button>
        <button className="plus right nodrag" title={t('add.spouse')} aria-label={t('add.spouse')} onClick={add('spouse')}><Plus size={11} /></button>
        <button className="plus social nodrag" title={t('add.social')} aria-label={t('add.social')} onClick={add('social')}><Users size={10} /></button>
      </div>
    );
  }

  return (
    <div className={cls} title={alias || undefined}>
      <Handles />
      <Avatar person={person} />
      <div className="pbody">
        <div className="pname">
          {person.role !== 'relative' && person.role !== 'unknown' && (
            <span className="rd" style={{ background: role.color }} title={roleName} aria-label={roleName} />
          )}
          <span className="nm">
            {person.status === 'deceased' && '† '}
            {displayName}
          </span>
        </div>
        <div className="rel-chip" title={`${primary}${secondary ? ' · ' + secondary : ''}`}>
          {primary}
          {secondary && <span className="sec"> · {secondary}</span>}
        </div>
        <div className="pmeta">{meta || (person.isGhost ? t('card.ghostClick') : ' ')}</div>
      </div>
      {person.status === 'arrested' && <span className="status-icon arrested" title={arrested}><Lock size={14} /></span>}
      {person.status === 'deceased' && <span className="status-icon" title={pick(STATUS_META.deceased, ui)}><Skull size={14} /></span>}

      <button className="plus top nodrag" title={t('add.up')} aria-label={t('add.up')} onClick={add('up')}><Plus size={13} /></button>
      <button className="plus bottom nodrag" title={t('add.down')} aria-label={t('add.down')} onClick={add('down')}><Plus size={13} /></button>
      <button className="plus left nodrag" title={t('add.sibling')} aria-label={t('add.sibling')} onClick={add('sibling')}><Plus size={13} /></button>
      <button className="plus right nodrag" title={t('add.spouse')} aria-label={t('add.spouse')} onClick={add('spouse')}><Plus size={13} /></button>
      <button className="plus social nodrag" title={t('add.social')} aria-label={t('add.social')} onClick={add('social')}><Users size={12} /></button>
    </div>
  );
}

export const PersonNode = memo(PersonNodeInner);
