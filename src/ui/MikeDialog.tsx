import type { ComponentProps } from 'react';
import { DialogBox as CityDialog } from '../city';

export const MIKE_PORTRAIT = `${import.meta.env.BASE_URL}sprites/mike-portrait.png`;

/** The city's dialog box (src/city), with Mike speaking unless someone else is named. */
export function DialogBox({ speaker, portrait, ...rest }: ComponentProps<typeof CityDialog>) {
  // `speaker={undefined}` must still mean Mike, so default after destructuring, not by spread order.
  return <CityDialog speaker={speaker ?? 'Mike'} portrait={portrait ?? MIKE_PORTRAIT} {...rest} />;
}
