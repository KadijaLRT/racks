// Strips image/backImage fields before sending closet items to a
// text-only AI route (Looks, Manifest, Wishlist analysis/cart). These
// routes only ever read category/name/tags/laundryStatus to build a
// text prompt, never the photo itself, so sending the full base64
// image data is pure waste: for a closet of any real size this can
// balloon the request to several megabytes, risking (and on some
// platforms guaranteeing) a 413 Payload Too Large from the hosting
// platform's own request-size limit before the request ever reaches
// our route handler. A 413 response is typically plain text/HTML, not
// JSON, so `res.json().catch(() => ({}))` on the client silently
// swallows the parse failure and returns `{}` — which then looks
// identical to "the AI legitimately returned nothing", producing a
// confusing generic error with no indication the real problem was
// payload size.

export function stripImagesForPrompt<
  T extends { image?: string; backImage?: string }
>(items: T[]): Omit<T, "image" | "backImage">[] {
  return (items || []).map((item) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image, backImage, ...rest } = item;
    return rest;
  });
}
