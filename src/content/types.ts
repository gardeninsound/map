export interface ArtAsset {
  id: string;
  kind: 'image' | 'video';
  w: number;
  h: number;
  /** capture date, YYYY-MM-DD */
  date: string;
  /** dominant color, used as a loading placeholder */
  color: string;
}
