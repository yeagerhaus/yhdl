import type { DiscographyAlbum } from "./types.js";

// Explicit Content Lyrics status values
export const LyricsStatus = {
	NOT_EXPLICIT: 0,
	EXPLICIT: 1,
	UNKNOWN: 2,
	EDITED: 3,
	PARTIALLY_EXPLICIT: 4,
	PARTIALLY_UNKNOWN: 5,
	NO_ADVICE: 6,
	PARTIALLY_NO_ADVICE: 7,
};

export const ReleaseType = ["single", "album", "compile", "ep", "bundle"];
export const RoleID = ["Main", null, null, null, null, "Featured"];

export function is_explicit(explicit_content_lyrics: unknown): boolean {
	return [LyricsStatus.EXPLICIT, LyricsStatus.PARTIALLY_EXPLICIT].includes(
		parseInt(String(explicit_content_lyrics), 10) || LyricsStatus.UNKNOWN,
	);
}

// Maps GW API album from discography to standard format
export function map_artist_album(
	album: Record<string, unknown>,
): DiscographyAlbum {
	return {
		id: album.ALB_ID as string,
		title: album.ALB_TITLE as string,
		link: `https://www.deezer.com/album/${album.ALB_ID}`,
		cover: `https://api.deezer.com/album/${album.ALB_ID}/image`,
		cover_small: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/56x56-000000-80-0-0.jpg`,
		cover_medium: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/250x250-000000-80-0-0.jpg`,
		cover_big: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/500x500-000000-80-0-0.jpg`,
		cover_xl: `https://cdns-images.dzcdn.net/images/cover/${album.ALB_PICTURE}/1000x1000-000000-80-0-0.jpg`,
		md5_image: album.ALB_PICTURE as string,
		genre_id: album.GENRE_ID as number | undefined,
		release_date: album.PHYSICAL_RELEASE_DATE as string | undefined,
		record_type: ReleaseType[parseInt(album.TYPE as string, 10)] || "unknown",
		tracklist: `https://api.deezer.com/album/${album.ALB_ID}/tracks`,
		explicit_lyrics: is_explicit(album.EXPLICIT_LYRICS),
		nb_tracks: album.NUMBER_TRACK as number,
		nb_disk: album.NUMBER_DISK as number | undefined,
		copyright: album.COPYRIGHT as string | undefined,
		rank: album.RANK as number | undefined,
		digital_release_date: album.DIGITAL_RELEASE_DATE as string | undefined,
		original_release_date: album.ORIGINAL_RELEASE_DATE as string | undefined,
		physical_release_date: album.PHYSICAL_RELEASE_DATE as string | undefined,
		is_official: album.ARTISTS_ALBUMS_IS_OFFICIAL as boolean | undefined,
		artist_role: RoleID[album.ROLE_ID as number] ?? undefined,
	};
}
