'use client';

import React from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';

function InlineFormat({ text }: { text: string }) {
  const { C } = useCVisionTheme();
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: C.bgSubtle, paddingLeft: 4, paddingRight: 4, borderRadius: 6, fontSize: 12 }}>{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function ArticleContent({ content }: { content: string }) {
  const { C } = useCVisionTheme();
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    elements.push(
      <div key={`table-${elements.length}`} style={{ overflowX: 'auto', marginTop: 12, marginBottom: 12 }}>
        <table style={{ width: '100%', fontSize: 13, border: `1px solid ${C.border}` }}>
          <thead><tr className="bg-muted/50">
            {tableRows[0].map((cell, i) => <th key={i} style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{cell.trim().replace(/\*\*/g, '')}</th>)}
          </tr></thead>
          <tbody>
            {tableRows.slice(1).filter(r => !r[0].match(/^-+$/)).map((row, ri) => (
              <tr key={ri} style={{ borderBottom: `1px solid ${C.border}` }}>
                {row.map((cell, ci) => <td key={ci} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>{cell.trim().replace(/\*\*/g, '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(<pre key={`code-${i}`} style={{ background: C.bgSubtle, borderRadius: 6, padding: 12, fontSize: 12, marginTop: 8, marginBottom: 8, overflowX: 'auto' }}><code>{codeLines.join('\n')}</code></pre>);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    if (line.startsWith('|') && line.endsWith('|')) {
      inTable = true;
      const cells = line.split('|').filter(Boolean);
      if (!cells[0].match(/^[\s-]+$/)) tableRows.push(cells);
      continue;
    }
    if (inTable && !line.startsWith('|')) { flushTable(); inTable = false; }

    if (!line.trim()) { elements.push(<div key={`br-${i}`} style={{ height: 8 }} />); continue; }

    if (line.startsWith('## ')) {
      elements.push(<h2 key={`h2-${i}`} style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${i}`} style={{ fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- **') || line.startsWith('- ')) {
      elements.push(<li key={`li-${i}`} style={{ marginLeft: 16, fontSize: 13 }}><InlineFormat text={line.slice(2)} /></li>);
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<li key={`ol-${i}`} style={{ marginLeft: 16, fontSize: 13 }}><InlineFormat text={line.replace(/^\d+\.\s/, '')} /></li>);
    } else if (line.startsWith('💡')) {
      elements.push(<div key={`tip-${i}`} style={{ background: C.blueDim, borderRadius: 6, padding: 12, fontSize: 13, marginTop: 8, marginBottom: 8 }}><InlineFormat text={line} /></div>);
    } else if (line.startsWith('⚠️')) {
      elements.push(<div key={`warn-${i}`} style={{ background: C.orangeDim, borderRadius: 6, padding: 12, fontSize: 13, marginTop: 8, marginBottom: 8 }}><InlineFormat text={line} /></div>);
    } else if (line.startsWith('[Screenshot:')) {
      elements.push(<div key={`ss-${i}`} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 8, marginBottom: 8 }}>{line}</div>);
    } else {
      elements.push(<p key={`p-${i}`} style={{ fontSize: 13, marginTop: 4, marginBottom: 4 }}><InlineFormat text={line} /></p>);
    }
  }
  if (inTable) flushTable();

  return <>{elements}</>;
}
