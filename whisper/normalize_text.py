"""
한국어 전사 텍스트 정규화 유틸
AI Hub 107번·94번 공통 사용
"""

import re
import unicodedata

# AI Hub 발화 노이즈 마커 패턴
_NOISE_TAG = re.compile(
    r"\(noise\)|\(laugh\)|\(cough\)|\(breath\)|\(unclear\)|"
    r"\+|\*|/|\[.*?\]|\{.*?\}|<.*?>",
    re.IGNORECASE,
)

# 한국어·숫자·기본 문장부호 이외 문자 제거
_NON_KO = re.compile(r"[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\s\d,.?!]")

# 연속 공백 → 단일 공백
_MULTI_SPACE = re.compile(r"\s{2,}")


def normalize(text: str) -> str:
    """
    전처리 순서:
    1. NFC 유니코드 정규화 (자모 분리 방지)
    2. 노이즈 태그 제거
    3. 한국어·숫자·기본 문장부호 외 제거
    4. 공백 정리
    """
    text = unicodedata.normalize("NFC", text)
    text = _NOISE_TAG.sub(" ", text)
    text = _NON_KO.sub(" ", text)
    text = _MULTI_SPACE.sub(" ", text)
    return text.strip()


if __name__ == "__main__":
    # 동작 확인용 샘플
    samples = [
        "좀 사실은 안 사려고 그랬는데 오천 원을 세일을 해요",  # 107번 정상
        "어디에 쓰는 약 인고?",                                # 94번 정상
        "(noise) 저기 (laugh) 뭐였더라",                      # 노이즈 태그
        "그러니까+ 이게* 뭔지",                                # 발화 마커
    ]
    for s in samples:
        print(f"원본: {s}")
        print(f"정규화: {normalize(s)}\n")
