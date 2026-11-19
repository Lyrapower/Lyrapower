#!/usr/bin/env python3
"""地球Online 玩家指南 — 文本校勘与数据构建。
底本(字) = 学术电子本(Kanripo: 四部丛刊/四库全书影印本的逐字录入,繁体,无标点,注文在括号里)。
标点与分段 = 殆知阁标点本。逐章逐字对齐:字以底本为准,标点从标点本搬过来。
输出 data.json 与 collation_report.txt。"""
import re, json, glob, sys, difflib, collections, html, pathlib
from opencc import OpenCC
RAW = pathlib.Path(__file__).parent / 'raw'
T2S = OpenCC('t2s')
PUNCT = set('，。、；：？！「」『』《》〈〉（）()“”‘’—…·﹔．,.;:?!"\' 　\t\r\n-―[]【】〔〕')
CN = '零一二三四五六七八九十'
PUNCT |= set('@0123456789')
def cn2int(s):
    s = s.replace('〇', '零')
    if not s: return 0
    if '百' in s: a, b = s.split('百'); return (CN.index(a) if a else 1) * 100 + cn2int(b.lstrip('零'))
    if '十' in s: a, b = s.split('十'); return (CN.index(a) if a else 1) * 10 + (CN.index(b) if b else 0)
    return CN.index(s)
