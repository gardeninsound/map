import { artFormat } from './artManifest';

/** URL of a processed still / video poster (or its thumbnail) in public/art. */
export const artUrl = (set: string, id: string, thumb = false) =>
  `${import.meta.env.BASE_URL}art/${set}/${id}${thumb ? '-t' : ''}.${artFormat}`;

/** URL of a processed video. */
export const videoUrl = (set: string, id: string) => `${import.meta.env.BASE_URL}art/${set}/${id}.mp4`;
