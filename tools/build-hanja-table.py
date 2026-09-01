# -*- coding: utf-8 -*-
"""build-hanja-table.py — 한글 음절 → 한자 후보 표를 만든다.

    python tools/build-hanja-table.py [Unihan.zip 또는 Unihan_Readings.txt]

원본은 **Unicode 배포판의 `Unihan_Readings.txt`** 다(`kHangul` 항목).
⛔ `C:\\Windows\\IME\\IMEKR\\DICTS\\imkrhjd.lex` 를 쓰지 마라 — 같은 표를 갖고 있지만
   **마이크로소프트 파일이라 배포본에 넣을 수 없다.** Unicode 자료는 재배포가 자유롭다.

훈(뜻)은 **libhangul 의 `hanja.txt`**(BSD 3-clause)에서 가져온다. 없으면 뜻 없이 만든다.

만들어지는 것: `engine/hanja-table.js`
  HANJA_MAP     음절 → 한자를 이어 붙인 한 줄(교육용이 앞)
  HANJA_SURNAME 음절 → 성 칸에서만 맨 앞으로 당길 성씨 한자
  HANJA_MEAN    한자 → 훈음(「긴 장」). 없는 글자는 아예 담지 않는다.

📌 **후보 범위 = 대법원 계열**(2026.09.01 결정 — 「이름에 쓰지 않는 한자는 필요 없다」).
     ① `kKoreanEducationHanja` 교육용 기초한자 **1,800자**
     ② `kKoreanName`          인명용 한자      **6,367자**(2015)
   ①∪② 에 **드는 글자만** 후보에 낸다. 순서는 ① → ②, 그 안에서 상용(KS X 1001)·획수 순.

⚠️ **글자 단위로 거른다 — 읽기 단위로 거르지 마라.**
   `kHangul` 값에 읽기별 표시가 붙어 있지만(`車 → 거:0E 차:0N`), 그것으로 거르면
   **`李(이)` 가 사라진다.** 인명용 한자표는 `리` 로만 싣고 두음법칙은 주석으로 따로 정한다
   (「첫소리가 ㄴ·ㄹ 인 한자는 ㅇ·ㄴ 으로도 쓸 수 있다」). 같은 이유로 `羅(나)`·`柳(유)`·
   `盧(노)`·`呂(여)`·`梁(양)` 등 227짝이 함께 날아간다.

📌 이 제한은 **호환 한자 중복도 함께 없앤다.** KS X 1001 은 음이 둘인 한자를 두 번
   부호화해서(`狀` U+72C0 / U+F9FA), 걸러내기 전에는 **모양이 같은 글자가 한 음절에 두 번**
   나왔다(268건). 호환 한자에는 ①② 표시가 하나도 없어 이 제한만으로 정리된다.
"""
import io
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "engine", "hanja-table.js")

