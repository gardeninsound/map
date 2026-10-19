import type { ComponentProps } from 'react';
import { DialogBox as CityDialog } from 'west-seattle-map';

export const MIKE_PORTRAIT = `${import.meta.env.BASE_URL}sprites/mike-portrait.png`;

/** west-seattle-map's dialog box, with Mike speaking unless told otherwise. */
export function DialogBox(props: ComponentProps<typeof CityDialog>) {
  return <CityDialog speaker="Mike" portrait={MIKE_PORTRAIT} {...props} />;
}
