declare module "flac-metadata" {
	export interface ProcessorOptions {
		parseMetaDataBlocks?: boolean;
	}

	export interface MetaDataBlock {
		type: number;
		isLast?: boolean;
		remove(): void;
		publish(): Buffer;
	}

	export interface VorbisCommentBlock extends MetaDataBlock {
		vendor: string;
		comments: string[];
	}

	export const Processor: {
		MDB_TYPE_VORBIS_COMMENT: number;
		MDB_TYPE_PICTURE: number;
		new (options?: ProcessorOptions): NodeJS.ReadWriteStream & {
			on(event: "preprocess", handler: (this: { push: (chunk: Buffer) => void }, mdb: MetaDataBlock) => void): void;
			on(event: "postprocess", handler: (this: { push: (chunk: Buffer) => void }, mdb: MetaDataBlock) => void): void;
			on(event: "data", handler: (chunk: Buffer) => void): void;
			write(data: Buffer): void;
			end(): void;
		};
	};

	export const data: {
		MetaDataBlockVorbisComment: {
			create(isLast: boolean, vendor: string, comments: string[]): VorbisCommentBlock & { isLast?: boolean };
		};
		MetaDataBlockPicture: {
			create(
				isLast: boolean,
				pictureType: number,
				mimeType: string,
				description: string,
				width: number,
				height: number,
				bitsPerPixel: number,
				colors: number,
				pictureData: Buffer,
			): MetaDataBlock & { isLast?: boolean };
		};
	};

	const flacMetadata: {
		Processor: typeof Processor;
		data: typeof data;
	};
	export default flacMetadata;
}
