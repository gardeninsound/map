// Who's who, by GitHub login or git name: shared by the story log (scripts/story/lib.mjs) and the admin page.
const PEOPLE = { vlandham: 'Jim', 'jim vallandingham': 'Jim', jim: 'Jim', 'exit320-stack': 'Mike', mike: 'Mike' };
/** Jim or Mike for their logins and names, anyone else as they are */
export const personOf = (who) => (who ? (PEOPLE[String(who).toLowerCase()] ?? who) : null);
