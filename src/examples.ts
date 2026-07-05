import { normalizeLayout, NormalizedLayout } from './layoutIO';
import basementArcade from '../examples/basement-arcade.json';
import pinballRow from '../examples/pinball-row.json';
import poolAndPlay from '../examples/pool-and-play.json';

export interface ExampleLayout {
  id: string;
  name: string;
  description: string;
  layout: NormalizedLayout;
}

const raw = [
  { id: 'basement-arcade', file: basementArcade },
  { id: 'pinball-row', file: pinballRow },
  { id: 'pool-and-play', file: poolAndPlay },
];

export const examples: ExampleLayout[] = raw.map(({ id, file }) => ({
  id,
  name: (file as any).name ?? id,
  description: (file as any).description ?? '',
  layout: normalizeLayout(file),
}));
