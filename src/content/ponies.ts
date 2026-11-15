/**
 * Pastel ponies in Lincoln Park's meadow (idea box #36, "add my little ponys (g1)"). Those
 * are someone else's characters, so these are Bear Island's own herd: their own names and
 * looks. They graze and trot about the meadow by the trails; walk up and {A} to say hi.
 * Drafts — Mike's to rewrite.
 */
export interface Pony {
  name: string;
  coat: string;
  mane: string;
  lines: string[];
}

/** the meadow they graze */
export const PONY_MEADOW = { lat: 47.53339, lon: -122.39469 };

export const ponies: Pony[] = [
  { name: 'Sundrop', coat: '#ffe08a', mane: '#ff7eb6', lines: ['Hi hi hi! Did you see the sun come out? I did a lap about it.'] },
  { name: 'Juniper Fizz', coat: '#b9e8d8', mane: '#9b6ad1', lines: ['The clover by the big fir is the sweetest. Don\'t tell the others.'] },
  { name: 'Marmalade', coat: '#ffc39a', mane: '#e84a5f', lines: ['I raced a ferry once. From the shore. I think I won.'] },
  { name: 'Pebble Moon', coat: '#d9d2f2', mane: '#2f4f8f', lines: ['Shh… if you stand very still you can hear the Sound breathing.'] },
  { name: 'Clover', coat: '#f3f0ea', mane: '#2ec4b6', lines: ['A rabbit! Want to see me do a little hop? …That was it. That was the hop.'] },
];

export const ponyLabel = (p: Pony) => ({ name: p.name, where: 'a pony', verb: 'say hi' });
