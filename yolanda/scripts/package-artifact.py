# Turns dist-single/index.html into a page fragment (no doctype/html/head/body) for sharing hosts
# that wrap pages in their own document skeleton.
import re, sys
s = open('dist-single/index.html').read()
head = s[s.index('<head>') + 6 : s.index('</head>')]
body = s[s.index('<body>') + 6 : s.rindex('</body>')]
# drop only real tags at the top of <head> (careful: shader code contains "<meta..." includes)
head = re.sub(r'^\s*<meta\s[^>]*>\s*', '', head, flags=re.M)
head = re.sub(r'^\s*<link rel="preconnect"[^>]*>\s*', '', head, flags=re.M)
head = re.sub(r'^\s*<title>.*?</title>\s*', '', head, flags=re.M)
out = '<title>Yolanda — Anesthesia Shift</title>\n' + head.strip() + '\n' + body.strip() + '\n'
assert out.count('#include <') == s.count('#include <'), 'shader includes damaged'
open(sys.argv[1], 'w').write(out)
print('wrote', sys.argv[1], len(out))
