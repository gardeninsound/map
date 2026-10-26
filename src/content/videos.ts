/**
 * Words for the video spots (experience `video`): the scene plays the first video in the
 * spot's art set, then Mike says the outro. Keyed by location id.
 */
export interface VideoScript {
  title: string;
  /** what Mike says when the video ends */
  outro: string[];
}

export const videoScripts: Record<string, VideoScript> = {
  snuggle: {
    title: 'A GOOD SNUGGLE',
    outro: ['God darn, we all could use a good snuggle.', 'Go hug a tree on your way out.'],
  },
};
