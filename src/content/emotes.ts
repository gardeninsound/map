/**
 * What rabbits can say to each other: a fixed list, never free text (everyone on the
 * island is an anonymous stranger). On the wire an emote is just its index here, so
 * only ever append — reordering would change what old clients show.
 * `icon` emotes draw a little pixel picture; the rest draw their text.
 */
export interface Emote {
  /** shown in the picker and in the bubble */
  text: string;
  /** a pixel icon instead of text in the bubble */
  icon?: 'heart' | 'note';
  /** for screen readers */
  label: string;
}

export const EMOTES: Emote[] = [
  { text: '♥', icon: 'heart', label: 'Heart' },
  { text: 'HI!', label: 'Hi!' },
  { text: '!', label: 'Surprised' },
  { text: '?', label: 'Puzzled' },
  { text: '♪', icon: 'note', label: 'Music' },
  { text: 'OVER HERE!', label: 'Over here!' },
  { text: 'LOOK!', label: 'Look!' },
  { text: 'NICE SCARF', label: 'Nice scarf' },
  { text: 'BYE!', label: 'Bye!' },
];

/**
 * Names for rabbits: a scarf colour (see SCARVES) and a West Seattle place, both picked
 * from the player's id, so everyone sees the same name and it costs no messages.
 */
export const SCARF_NAMES: Record<string, string> = {
  '#ff9f1c': 'Orange',
  '#e84a5f': 'Red',
  '#9b5de5': 'Purple',
  '#f15bb5': 'Pink',
  '#fee440': 'Yellow',
  '#3a86ff': 'Blue',
  '#80ed99': 'Green',
  '#2ec4b6': 'Teal',
};

export const PLACE_NAMES = [
  'Alki', 'Admiral', 'Fauntleroy', 'Delridge', 'Genesee', 'Morgan', 'Junction', 'Gatewood',
  'Arbor', 'Seaview', 'Fairmount', 'Lincoln', 'Schmitz', 'Duwamish', 'Beach', 'Lowman',
];