# ── 성씨 한자 ────────────────────────────────────────────────────────────────
# 음절 → 그 음으로 쓰는 **성씨** 한자(흔한 순). 화면은 **성 칸에서만** 이것을 맨 앞에 놓는다.
# 격자가 성/이름 경계를 알고 있어서 가능한 일이다 — 이름 칸에는 적용하지 않는다.
#
# ⚠️ 이 표가 필요한 이유: 교육용 기초한자에 성씨 글자가 대부분 빠져 있어서, 순서만으로는
#    「최」의 첫 후보가 `催`, 「강」이 `剛` 이 된다. 성 칸에서 성씨가 뒤에 있으면 못 쓴다.
# 📌 뒤쪽 몇 줄은 **복성(두 글자 성)의 뒷글자**다 — 제갈 `葛` · 남궁 `宮` 처럼,
#    그 음절이 성 자리에 올 수 있는 유일한 경우다.
# ⛔ 이것은 **순서**일 뿐이다. 여기 없는 성씨도 목록에는 그대로 있고 고를 수 있다.
SURNAME = {
    "김": "金", "이": "李", "박": "朴", "최": "崔", "정": "鄭丁程",
    "강": "姜康強", "조": "趙曺", "윤": "尹", "장": "張蔣", "임": "林任",
    "한": "韓", "오": "吳", "서": "徐西", "신": "申辛愼", "권": "權",
    "황": "黃皇", "안": "安", "송": "宋", "류": "柳", "유": "柳劉兪",
    "전": "全田錢", "홍": "洪", "고": "高孤", "문": "文門", "양": "梁楊",
    "손": "孫", "배": "裵", "백": "白", "허": "許", "남": "南",
    "심": "沈", "노": "盧魯", "하": "河", "곽": "郭", "성": "成",
    "차": "車", "주": "朱周", "우": "禹于", "구": "具丘", "민": "閔",
    "나": "羅", "진": "陳秦晉", "지": "池", "엄": "嚴", "채": "蔡",
    "원": "元", "천": "千", "방": "方房", "공": "孔空", "현": "玄",
    "함": "咸", "변": "卞邊", "염": "廉", "여": "呂", "추": "秋",
    "도": "都", "소": "蘇", "석": "石", "선": "宣鮮", "설": "薛",
    "마": "馬", "길": "吉", "연": "延", "위": "魏", "표": "表",
    "명": "明", "기": "奇", "반": "潘", "왕": "王", "금": "琴",
    "옥": "玉", "육": "陸", "인": "印", "맹": "孟", "제": "諸",
    "모": "牟", "사": "司", "봉": "奉", "탁": "卓", "국": "鞠",
    # 복성의 뒷글자 — 제갈 葛 · 남궁 宮 · 황보 甫 · 선우 于 · 사공 空 · 서문 門 · 독고 孤
    "갈": "葛", "궁": "宮", "보": "甫", "독": "獨",
}


def read_source(arg, member="Unihan_Readings.txt"):
    """zip 이든 txt 든 해당 파일의 내용을 돌려준다."""
    if arg.lower().endswith(".zip"):
        with zipfile.ZipFile(arg) as z:
            return z.read(member).decode("utf-8")
    return io.open(arg, encoding="utf-8").read()


LIBHANGUL_NOTICE = (
    "libhangul hanja.txt — Copyright (c) 2005,2006 Choe Hwanjin. All rights reserved.\n"
    "   BSD 3-Clause License. 원본의 저작권 표시·조건·면책을 함께 배포해야 한다 —\n"
    "   그래서 이 주석을 지우면 안 된다(생성물에 자료가 들어 있다)."
)


