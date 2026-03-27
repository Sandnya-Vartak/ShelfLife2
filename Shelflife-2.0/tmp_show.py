from pathlib import Path
text = Path("EMAIL_TESTING.md").read_text(encoding="utf-8", errors="replace")
idx = text.index("Trigger expiry emails for every user")
print(repr(text[idx-20:idx+200]))
