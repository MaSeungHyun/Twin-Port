import containerThumbnail from "./container_thumbnail.png";
import craneThumbnail from "./crane_thumbnail.png";
import overheadCraneThumbnail from "./overhead_crane_thumbnail.webp";
import shipThumbnail from "./ship_thumbnail.png";

export const CONTENT_THUMBNAILS = {
  container: containerThumbnail,
  ship: shipThumbnail,
  crane: craneThumbnail,
  overheadCrane: overheadCraneThumbnail,
} as const;

export type ContentThumbnailKey = keyof typeof CONTENT_THUMBNAILS;
