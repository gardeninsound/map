/**
 * Seven+ Stories — the vacant lot at 4731 40th Ave SW, walked in first person.
 * Each sign is a photo from public/art/puppy-park, cropped to just its board for the 3D
 * signboard (`crop` = left, top, right, bottom as fractions of the photo); the close-up
 * shows the whole photo. Positions are metres in the lot (x east, z south; the sidewalk
 * and street are on the +z side). Mike's lines are drafts — his to rewrite.
 */
export interface ParkSign {
  /** asset id in artManifest['puppy-park'] */
  asset: string;
  crop: [number, number, number, number];
  posts: 'wood' | 'pink';
  x: number;
  z: number;
  /** which way the face points, degrees (0 = toward the street, +z) */
  facing: number;
  /** board width in metres; height follows the crop's aspect */
  width: number;
  title: string;
  says: string;
}

export const parkSigns: ParkSign[] = [
  {
    asset: 'img-3554',
    crop: [0.22, 0.16, 0.71, 0.6],
    posts: 'wood',
    x: -9,
    z: 13,
    facing: 0,
    width: 1.1,
    title: '“This park will be seven+ stories.”',
    says: 'The lot was waiting to become apartments. Until then, it was a park — if we said so.',
  },
  {
    asset: 'img-3718',
    crop: [0.06, 0.08, 0.95, 0.9],
    posts: 'wood',
    x: -2,
    z: 13.5,
    facing: 0,
    width: 1.3,
    title: '“Seven+ stories of ramps and plants and puppies w/out pants.”',
    says: 'If it is going to be seven stories anyway, here is what we would put in them.',
  },
  {
    asset: 'img-3524',
    crop: [0.0, 0.17, 0.88, 0.95],
    posts: 'wood',
    x: 6,
    z: 12.5,
    facing: -10,
    width: 1.2,
    title: 'The rhino in the oval',
    says: 'Someone tagged this one. That is part of it too — the conversation keeps going.',
  },
  {
    asset: 'img-4872',
    crop: [0.52, 0.36, 0.93, 0.94],
    posts: 'wood',
    x: -12,
    z: -5,
    facing: 35,
    width: 1.2,
    title: '“That we let our future be phoned in.”',
    says: 'Then the orange fencing went up.',
  },
  {
    asset: 'img-5003',
    crop: [0.03, 0.1, 0.98, 0.83],
    posts: 'pink',
    x: -4,
    z: -1,
    facing: 15,
    width: 1.4,
    title: 'Hey you',
    says: 'Out in the middle of the field, on pink legs.',
  },
  {
    asset: 'img-5020',
    crop: [0.1, 0.07, 0.76, 0.97],
    posts: 'pink',
    x: 5,
    z: -3,
    facing: -20,
    width: 1.4,
    title: '“Bear Island — garden in sound”',
    says: 'Bear Island. Every island needs its bears.',
  },
  {
    asset: 'img-5188',
    crop: [0.07, 0.0, 0.89, 0.6],
    posts: 'pink',
    x: 12,
    z: -9,
    facing: -40,
    width: 1.3,
    title: '“Soil is first.”',
    says: 'Before the seven stories, before the puppies: soil.',
  },
];

export const parkScript = {
  title: 'Seven+ Stories',
  intro: [
    'This lot on 40th sat empty, waiting to become seven-plus stories. So for a while, it was a park.',
    'Walk around — arrows or WASD, drag to look. Get close to a sign and press {A} to read it.',
  ],
};
