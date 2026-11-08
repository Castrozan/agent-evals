export const PAGE_STYLES = `
:root{color-scheme:light dark;--bg:#f6f8fa;--card:#fff;--text:#1f2328;--muted:#656d76;--border:#d0d7de;--ok:#1a7f37;--bad:#cf222e;--warn:#9a6700;--code:#eaeef2}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--card:#161b22;--text:#e6edf3;--muted:#8d96a0;--border:#30363d;--ok:#3fb950;--bad:#f85149;--warn:#d29922;--code:#21262d}}
*{box-sizing:border-box}
body{margin:0;padding:24px;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}
main{max-width:960px;margin:0 auto}
h1{margin:0 0 4px;font-size:24px}h2{margin:32px 0 12px;font-size:19px}h3{margin:0 0 8px;font-size:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin:0 0 12px}
.muted{color:var(--muted)}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
.rate{font-size:36px;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--border)}
.tag{display:inline-block;padding:0 6px;border:1px solid var(--border);border-radius:10px;font-size:12px;color:var(--muted)}
pre{background:var(--code);padding:8px;border-radius:6px;overflow:auto;white-space:pre-wrap;word-break:break-word}
ul{margin:4px 0;padding-left:20px}
`;
