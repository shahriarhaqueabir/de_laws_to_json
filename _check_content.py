import sqlite3
conn = sqlite3.connect("laws.db")
conn.row_factory = sqlite3.Row

rows = conn.execute("""
    SELECT id, norm_id, length(content) as content_len,
           substr(content, 1, 120) as preview
    FROM norms
    WHERE content LIKE '%Auszahlung%'
    ORDER BY content_len DESC
    LIMIT 5
""").fetchall()
for r in rows:
    print(f"ID={r['id']} norm_id={r['norm_id']!r} len={r['content_len']}")
    print(f"  Preview: {r['preview']!r}")
    print()

row = conn.execute("SELECT MAX(length(content)) as m FROM norms").fetchone()
print(f"Longest content in DB: {row['m']} chars")
conn.close()
