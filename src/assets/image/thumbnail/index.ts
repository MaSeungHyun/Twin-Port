import containerThumbnail from "./container_thumbnail.png";
import craneThumbnail from "./crane_thumbnail.png";
import shipThumbnail from "./ship_thumbnail.png";

export const CONTENT_THUMBNAILS = {
  container: containerThumbnail,
  ship: shipThumbnail,
  crane: craneThumbnail,
} as const;

export type ContentThumbnailKey = keyof typeof CONTENT_THUMBNAILS;
