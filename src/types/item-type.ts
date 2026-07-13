export type ContentKind = "text" | "url" | "file";

export type IconName = "Code" | "Sparkles" | "Terminal" | "StickyNote" | "File" | "Image" | "Link";

/** Static metadata shared by system item types and future custom types. */
export interface ItemTypeMetadata {
    id: string;
    name: string;
    icon: IconName;
    color: string;
    slug: string;
    kind: ContentKind;
    isPro: boolean;
}
