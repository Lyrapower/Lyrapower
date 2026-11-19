# v1.2 additions: 庄子 / 周易 / 史记选篇
import re, json, pathlib, collections, difflib, opencc
RAW = pathlib.Path('raw'); OUT = pathlib.Path('build'); T2S = opencc.OpenCC('t2s')
CN = '零一二三四五六七八九十'
def int2cn(n): return CN[n] if n <= 10 else ('十' + CN[n % 10] if n < 20 else CN[n // 10] + '十' + (CN[n % 10] if n % 10 else ''))
def cn2int(s):
    t = cur = 0
    for ch in s:
        if ch in CN[:10]: cur = CN.index(ch)
        elif ch == '十': t += (cur or 1) * 10; cur = 0
        elif ch == '百': t += (cur or 1) * 100; cur = 0
    return t + cur
han = lambda s: ''.join(c for c in s if '㐀' <= c <= '鿿' or ord(c) > 0x1ffff)
LOG = []
def log(s): LOG.append(s); print(s)

# ---------------------------------------------------------------- 庄子 (text + Legge, paragraph-aligned)
def build_zz():
    D = RAW / 'new_Zhuangzi/Zhuangzi'; chs = []
    dz = han(open(RAW / 'src/new_庄子.txt', encoding='utf-8').read())
    tot = same = 0
    for n in range(1, 34):
        def rd(ext):
            L = [l.strip() for l in open(D / f'Chapter_{n:02d}.{ext}', encoding='utf-8').read().split('\n')]; L = [l for l in L if l and l != 'x']; return L[0], L[1:]
        zt, zp = rd('zh.zhuangzi'); et, ep = rd('en.legge'); assert len(zp) == len(ep), (n, len(zp), len(ep))
        zh, en = [], []
        for a, b in zip(zp, ep):
            a = T2S.convert(a); a = re.sub(r'\s*/\s*', '', a); a = re.sub(r'\s+', '', a); b = re.sub(r'\s*/\s*', ' ', b).strip()
            zh.append(a); en.append(b)
        t = T2S.convert(zt); g = '内篇' if n <= 7 else '外篇' if n <= 22 else '杂篇'
        chs.append({'n': n, 't': f'{t}第{int2cn(n)}', 'te': et, 'g': g, 'zh': zh, 'en': en})
        h = han(''.join(zh)); tot += len(h)
    mine = han(''.join(''.join(c['zh']) for c in chs)); sm = difflib.SequenceMatcher(None, mine[:60000], dz[:61000], autojunk=False)
    same = sum(b.size for b in sm.get_matching_blocks())
    log(f'庄子: 33 篇, {tot} 字; 中英段落逐段对齐. 与《道藏》本标点文本前 6 万字对校: 相同 {same} ({same / 60000:.2%})')
    return chs

# ---------------------------------------------------------------- 周易
TRI = {'乾': '111', '坤': '000', '震': '100', '巽': '011', '坎': '010', '离': '101', '艮': '001', '兑': '110'}
def build_yi():
    L = [l.strip('　 \r') for l in open(RAW / 'src/new_周易.txt', encoding='utf-8').read().split('\n')]
    heads = [(i, m) for i, l in enumerate(L) for m in [re.match(r'^(\d\d)[.．] ?(\S+?)（卦(.+?)）$', l)] if m]
    assert len(heads) == 64, len(heads)
    tails = {}
    for name in ['系辞上', '系辞下', '说卦', '序卦', '杂卦']:
        idx = [i for i, l in enumerate(L) if (l == name or (name == '系辞上' and l == '系辞')) and i > 100]; assert len(idx) == 1, (name, idx); tails[name] = idx[0]
    def paras(lines):
        out = []
        for l in lines:
            if not l or re.fullmatch(r'[ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ\W_a-zA-Z0-9]*', l): continue
            if out and not re.search(r'[。？！”’」；：）]$', out[-1]): out[-1] += l
            else: out.append(l)
        fixed = []
        for p in out:
            p = p.replace('\ue0b3', '卼').replace('嗃々', '嗃嗃').replace('，“噬干胏', '，噬干胏').replace('柔顺利贞。君子。君子攸行', '柔顺利贞。君子攸行')
            fixed += [s for s in re.split(r'(?<=.)(?=《[彖象]》曰)', p) if s]          # a statement glued to the commentary that follows it
        return fixed
    chs = []; ends = [h[0] for h in heads[1:]] + [tails['系辞上']]
    for (i, m), e in zip(heads, ends):
        body = [l for l in L[i + 1:e] if l not in ('上经', '下经')]; ps = paras(body)
        tm = re.search(r'（(\S)下(\S)上）', ''.join(ps[:2])); assert tm, (m.group(2), ps[:2])
        hx = TRI[tm.group(1)] + TRI[tm.group(2)]; n = int(m.group(1))
        ps = [p for p in ps if not re.fullmatch(r'.{0,3}（\S下\S上）', p)]
        chs.append({'n': n, 't': f'{m.group(2)}卦第{int2cn(n)}', 'nm': m.group(2), 'hx': hx, 'lo': tm.group(1), 'up': tm.group(2), 'g': '上经' if n <= 30 else '下经', 'zh': ps})
    names = list(tails); bounds = [tails[k] for k in names] + [len(L)]
    for k, name in enumerate(names):
        ps = paras(L[bounds[k] + 1:bounds[k + 1]])
        if name == '系辞上': assert ps[0].startswith('上天尊地卑'), ps[0][:10]; ps[0] = ps[0][1:]      # the source glued the heading's 上 onto the text
        chs.append({'n': 65 + k, 't': name, 'g': '易传', 'zh': ps})
    assert len({c['hx'] for c in chs[:64]}) == 64
    q = chs[0]['zh']; assert q[0].startswith('《乾》：元，亨，利，贞') and any('天行健，君子以自强不息' in p for p in q), q[:3]
    assert any('一阴一阳之谓道' in p for p in chs[64]['zh'])
    for c in chs[:64]: assert sum(1 for p in c['zh'] if re.match(r'^(初|九|六|上)[九六二三四五][：，]', p)) == 6, (c['t'], c['zh'][:9])
    log(f'周易: 64 卦 + 易传 5 篇(系辞上下、说卦、序卦、杂卦), {sum(len(han("".join(c["zh"]))) for c in chs)} 字; 每卦 6 爻齐全, 64 个卦画互不重复')
    return chs

# ---------------------------------------------------------------- 史记选篇
PICK = [('货殖列传', 'Biographies of the Money-makers', '商战实录：范蠡、白圭、子贡'), ('越王句践世家', 'The Hereditary House of King Goujian of Yue', '卧薪尝胆；范蠡功成身退'), ('留侯世家', 'The Hereditary House of the Marquis of Liu (Zhang Liang)', '运筹帷幄的张良'),
        ('淮阴侯列传', 'Biography of the Marquis of Huaiyin (Han Xin)', '韩信：从胯下到拜将到钟室'), ('项羽本纪', 'Basic Annals of Xiang Yu', '破釜沉舟、鸿门宴、垓下'), ('刺客列传', 'Biographies of the Assassins', '曹沫、专诸、豫让、聂政、荆轲'), ('太史公自序', "The Grand Historian's Own Preface", '司马迁为什么写这本书')]
def build_sj():
    L = open(RAW / 'src/new_史记.txt', encoding='utf-8').read().split('\n')
    hd = [(i, m.group(1), m.group(2)) for i, l in enumerate(L) for m in [re.match(r'^\s*卷([一二三四五六七八九十百]+) (\S+?第[一二三四五六七八九十]+)\s*$', l)] if m and i > 134]
    chs = []
    START = {'刺客列传': '曹沫者，鲁人也', '太史公自序': '昔在颛顼'}        # these two have no heading line in the source body: located by their opening words
    first = {k: next(i for i, l in enumerate(L) if l.startswith(v)) for k, v in START.items()}
    cuts = sorted([h[0] for h in hd] + list(first.values()) + [len(L)])
    full = {'刺客列传': ('八十六', '刺客列传第二十六'), '太史公自序': ('一百三十', '太史公自序第七十')}
    for name, en, note in PICK:
        if name in first: a = first[name] - 1; juan, title = full[name]
        else: k = next(j for j, h in enumerate(hd) if h[2].startswith(name)); a = hd[k][0]; juan, title = hd[k][1], hd[k][2]
        b = next(c for c in cuts if c > a + 1)
        ps = [re.sub(r'\s+', '', l).replace('於', '于').replace('，\ue837史记石室金匮之书', '，紬史记石室金匮之书') for l in L[a + 1:b]]; ps = [p for p in ps if p]      # one glyph the source could not encode: 紬
        assert not re.search('[\ue000-\uf8ff]', ''.join(ps)), name
        chs.append({'n': len(chs) + 1, 't': title, 'te': en, 'note': note, 'juan': cn2int(juan), 'zh': ps}); log(f'  史记·{title} (卷{cn2int(juan)}): {len(ps)} 段, {len(han("".join(ps)))} 字; 首「{ps[0][:12]}」尾「{ps[-1][-14:]}」')
    t = ''.join(''.join(c['zh']) for c in chs)
    for s in ['天下熙熙，皆为利来', '决胜千里外', '风萧萧兮易水寒', '力拔山兮气盖世', '狡兔死，良狗亨', '罔罗天下放失旧闻']: assert s in t or s.replace('亨', '烹') in t, s
    return chs

if __name__ == '__main__':
    for k, f in [('zz', build_zz), ('yi', build_yi), ('sj', build_sj)]:
        chs = f(); json.dump(chs, open(OUT / f'{k}.json', 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'== {k}: {len(chs)} chapters, zh {sum(len("".join(c["zh"])) for c in chs)} chars, en {sum(len(" ".join(c.get("en") or [])) for c in chs)} chars')
    open(OUT / 'run2.log', 'w', encoding='utf-8').write('\n'.join(LOG))