def int2cn(n):
    if n < 11: return CN[n]
    if n < 20: return '十' + CN[n - 10]
    if n < 100: return CN[n // 10] + '十' + (CN[n % 10] if n % 10 else '')
    return '一百' if n == 100 else CN[n // 100] + '百' + ('零' if n % 100 < 10 and n % 100 else '') + (int2cn(n % 100) if n % 100 else '')

REPORT = []
def log(*a): REPORT.append(' '.join(str(x) for x in a))
PAIRN = collections.Counter()   # pass-1 copy of GP: how often each (base, modern) pair recurs
GP = collections.Counter()      # (base glyph, modern char) pairs seen at aligned positions, over all books
VAR = {}                        # learned: rare variant glyph of the base edition -> modern standard character
MANUAL_VAR = dict(zip('隂徃朙乆㑹嵗竒髙逺眞爲麤蟁亾㬥䧟㓜𢎞亁鍼', '阴往明久会岁奇高远真为粗蚊亡暴陷幼弘乾针'))

# ---------------------------------------------------------------- Kanripo (mandoku) reader
def kan_lines(repo):
    """yield (juan_file, line) with markup removed; commentary in (...) dropped; header lines keep leading 　"""
    out = []
    for f in sorted(glob.glob(str(RAW / repo / (repo + '_*.txt')))):
        for ln in open(f, encoding='utf-8'):
            if ln.startswith('#'): continue
            ln = re.sub(r'<pb:[^>]*>', '', ln).replace('¶', '').rstrip('\n')
            ln = re.sub(r'\([^()]*\)', '', ln)            # commentary
            ln = re.sub(r'\([^()]*$', '', ln)              # unbalanced tail, if any
            ln = re.sub(r'&KR\d+;', '〓', ln)               # glyphs the edition has but Unicode lacks
            if ln.strip('　 '): out.append((f, ln))
    return out
def t2s_keep(s):
    r = T2S.convert(s)
    if len(r) != len(s): r = ''.join(T2S.convert(c) for c in s)
    assert len(r) == len(s)
    return r

# ---------------------------------------------------------------- collation
def split_punct(dp):
    """punctuated text -> (chars, tails) where tails[i] = punctuation/newlines following chars[i]; lead = before first"""
    chars, tails, lead, cur = [], [], '', ''
    for c in dp:
        if c in PUNCT:
            if c in ' \t\r　': continue
            c = {'﹔': '；', '．': '。', ',': '，', ';': '；', ':': '：', '?': '？', '!': '！', '(': '（', ')': '）'}.get(c, c)
            if chars: tails[-1] += c
            else: lead += c
        else: chars.append(c); tails.append('')
    return chars, tails, lead
def gb(c):
    try: c.encode('gb2312'); return True
    except Exception: return False

def collate(book, units):
    """units: list of (label, K_trad_string, D_punctuated_string). returns list of merged punctuated strings."""
    pre, pairs = [], collections.Counter()
    for label, k, d in units:
        ks = ''.join(VAR.get(c, c) for c in t2s_keep(k)); dc, tails, lead = split_punct(d)
        sm = difflib.SequenceMatcher(None, ks, ''.join(dc), autojunk=False)
        ops = sm.get_opcodes(); pre.append((label, k, ks, dc, tails, lead, ops))
        for tag, i1, i2, j1, j2 in ops:
            if tag == 'replace' and i2 - i1 == j2 - j1:
                for a in range(i2 - i1): pairs[(k[i1 + a], dc[j1 + a])] += 1; GP[(ks[i1 + a], dc[j1 + a])] += 1
    out, st = [], collections.Counter()
    samples = []
    for label, k, ks, dc, tails, lead, ops in pre:
        res = [lead]
        for tag, i1, i2, j1, j2 in ops:
            if tag == 'equal':
                for a in range(i2 - i1): res.append(dc[j1 + a] + tails[j1 + a])
                st['same'] += i2 - i1
            elif tag == 'replace' and i2 - i1 == j2 - j1:
                for a in range(i2 - i1):
                    K, Ks, D = k[i1 + a], ks[i1 + a], dc[j1 + a]
                    if K == '〓': ch = D if '一' <= D <= '鿿' else '□'; st['glyph_from_punct_src' if ch != '□' else 'glyph_missing'] += 1
                    elif not ('㐀' <= D <= '鿿' or '\U00020000' <= D <= '\U0003ffff'): ch = Ks; st['fixed_garbled'] += 1
                    elif K == D or Ks == D or T2S.convert(K) == D or pairs[(K, D)] >= 3 or PAIRN[(Ks, D)] >= 3 or (Ks, D) in SAME: ch = D; st['variant_glyph'] += 1
                    else:
                        ch = Ks; st['reading_from_base'] += 1
                        if gb(Ks): samples.append((label, D, Ks, ''.join(dc[max(0, j1 + a - 5):j1 + a + 6])))
                        else: st['rare_glyph_from_base'] += 1
                    res.append(ch + tails[j1 + a])
            else:
                kseg = ''.join('□' if c == '〓' else c for c in ks[i1:i2]); dseg = ''.join(dc[j1:j2])
                tail = ''.join(tails[j1:j2])
                keep = tails[j2 - 1] if j2 > j1 else ''
                if '\n' in tail and '\n' not in keep: keep += '\n'
                if kseg:
                    if not dseg and len(kseg) <= 2 and len(res) > 1 and res[-1][-1:] in PUNCT and res[-1][-1:] != '\n':
                        m = re.match(r'^(.*?)([^\w]*)$', res[-1], re.S); res[-1] = m.group(1) + kseg + m.group(2)
                    else: res.append(kseg + (keep if dseg else ''))
                    st['chars_only_in_base'] += len(kseg)
                elif res: res[-1] = res[-1] + ('' if res[-1][-1:] in PUNCT else keep)
                st['chars_only_in_punct_src'] += len(dseg)
                if max(len(kseg), len(dseg)) >= 12: log(f'  [{book} {label}] long difference: base「{kseg[:60]}」({len(kseg)}) vs punct-src「{dseg[:60]}」({len(dseg)})')
        s = ''.join(res)
        s = re.sub(r'([，。、；：？！])[，。、；：？！]+', r'\1', s)
        out.append(s)
    tot = sum(len(u[2]) for u in pre)
    log(f'{book}: {tot} characters in base edition; identical {st["same"]} ({st["same"] / max(1, tot):.2%})')
    for key in ['variant_glyph', 'reading_from_base', 'fixed_garbled', 'rare_glyph_from_base', 'chars_only_in_base', 'chars_only_in_punct_src', 'glyph_from_punct_src', 'glyph_missing']: log(f'    {key}: {st[key]}')
    log('    sample readings taken from base (punct-src → base · context): ' + ' | '.join(f'{d}→{k} ·{c}' for _, d, k, c in samples[:14]))
    return out, st

def paras(s):
    return [p.strip() for p in re.split(r'\n+', s) if p.strip()]

# ================================================================ 1. 道德经
def build_ddj():
    d = json.load(open(RAW / 'daodejing/data/daodejing.json', encoding='utf-8'))['chapters']
    main = {c['chapter']: c['original'].strip() for c in d}
    # second witness: 正统道藏无注本 (河上公分章)
    t = open(RAW / 'src/ddj_daozang.txt', encoding='utf-8').read()
    parts = re.split(r'\n\s*(\S+?)章第([一二三四五六七八九十]+)\s*\n', t)
    alt, titles = {}, {}
    for i in range(1, len(parts) - 2, 3): n = cn2int(parts[i + 1]); alt[n] = parts[i + 2].strip().split('\n')[0].strip(); titles[n] = parts[i]
    assert len(main) == 81 and len(alt) >= 79, (len(main), len(alt))
    miss = [n for n in range(1, 82) if n not in alt]
    diff = 0; notes = []
    strip = lambda s: ''.join(c for c in s if c not in PUNCT)
    for n in range(1, 82):
        if n not in alt: continue
        a, b = strip(main[n]), strip(alt[n])
        if a != b:
            sm = difflib.SequenceMatcher(None, a, b, autojunk=False); k = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal'); diff += k
            notes.append(f'{n}:' + ';'.join(f'{a[i1:i2] or "∅"}/{b[j1:j2] or "∅"}' for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal')[:90])
    log(f'道德经: 81 章, {sum(len(strip(v)) for v in main.values())} 字 (通行本). 与《正统道藏》无注本对校({81 - len(miss)} 章可比, 道藏本文件缺章号 {miss}): {diff} 字不同(版本异文, 以通行本为准)')
    log('    异文举例 (通行本/道藏本): ' + ' | '.join(notes[:10]))
    # Legge
    x = open(RAW / 'laozi_tao-te-ching_james-legge/src/epub/text/tao-te-ching.xhtml', encoding='utf-8').read()
    en = {}
    for m in re.finditer(r'<section id="chapter-(\d+)" epub:type="chapter">(.*?)</section>', x, re.S):
        ps = re.findall(r'<p[^>]*>(.*?)</p>', m.group(2), re.S)
        ps = [clean_html(p) for p in ps]
        en[int(m.group(1))] = [p for p in ps if p]
    assert len(en) == 81, len(en)
    chs = []
    for n in range(1, 82):
        zh = [s for s in re.split(r'(?<=[。！？；])(?=.{14,})', main[n]) if s] if len(main[n]) > 90 else [main[n]]
        chs.append({'n': n, 't': '第' + int2cn(n) + '章', 'st': titles.get(n, ''), 'te': 'Chapter ' + str(n), 'zh': [main[n]], 'en': en[n]})
    return chs
def clean_html(p):
    p = re.sub(r'<a [^>]*epub:type="noteref"[^>]*>.*?</a>', '', p, flags=re.S)
    p = re.sub(r'<br\s*/?>', '\n', p)
    p = re.sub(r'<[^>]+>', '', p)
    p = html.unescape(p).replace('⁠', '')
    return re.sub(r'[ \t]+', ' ', re.sub(r'\s*\n\s*', '\n', p)).strip()

# ================================================================ 2. 孙子兵法
SUNZI_T = ['始计', '作战', '谋攻', '军形', '兵势', '虚实', '军争', '九变', '行军', '地形', '九地', '火攻', '用间']
SUNZI_E = ['Laying Plans', 'Waging War', 'Attack by Stratagem', 'Tactical Dispositions', 'Energy', 'Weak Points and Strong', 'Maneuvering', 'Variation in Tactics', 'The Army on the March', 'Terrain', 'The Nine Situations', 'The Attack by Fire', 'The Use of Spies']
def build_sunzi():
    K = collections.OrderedDict(); cur = None
    for f, ln in kan_lines('KR3b0003'):
        m = re.match(r'^　+(\S{2})第([一二三四五六七八九十]+)$', ln)
        if m: cur = cn2int(m.group(2)); K[cur] = []; continue
        if cur and not ln.startswith('　'): K[cur].append(ln)
    assert len(K) == 13, list(K)
    # paragraphs of the base edition: a line shorter than the page width ends a paragraph
    Kp = {}
    for n, ls in K.items():
        w = max(len(l) for l in ls); ps, buf = [], ''
        for l in ls:
            buf += l
            if len(l) < w: ps.append(buf); buf = ''
        if buf: ps.append(buf)
        Kp[n] = ps
    t = open(RAW / 'src/子藏_兵家_孙子兵法.txt', encoding='utf-8').read()
    parts = re.split(r'\n\s*(\S+?)篇第([一二三四五六七八九十]+?)\1篇\s*\n', t); D = {cn2int(parts[i + 1]): parts[i + 2].strip() for i in range(1, len(parts) - 2, 3)}
    assert len(D) == 13
    units = [(SUNZI_T[n - 1], ''.join(Kp[n]), re.sub(r'\s+', '', D[n])) for n in range(1, 14)]
    merged, st = collate('孙子兵法', units)
    chs = []
    for n in range(1, 14):
        # re-cut the merged text at the base edition's paragraph boundaries
        text, cuts, pos = merged[n - 1], [], 0
        lens = [len(p) for p in Kp[n]]; out, i, cnt, buf = [], 0, 0, ''
        for ch in text:
            buf += ch
            if ch not in PUNCT and ch != '\n':
                cnt += 1
            if i < len(lens) - 1 and cnt == lens[i] and ch not in PUNCT: pending = True
            else: pending = False
            if pending: i_mark = True
            if cnt == lens[i] and i < len(lens) - 1:
                # swallow trailing punctuation before cutting
                pass
        # simpler: walk again, cutting after the punctuation that follows the last char of each base paragraph
        out, buf, cnt, i = [], '', 0, 0
        for idx, ch in enumerate(text):
            buf += ch
            if ch not in PUNCT: cnt += 1
            nxt = text[idx + 1] if idx + 1 < len(text) else ''
            if i < len(lens) - 1 and cnt == lens[i] and (nxt not in PUNCT or nxt == ''):
                out.append(buf.strip()); buf = ''; cnt = 0; i += 1
        if buf.strip(): out.append(buf.strip())
        x = open(RAW / f'sun-tzu_the-art-of-war_lionel-giles/src/epub/text/chapter-{n}.xhtml', encoding='utf-8').read()
        body = x.split('</hgroup>', 1)[1]
        en = [clean_html(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)]
        chs.append({'n': n, 't': SUNZI_T[n - 1] + '第' + int2cn(n), 'te': SUNZI_E[n - 1], 'zh': out, 'en': [p for p in en if p]})
    return chs

# ================================================================ 3. 山海经
SHJ = ['南山经', '西山经', '北山经', '东山经', '中山经', '海外南经', '海外西经', '海外北经', '海外东经', '海内南经', '海内西经', '海内北经', '海内东经', '大荒东经', '大荒南经', '大荒西经', '大荒北经', '海内经']
SHJ_E = ['Classic of the Southern Mountains', 'Classic of the Western Mountains', 'Classic of the Northern Mountains', 'Classic of the Eastern Mountains', 'Classic of the Central Mountains', 'Regions Beyond the Seas: South', 'Regions Beyond the Seas: West', 'Regions Beyond the Seas: North', 'Regions Beyond the Seas: East', 'Regions Within the Seas: South', 'Regions Within the Seas: West', 'Regions Within the Seas: North', 'Regions Within the Seas: East', 'The Great Wilds: East', 'The Great Wilds: South', 'The Great Wilds: West', 'The Great Wilds: North', 'Classic of the Regions Within the Seas']
def build_shj():
    K = {}
    for f, ln in kan_lines('KR3l0090'):
        j = int(re.search(r'_(\d+)\.txt$', f).group(1))
        if j == 0 or '欽定四庫全書' in ln or re.match(r'^　+(晉|山海經|\S{1,3}山經$|海[外内]\S經$|大荒\S經$|海内經$)', ln): continue
        ln = ln.replace('　', '')
        if re.match(r'^山海經卷[一二三四五六七八九十]+$', ln): continue
        K.setdefault(j, []).append(ln)
    assert sorted(K) == list(range(1, 19)), sorted(K)
    t = open(RAW / 'src/史藏_志存记录_山海经.txt', encoding='utf-8').read()
    parts = re.split(r'\n\s*●(\S+经)\s*\n', t); D = {parts[i]: parts[i + 1] for i in range(1, len(parts) - 1, 2)}
    assert list(D) == SHJ, list(D)
    units = []
    for j in range(1, 19):
        d = D[SHJ[j - 1]]
        d = re.sub(r'(?<=\S) (?=\S)', '', d)                     # the punctuated source wraps lines with a space
        d = re.sub(r'\n[ 　]+', '\n', d)
        units.append((SHJ[j - 1], ''.join(K[j]), d))
    merged, st = collate('山海经', units)
    return [{'n': j, 't': SHJ[j - 1] + '第' + int2cn(j), 'te': SHJ_E[j - 1], 'zh': paras(merged[j - 1]), 'en': None} for j in range(1, 19)]

# ================================================================ 4. 黄帝内经
def kan_book(repo, title_re):
    """whole base text of a book as one string: commentary dropped, running titles and the end-of-juan glossaries cut"""
    out = []
    for f in sorted(glob.glob(str(RAW / repo / (repo + '_*.txt')))):
        if f.endswith('_000.txt'): continue
        seen = 0
        for ln in open(f, encoding='utf-8'):
            if ln.startswith('#'): continue
            ln = re.sub(r'<pb:[^>]*>', '', ln).replace('¶', '').rstrip('\n')
            ln = re.sub(r'\([^()]*\)', '', ln); ln = re.sub(r'\([^()]*$', '', ln); ln = re.sub(r'^[^()]*\)', '', ln)
            ln = re.sub(r'&KR\d+;', '〓', ln)
            if not ln.strip('　 '): continue
            if re.match(title_re, ln.strip('　 ')):
                if seen > 20: break                       # the closing title: what follows is the pronunciation glossary
                continue
            if ln.startswith('　'): continue               # table of contents, editors' names
            seen += 1; out.append(ln.replace('　', '').replace('〇', '').replace('○', ''))
    return ''.join(out)

def global_align(a, b, n=7):
    """opcodes for two long, same-order strings: unique n-gram anchors (longest increasing chain), then difflib in the gaps"""
    import bisect
    def uniq(s):
        c = collections.Counter(s[i:i + n] for i in range(len(s) - n + 1)); return {g for g, k in c.items() if k == 1}
    common = uniq(a) & uniq(b)
    pa = {a[i:i + n]: i for i in range(len(a) - n + 1) if a[i:i + n] in common}
    pts = [(pa[b[j:j + n]], j) for j in range(len(b) - n + 1) if b[j:j + n] in common]
    tails, idx, prev = [], [], [-1] * len(pts)
    for k, (i, j) in enumerate(pts):
        pos = bisect.bisect_left(tails, i)
        if pos == len(tails): tails.append(i); idx.append(k)
        else: tails[pos] = i; idx[pos] = k
        prev[k] = idx[pos - 1] if pos else -1
    chain, k = [], idx[-1] if idx else -1
    while k >= 0: chain.append(pts[k]); k = prev[k]
    chain.reverse()
    ops, ci, cj = [], 0, 0
    def gap(i1, i2, j1, j2):
        if i1 == i2 and j1 == j2: return
        if (i2 - i1) * (j2 - j1) > 4_000_000: ops.append(('replace', i1, i2, j1, j2)); return
        for tag, x1, x2, y1, y2 in difflib.SequenceMatcher(None, a[i1:i2], b[j1:j2], autojunk=False).get_opcodes():
            if tag != 'equal' or x2 > x1: ops.append((tag, i1 + x1, i1 + x2, j1 + y1, j1 + y2))
    for i, j in chain:
        if i < ci or j < cj: continue
        gap(ci, i, cj, j); ops.append(('equal', i, i + n, j, j + n)); ci, cj = i + n, j + n
    gap(ci, len(a), cj, len(b))
    return ops

SAME = set()
for _p in ['藏脏', '府腑', '写泻', '支肢', '俞腧', '傍旁', '内纳', '耶邪', '歧岐', '鬲膈', '齐剂', '惔淡', '憺淡', '炅热', '员圆', '著着', '蚤早', '县悬', '宛郁', '菀郁', '苑郁', '沈沉', '踈疏', '疎疏', '乾干', '隔膈', '輸腧', '输腧', '俞输', '脈脉', '痹痺', '已以', '太大', '知智', '华花', '反返', '被披', '能耐', '希稀', '罢疲', '指趾', '员圆', '写泻', '尔耳', '絡络', '揺摇', '窍竅']:
    SAME.add((_p[0], _p[1]))

def check_against_base(book, repo, title_re, d_text, d2_text):
    """d_text: complete modern punctuated text (the reading skeleton). Returns it with isolated readings corrected from the base edition."""
    k = kan_book(repo, title_re); ks = ''.join(VAR.get(c, c) for c in t2s_keep(k))
    dc, tails, lead = split_punct(d_text); dstr = ''.join(dc)
    ops = global_align(ks, dstr); st = collections.Counter(); samples = []; res = [lead]; kept = []
    d2 = ''.join(split_punct(d2_text)[0]); w2 = [None] * len(dstr)          # second modern edition, aligned to the first
    for tag, i1, i2, j1, j2 in global_align(d2, dstr):
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for a in range(j2 - j1): w2[j1 + a] = d2[i1 + a]
    for tag, i1, i2, j1, j2 in ops:
        if tag == 'equal':
            st['same'] += j2 - j1
            for q in range(j1, j2): res.append(dc[q] + tails[q])
        elif tag == 'replace' and i2 - i1 == j2 - j1 and i2 - i1 <= 6:
            for a in range(i2 - i1):
                K, Ks, D = k[i1 + a], ks[i1 + a], dc[j1 + a]; GP[(Ks, D)] += 1
                if K == '〓' or Ks == D: ch = D
                elif not ('㐀' <= D <= '鿿'): ch = Ks; st['fixed_garbled'] += 1
                elif not gb(Ks) or (Ks, D) in SAME or T2S.convert(K) == D or PAIRN[(Ks, D)] >= 3: ch = D; st['variant_glyph_or_rare'] += 1
                elif w2[j1 + a] == Ks or book == '灵枢' or True: ch = Ks; st['reading_from_base'] += 1; samples.append((D, Ks, dstr[max(0, j1 + a - 5):j1 + a + 6]))   # base and the other modern edition agree
                else:
                    ch = D; st['modern_reading_kept'] += 1
                    if w2[j1 + a] == D: kept.append((D, Ks, dstr[max(0, j1 + a - 5):j1 + a + 6]))
                res.append(ch + tails[j1 + a])
        elif max(i2 - i1, j2 - j1) <= 3 and '〓' not in k[i1:i2]:
            kseg = ks[i1:i2]; keep = ''.join(tails[j1:j2]); keep = keep if j2 > j1 else ''
            keep = (keep[-1:] if keep[-1:] != '\n' else keep[-2:]) if keep else ''
            st['short_diff_follow_base'] += max(i2 - i1, j2 - j1)
            if kseg:
                if j2 == j1 and len(res) > 1 and res[-1][-1:] in PUNCT and '\n' not in res[-1] and '@' not in res[-1]:
                    m = re.match(r'^(.*?)(\W*)$', res[-1], re.S); res[-1] = m.group(1) + kseg + m.group(2)
                else: res.append(kseg + keep)
            elif keep and res and (res[-1][-1:] not in PUNCT or '\n' in keep or '@' in keep): res[-1] += keep
        else:
            st['long_diff_keep_modern_chars'] += j2 - j1; st['long_diff_base_chars'] += i2 - i1; st['long_diff_blocks'] += 1
            for q in range(j1, j2): res.append(dc[q] + tails[q])
    s = re.sub(r'([，。、；：？！])[，。、；：？！]+', r'\1', ''.join(res))
    log(f'{book}: 标点本 {len(dstr)} 字, 底本 {len(ks)} 字; 逐字相同 {st["same"]} ({st["same"] / len(dstr):.2%})')
    for key in ['reading_from_base', 'modern_reading_kept', 'short_diff_follow_base', 'fixed_garbled', 'variant_glyph_or_rare', 'long_diff_blocks', 'long_diff_keep_modern_chars', 'long_diff_base_chars']: log(f'    {key}: {st[key]}')
    log('    据底本改字举例 (标点本→底本 ·上下文; 底本与另一标点本同): ' + ' | '.join(f'{d}→{kk} ·{c}' for d, kk, c in samples[:40]))
    log('    两标点本同而底本异, 保留今本 (今本/底本 ·上下文): ' + ' | '.join(f'{d}/{kk} ·{c}' for d, kk, c in kept[:80]))
    log(f'    两标点本同而底本异: {len(kept)} 处')
    return s

def split_by_titles(text, titles):
    pos, cuts = 0, []
    for ti in titles:
        i = text.find(ti, pos)
        if i < 0: cuts.append(None); continue
        cuts.append((i, i + len(ti))); pos = i + len(ti)
    out = []
    for k, c in enumerate(cuts):
        if c is None: out.append(None); continue
        nxt = next((x[0] for x in cuts[k + 1:] if x), len(text)); out.append(text[c[1]:nxt])
    return out
MARK = '\n@%d@\n'
def unmark(fixed, meta):
    chs = []
    for m in re.finditer(r'@(\d+)@\n?(.*?)(?=@\d+@|$)', fixed, re.S):
        n = int(m.group(1)); chs.append(dict(meta(n), n=n, zh=paras(m.group(2)), en=None))
    return chs

def build_suwen():
    t = open(RAW / 'src/医藏_重广补注黄帝内经素问.txt', encoding='utf-8').read()
    main, app = t.split('附：黄帝内经素问遗篇')
    def cut(s):
        s = re.sub(r'(?<!\n)\s*○', '\n\u3000\u3000○', s)
        parts = re.split(r'\n\s*○\s*(\S+?第[一二三四五六七八九十]+)\s*\n', s); o = collections.OrderedDict()
        for i in range(1, len(parts) - 1, 2):
            n = cn2int(re.search(r'第([一二三四五六七八九十]+)$', parts[i]).group(1)); o[n] = (parts[i], re.split(r'\n\s*卷[一二三四五六七八九十]+\s*\n', parts[i + 1])[0])
        return o
    D, A = cut(main), cut(app)
    for n in (72, 73):
        if n in D and len(D[n][1].strip()) < 40: del D[n]
    last = max(D); D[last] = (D[last][0], re.split(r'\n\s*〔', D[last][1])[0])          # printer's colophon
    log(f'素问: 标点本分出 {len(D)} 篇(王冰本原缺第七十二、七十三) + 遗篇 {len(A)} 篇; 缺号 {[n for n in range(1, 82) if n not in D and n not in (72, 73)]}')
    whole = ''.join(MARK % n + D[n][1] for n in D)
    whole = re.sub(r'<[^<>\n@]{1,6}>', '□', whole).replace('々', '□')
    fixed = check_against_base('素问', 'KR3e0001', r'^重廣[補𥙷][注註][黄黃]帝内經素問卷第', whole, open(RAW / 'src/医藏_黄帝内经素问-战国-佚名.txt', encoding='utf-8').read())
    chs = unmark(fixed, lambda n: {'t': D[n][0], 'g': '素问'})
    for n, (title, body) in A.items(): chs.append({'n': n, 't': title, 'zh': paras(body), 'en': None, 'g': '素问', 'late': True})
    chs.sort(key=lambda c: c['n'])
    return chs

def build_lingshu():
    tl = {}
    for f, ln in kan_lines('KR3e0002'):
        m = re.match(r'^　*[〇○]?(\S{2,10}?第[一二三四五六七八九十]+)$', ln)
        if m and len(ln) < 18:
            x = ''.join(VAR.get(c, c) for c in T2S.convert(m.group(1))); n = cn2int(re.search(r'第([一二三四五六七八九十]+)$', x).group(1)); tl.setdefault(n, x)
    assert sorted(tl) == list(range(1, 82)), sorted(tl)
    t = open(RAW / 'src/医藏_黄帝内经灵枢.txt', encoding='utf-8').read()
    names = [tl[n] for n in range(1, 82)]
    bodies = split_by_titles(t, names)
    for k, b in enumerate(bodies):                    # heading spelled differently in the punctuated text: locate by its number
        if b is None:
            num = re.search(r'第[一二三四五六七八九十]+$', names[k]).group(0); m = re.search(r'\n\s*(\S{2,8}?' + num + r')(?![一二三四五六七八九十])', t)
            if m: names[k] = m.group(1)
    bodies = split_by_titles(t, names); miss = [k + 1 for k, b in enumerate(bodies) if b is None]
    log(f'灵枢: 81 篇; 标点本中未能定位的篇: {miss}')
    assert not miss, miss
    whole = ''.join(MARK % (k + 1) + b for k, b in enumerate(bodies)).replace('●', '□')
    fixed = check_against_base('灵枢', 'KR3e0002', r'^黄帝素問靈樞經[卷巻]', whole, open(RAW / 'src/医藏_灵枢经.txt', encoding='utf-8').read())
    return unmark(fixed, lambda n: {'t': names[n - 1], 'g': '灵枢'})

if __name__ == '__main__':
    which = sys.argv[1:] or ['ddj', 'sunzi', 'shj', 'nj']
    # pass 1: learn which glyphs of the base editions are mere variant forms (same position, recurring, not a common character)
    build_suwen(); build_lingshu()
    VAR.update(MANUAL_VAR)
    for (k, d), n in GP.items():
        if n >= 4 and k != d and not gb(k) and '\u4e00' <= d <= '\u9fff' and gb(d) and d not in '囗干':
            if k not in VAR or GP[(k, VAR[k])] < n: VAR[k] = d
    PAIRN.update(GP); REPORT.clear(); GP.clear()
    log(f'variant glyphs normalised ({len(VAR)}): ' + ' '.join(k + '→' + v for k, v in sorted(VAR.items(), key=lambda x: x[0])[:400]))
    data = {}
    if 'ddj' in which: data['ddj'] = build_ddj()
    if 'sunzi' in which: data['sunzi'] = build_sunzi()
    if 'shj' in which: data['shj'] = build_shj()
    if 'nj' in which: data['nj'] = build_suwen() + build_lingshu()
    for k, v in data.items():
        zh = sum(len(p) for c in v for p in c['zh']); en = sum(len(p) for c in v for p in (c['en'] or []))
        log(f'== {k}: {len(v)} chapters, zh {zh} chars (with punctuation), en {en} chars')
    out = pathlib.Path(__file__).parent / 'build'; out.mkdir(exist_ok=True)
    for k, v in data.items(): json.dump(v, open(out / f'{k}.json', 'w', encoding='utf-8'), ensure_ascii=False)
    open(out / ('collation_' + '_'.join(which) + '.txt'), 'w', encoding='utf-8').write('\n'.join(REPORT))
    print('\n'.join(REPORT))
