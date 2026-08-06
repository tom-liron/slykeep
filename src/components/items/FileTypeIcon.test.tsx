import { File, FileCode, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import { FILE_CONSTRAINTS, FILE_ITEM_TYPE_NAMES } from "@/lib/file-constraints";
import { fileIconFor } from "./FileTypeIcon";

describe("fileIconFor", () => {
    it("maps every uploadable extension to a category icon", () => {
        // The mapping and the upload rules are separate files, so an extension added to one and not
        // the other would silently fall back to the blank file icon.
        for (const itemType of FILE_ITEM_TYPE_NAMES) {
            for (const extension of FILE_CONSTRAINTS[itemType].extensions) {
                expect(fileIconFor(`stashed${extension}`), extension).not.toBe(File);
            }
        }
    });

    it("groups extensions by what the file is", () => {
        expect(fileIconFor("diagram.png")).toBe(FileImage);
        expect(fileIconFor("logo.svg")).toBe(FileImage);
        expect(fileIconFor("rows.csv")).toBe(FileSpreadsheet);
        expect(fileIconFor("docker-compose.yml")).toBe(FileCode);
        expect(fileIconFor("notes.md")).toBe(FileText);
        expect(fileIconFor("spec.pdf")).toBe(FileText);
    });

    it("is case-insensitive and reads only the last extension", () => {
        expect(fileIconFor("SCREENSHOT.PNG")).toBe(FileImage);
        expect(fileIconFor("archive.tar.json")).toBe(FileCode);
    });

    it("falls back to a blank file for anything unmapped", () => {
        expect(fileIconFor("LICENSE")).toBe(File);
        expect(fileIconFor("mystery.bin")).toBe(File);
    });
});