def read_meaning():
    """훈음 표(있으면). 두 형식을 받는다.

         libhangul `hanja.txt` :  음:한자:훈음        (`가:可:옳을 가`)
         손으로 만든 표         :  한자<탭>훈<탭>음

    ⚠️ **Unihan 에는 한국어 뜻이 없다**(음 `kHangul` 과 영어 `kDefinition` 뿐이고,
       윈도우 IME 사전에도 없다). 그래서 이 표는 **밖에서 가져와야** 한다.
    ⚠️ libhangul 파일은 **단어 항목이 27만 줄**로 대부분이다 — 한 글자짜리만 쓴다.
    📌 훈은 **손대지 않고 그대로** 싣는다(2026.09.01 결정 — 「다 보여주자」).
       `將 → 장차 장, 장수 장` 처럼 여럿이면 여럿 그대로, `鵞 → 鵝와 同字` 같은
       참조형도 그대로다. ⛔ 쉼표 앞만 잘라 내지 마라.
    📌 같은 한자가 음마다 훈이 다르면(`長 길 장` / `長 어른 장`) **먼저 나온 것**을 쓴다 —
       화면은 한자 하나에 안내 한 줄이라 음별로 갈라 담을 자리가 없다.
    """
    p = os.path.join(ROOT, "hanja.txt")
    if os.path.exists(p):
        out = {}
        for line in io.open(p, encoding="utf-8"):
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            f = line.split(":", 2)
            if len(f) != 3 or len(f[0]) != 1 or len(f[1]) != 1:
                continue                       # 단어 항목은 버린다
            if f[2].strip():
                out.setdefault(f[1], f[2].strip())
        return out, "hanja.txt (libhangul)"
    p = os.path.join(ROOT, "hanja-meaning.txt")
    if os.path.exists(p):
        out = {}
        for line in io.open(p, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            f = line.split("\t")
            if len(f) < 2 or len(f[0]) != 1:
                continue
            out[f[0]] = " ".join(x.strip() for x in f[1:] if x.strip())
        return out, "hanja-meaning.txt"
    return {}, None


def marked(text, field):
    """`kKoreanName` 처럼 **있으면 그 무리에 든다**는 표시 항목을 글자 집합으로."""
    return set(chr(int(cp, 16))
               for cp in re.findall(r"^U\+([0-9A-F]+)\t" + field + r"\t", text, re.M))


def is_common(ch):
    """KS X 1001(=euc-kr) 에 있는 한자인가 — 상용한자 4,888자의 판정."""
    try:
        ch.encode("euc-kr")
        return True
    except UnicodeEncodeError:
        return False


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "Unihan.zip")
    if not os.path.exists(src):
        sys.exit("원본이 없습니다: %s\n  unicode.org 의 Unihan.zip 을 받아 두십시오." % src)

    text = read_source(src)
    # 보기: `U+4E00\tkHangul\t일:0`  ·  음이 여럿이면 공백으로 나뉜다(金 → 금:0 김:0)
    rows = re.findall(r"^U\+([0-9A-F]+)\tkHangul\t(.+)$", text, re.M)
    if not rows:
        sys.exit("kHangul 항목을 찾지 못했습니다. Unihan_Readings.txt 가 맞는지 확인하세요.")

    # 대법원 계열 — **후보의 범위**다(순서가 아니라 범위. 위 머리말 참조)
    other = read_source(src, "Unihan_OtherMappings.txt") if src.lower().endswith(".zip") else ""
    edu = marked(other, "kKoreanEducationHanja")   # 교육용 기초한자 1,800자
    name = marked(other, "kKoreanName")            # 인명용 한자 6,367자(2015)
    court = edu | name
    if not court:
        sys.exit("대법원 계열 표시를 찾지 못했습니다. Unihan.zip(전체)을 주십시오 — "
                 "`Unihan_OtherMappings.txt` 가 있어야 후보 범위를 정할 수 있습니다.")

    # 획수 — 같은 무리 안에서 **획이 적은 글자를 먼저** 놓는다.
    # 📌 Unihan 에 한국어 사용빈도 자료는 없다. 획수는 그 대신 쓰는 어림이다 —
    #    흔히 쓰는 글자가 대체로 획이 적다(수: 手 水 秀 … 가 修 受 垂 보다 앞으로 온다).
    # ⛔ 이것을 「자주 쓰는 순」이라고 **화면에 적지 마라** — 근거가 빈도가 아니다.
    irg = read_source(src, "Unihan_IRGSources.txt") if src.lower().endswith(".zip") else ""
    strokes = {}
    for cp, val in re.findall(r"^U\+([0-9A-F]+)\tkTotalStrokes\t(\d+)", irg, re.M):
        strokes[chr(int(cp, 16))] = int(val)

    def rank(ch):
        """작을수록 앞. 교육용 → 인명용 → 나머지, 그 안에서 상용 먼저 · 획 적은 것 먼저."""
        return (0 if ch in edu else 1, 0 if is_common(ch) else 1, strokes.get(ch, 99), ch)

    buckets = {}
    skipped = 0
    for cp, val in rows:
        ch = chr(int(cp, 16))
        if ch not in court:                   # ⛔ 대법원 계열 밖은 후보에 넣지 않는다
            skipped += 1
            continue
        for tok in val.split():
            syl = tok.split(":")[0]          # `온:N` → `온` (뒤는 출처 표시)
            if not ("\uac00" <= syl <= "\ud7a3"):
                continue                      # 한글 음절이 아닌 값은 버린다
            buckets.setdefault(syl, set()).add(ch)

    table = {}
    for syl in sorted(buckets):
        table[syl] = "".join(sorted(buckets[syl], key=rank))

    mean_all, mean_src = read_meaning()
    inuse = set("".join(table.values()))
    mean = dict((c, m) for c, m in mean_all.items() if c in inuse)

    # 성씨 표는 **표에 실제로 있는 글자만** 남긴다 — 오타가 있으면 여기서 드러난다
    sur_out, dropped = {}, []
    for syl, chars in SURNAME.items():
        keep = "".join(c for c in chars if c in table.get(syl, ""))
        for c in chars:
            if c not in table.get(syl, ""):
                dropped.append(syl + c)
        if keep:
            sur_out[syl] = keep

    dump = lambda o: json.dumps(o, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    body = (
        "/*HANJA-TABLE v1*/\n"
        "/* 한글 음절 → 한자 후보. `tools/build-hanja-table.py` 가 만든다.\n"
        "   ⛔ 손으로 고치지 마라 — 다음 생성에 덮인다.\n"
        "\n"
        "   범위: **대법원 계열만** — 교육용 기초한자 ∪ 인명용 한자.\n"
        "         ⛔ 이름에 쓸 수 없는 한자는 담지 않는다(2026.09.01 결정).\n"
        "   순서: 교육용 → 인명용, 그 안에서 상용(KS X 1001) 먼저 · 획 적은 것 먼저.\n"
        "         ⛔ 화면에서 「자주 쓰는 순」이라고 부르지 마라 — 근거가 빈도가 아니다.\n"
        "   HANJA_SURNAME 은 **성 칸에서만** 맨 앞으로 당길 성씨 한자(순서일 뿐 거르지 않는다).\n"
        "   HANJA_MEAN 은 훈음(「긴 장」). 없는 글자는 담지 않는다 — 화면이 한자만 보여 준다.\n"
        "\n"
        "   출처 ① Unicode Character Database (Unihan) — 음·교육용·인명용·획수\n"
        "   출처 ② %s */\n"
        "var HANJA_MAP=%s;\n"
        "var HANJA_SURNAME=%s;\n"
        "var HANJA_MEAN=%s;\n"
    ) % (LIBHANGUL_NOTICE if mean else "(훈음 자료 없음)",
         dump(table), dump(sur_out), dump(mean))

    io.open(OUT, "w", encoding="utf-8", newline="\n").write(body)

    print("✓ %s" % os.path.relpath(OUT, ROOT))
    print("  후보 한자 %d자 · 음절 %d개 · %.1f KB   (대법원 계열 밖 %d자 제외)"
          % (len(inuse), len(table), len(body.encode("utf-8")) / 1024.0, skipped))
    big = sorted(table.items(), key=lambda kv: -len(kv[1]))[:5]
    print("  후보가 많은 음절: " + " · ".join("%s(%d)" % (k, len(v)) for k, v in big))
    print("  성씨 표: %d 음절" % len(sur_out))
    if mean_src:
        print("  훈음 표: %d자  (%s)" % (len(mean), mean_src))
    else:
        print("  훈음 표: **없음** — libhangul `hanja.txt` 를 리포 루트에 두면 뜻이 붙습니다")
    if dropped:
        # 표에 없는 한자를 성씨로 적어 두면 조용히 무시된다 — 오타일 수 있으므로 알린다
        print("  ⚠️ 표에 없어 뺀 성씨: " + " ".join(dropped))


if __name__ == "__main__":
    main()
