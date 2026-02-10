import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { marked } from 'marked';
import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    ImageRun, Table, TableRow, TableCell, WidthType,
    BorderStyle, AlignmentType, ShadingType
} from 'docx';

const SRC_DIR = join(process.env.USERPROFILE, 'Desktop', 'feature_proposal');
const MD_FILE = join(SRC_DIR, 'feature_proposal.md');
const OUT_FILE = join(SRC_DIR, 'feature_proposal.docx');

const md = readFileSync(MD_FILE, 'utf-8');
const tokens = marked.lexer(md);

const children = [];

function textRuns(text, opts = {}) {
    // Strip markdown bold/italic markers and create runs
    const runs = [];
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g);
    for (const part of parts) {
        if (!part) continue;
        if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: 'Malgun Gothic', size: opts.size || 22, ...opts }));
        } else if (part.startsWith('*') && part.endsWith('*')) {
            runs.push(new TextRun({ text: part.slice(1, -1), italics: true, font: 'Malgun Gothic', size: opts.size || 22, ...opts }));
        } else if (part.startsWith('`') && part.endsWith('`')) {
            runs.push(new TextRun({ text: part.slice(1, -1), font: 'Consolas', size: opts.size || 20, shading: { type: ShadingType.CLEAR, fill: 'E8E8E8' } }));
        } else {
            runs.push(new TextRun({ text: part, font: 'Malgun Gothic', size: opts.size || 22, ...opts }));
        }
    }
    return runs;
}

function addImage(src) {
    // Resolve relative path
    let imgPath = src.replace(/^\.\//, '');
    const fullPath = join(SRC_DIR, imgPath);
    if (!existsSync(fullPath)) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[이미지: ${src}]`, italics: true, color: '888888', font: 'Malgun Gothic' })] }));
        return;
    }
    try {
        const imgData = readFileSync(fullPath);
        children.push(new Paragraph({
            children: [
                new ImageRun({
                    data: imgData,
                    transformation: { width: 600, height: 340 },
                    type: 'png',
                })
            ],
            spacing: { before: 200, after: 200 },
            alignment: AlignmentType.CENTER,
        }));
    } catch (e) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[이미지 로드 실패: ${src}]`, color: 'FF0000', font: 'Malgun Gothic' })] }));
    }
}

for (const token of tokens) {
    if (token.type === 'heading') {
        const level = token.depth;
        const headingMap = {
            1: HeadingLevel.HEADING_1,
            2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3,
            4: HeadingLevel.HEADING_4,
        };
        children.push(new Paragraph({
            children: textRuns(token.text, { size: [40, 32, 28, 24][level - 1] || 22, bold: true }),
            heading: headingMap[level] || HeadingLevel.HEADING_4,
            spacing: { before: 300, after: 150 },
        }));
    } else if (token.type === 'paragraph') {
        // Check for image
        const imgMatch = token.text.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) {
            // Caption
            if (imgMatch[1]) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: imgMatch[1], italics: true, size: 18, color: '666666', font: 'Malgun Gothic' })],
                    spacing: { before: 100 },
                    alignment: AlignmentType.CENTER,
                }));
            }
            addImage(imgMatch[2]);
        } else {
            children.push(new Paragraph({
                children: textRuns(token.text),
                spacing: { before: 100, after: 100 },
            }));
        }
    } else if (token.type === 'blockquote') {
        const bqText = token.tokens?.map(t => t.text || t.raw || '').join(' ') || token.text || '';
        children.push(new Paragraph({
            children: textRuns(bqText, { italics: true, color: '555555' }),
            indent: { left: 720 },
            spacing: { before: 100, after: 100 },
        }));
    } else if (token.type === 'table') {
        const rows = [];
        // Header
        if (token.header) {
            rows.push(new TableRow({
                children: token.header.map(h => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h.text || h, bold: true, font: 'Malgun Gothic', size: 20, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                    shading: { type: ShadingType.CLEAR, fill: '4A4A8A' },
                    width: { size: Math.floor(100 / token.header.length), type: WidthType.PERCENTAGE },
                })),
            }));
        }
        // Body rows
        if (token.rows) {
            for (const row of token.rows) {
                rows.push(new TableRow({
                    children: row.map(cell => new TableCell({
                        children: [new Paragraph({ children: textRuns(cell.text || cell, { size: 20 }) })],
                        width: { size: Math.floor(100 / row.length), type: WidthType.PERCENTAGE },
                    })),
                }));
            }
        }
        if (rows.length > 0) {
            children.push(new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
            }));
            children.push(new Paragraph({ children: [], spacing: { after: 150 } }));
        }
    } else if (token.type === 'code') {
        // Skip mermaid diagrams in docx, add a note
        if (token.lang === 'mermaid') {
            children.push(new Paragraph({
                children: [new TextRun({ text: '[Mermaid 다이어그램 — 마크다운 원본 참조]', italics: true, color: '888888', font: 'Malgun Gothic', size: 20 })],
                spacing: { before: 100, after: 100 },
                alignment: AlignmentType.CENTER,
            }));
        } else {
            const lines = token.text.split('\n');
            for (const line of lines) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: line, font: 'Consolas', size: 18 })],
                    shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
                    indent: { left: 360 },
                }));
            }
        }
    } else if (token.type === 'hr') {
        children.push(new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
            spacing: { before: 200, after: 200 },
        }));
    } else if (token.type === 'list') {
        for (const item of token.items) {
            children.push(new Paragraph({
                children: textRuns(item.text),
                bullet: { level: 0 },
                spacing: { before: 50, after: 50 },
            }));
        }
    } else if (token.type === 'space') {
        // skip
    }
}

const doc = new Document({
    sections: [{
        properties: {
            page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
        },
        children,
    }],
    styles: {
        default: {
            document: {
                run: { font: 'Malgun Gothic', size: 22 },
            },
        },
    },
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUT_FILE, buffer);
console.log(`✅ DOCX saved: ${OUT_FILE}`);
console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
