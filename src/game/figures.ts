export const FIGURES = [
  { id: 'knight', label: 'Ritter' },
  { id: 'bat', label: 'Fledermaus' },
  { id: 'ghost', label: 'Gespenst' },
  { id: 'vampire', label: 'Vampir' },
  { id: 'owl', label: 'Eule' },
  { id: 'cat', label: 'Katze' },
  { id: 'witch', label: 'Hexe' },
  { id: 'pumpkin', label: 'Kürbis' },
] as const;

export type FigureId = typeof FIGURES[number]['id'];
export const isFigure = (value: unknown): value is FigureId => FIGURES.some(figure => figure.id === value);
export const figureLabel = (id: FigureId): string => FIGURES.find(figure => figure.id === id)!.label;
