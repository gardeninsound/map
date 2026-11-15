/**
 * Mermaids off Alki Beach (idea box #37, from Zia: "add mermaids saying catch phrases like
 * 'eyes closed sun so close'"). They sit on rocks just offshore: one by the end of the
 * 58th Ave rowboat dock (walk up), the others along the beach (row up in the boat). Near
 * the shore you see them call out their catch phrases; {A} close by and they chat.
 * Names and phrases are drafts — Mike's (and Zia's) to rewrite.
 */
export interface Mermaid {
  name: string;
  hair: string;
  tail: string;
  /** where along the beach, roughly; she sits on the nearest rock just off the sand */
  at: { lat: number; lon: number } | 'dock';
  phrases: string[];
}

export const mermaids: Mermaid[] = [
  {
    name: 'Marina',
    hair: '#ff2e93',
    tail: '#2ec4b6',
    at: 'dock',
    phrases: ['Eyes closed, sun so close.', 'Salt in my hair, Sound in my heart.', 'Sea you at sunset!'],
  },
  {
    name: 'Coral',
    hair: '#ffb627',
    tail: '#9b6ad1',
    at: { lat: 47.5806, lon: -122.4058 },
    phrases: ["Tide's out, vibes up!", 'Fin-tastic day for it.', 'Ferry horn? That one is for me.'],
  },
  {
    name: 'Pearl',
    hair: '#2a1a12',
    tail: '#e84a5f',
    at: { lat: 47.5815, lon: -122.4030 },
    phrases: ['Kelp me, I am so shell-shocked!', 'Waves hello!', 'Eyes closed, sun so close.'],
  },
];

/** what a mermaid says when you're up close, after her catch phrase */
export const mermaidChat = (m: Mermaid, phrase: string): string[] => [
  phrase,
  `(${m.name} flicks her tail and splashes you a little. On purpose.)`,
];

export const mermaidLabel = (m: Mermaid) => ({ name: m.name, where: 'a mermaid', verb: 'say hi' });
