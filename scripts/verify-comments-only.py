"""Proves a documentation pass changed comments only. `npm run docs:comments-only`.

The documentation overhaul edits comments across the whole of `src/`, and its one hard rule is that
no behaviour moves with them. Reading a 20-file diff cannot establish that: a deleted line of code
hides easily among reflowed prose. This strips every comment and collapses whitespace on both sides,
then compares what is left against `HEAD` — so a pass either provably touched nothing but text, or
it names the file that did.

Compares the working tree against `HEAD`, over `src/` by default or the paths given as arguments.
Run it before reporting any pass done; see `context/coding-standards.md` for the standard the pass
is applying.
"""
import subprocess, re, sys

def strip(src):
    out, i, n = [], 0, len(src)
    in_line = in_block = in_str = False
    q = ''
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ''
        if in_line:
            if c == '\n':
                in_line = False
                out.append(c)
        elif in_block:
            if c == '*' and nxt == '/':
                in_block = False
                i += 1
        elif in_str:
            if c == '\\':
                out.append(c); i += 1
                out.append(src[i] if i < n else '')
            else:
                out.append(c)
                if c == q:
                    in_str = False
        else:
            if c == '/' and nxt == '/':
                in_line = True; i += 1
            elif c == '/' and nxt == '*':
                in_block = True; i += 1
            elif c in '"\'`':
                in_str = True; q = c; out.append(c)
            else:
                out.append(c)
        i += 1
    return re.sub(r'\s+', ' ', ''.join(out)).strip()

scope = sys.argv[1:] or ["src/"]
files = subprocess.run(["git", "diff", "--name-only", "HEAD", "--"] + scope,
                       capture_output=True, text=True).stdout.split()
bad = 0
for f in files:
    old = subprocess.run(["git", "show", f"HEAD:{f}"], capture_output=True, text=True).stdout
    new = open(f).read()
    same = strip(old) == strip(new)
    print(("  OK   " if same else "  DIFF ") + f)
    if not same:
        bad += 1
print(f"{len(files)} file(s), {bad} with code changes")
sys.exit(1 if bad else 0)
