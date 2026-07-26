// Turns a profile URL like "https://www.instagram.com/light_and_lore/" into
// Instagram's direct-message deep link (https://ig.me/m/<username>), which
// opens a DM thread with that account instead of just the profile page.
export function instagramDmUrl(profileUrl) {
  if (!profileUrl) return null;
  const match = profileUrl.match(/instagram\.com\/([^/?]+)/i);
  if (!match) return null;
  return `https://ig.me/m/${match[1]}`;
}
