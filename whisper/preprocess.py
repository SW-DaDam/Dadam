"""
AI Hub 107번(자유대화)·94번(노인명령어) 데이터셋 전처리 스크립트
Colab Pro+ 환경에서 Google Drive 마운트 후 실행
출력: HuggingFace datasets 포맷 (train / valid 분리)
"""

import io
import json
import re
import zipfile
from pathlib import Path
from typing import Generator, Optional

import librosa
from datasets import Audio, Dataset, DatasetDict

# ── 경로 설정 (Colab 환경 기준) ──────────────────────────────────────────────
DRIVE_ROOT = Path("/content/drive/MyDrive/Dadam_dataSet")

DIR_107_TRAIN = DRIVE_ROOT / "자유대화 음성(노인남녀)/Training"
DIR_107_VALID = DRIVE_ROOT / "자유대화 음성(노인남녀)/Validation"
DIR_94_TRAIN  = DRIVE_ROOT / "명령어 음성(노인남녀)/Training"
DIR_94_VALID  = DRIVE_ROOT / "명령어 음성(노인남녀)/Validation"

OUTPUT_DIR = Path("/content/drive/MyDrive/Dadam_dataSet/processed")

# ── 오디오 설정 ──────────────────────────────────────────────────────────────
TARGET_SR    = 16_000  # Whisper 표준 입력 샘플레이트
MAX_DURATION = 30.0    # Whisper 최대 입력 길이(초) — 초과 클립 제외
MIN_DURATION = 0.5     # 너무 짧은 클립 제외

# ── 텍스트 정규화 ─────────────────────────────────────────────────────────────
_NOISE_PATTERN = re.compile(
    r"\(noise\)|\(laugh\)|\(cough\)|\(breath\)|\(unclear\)|"
    r"\+|\*|/|\[.*?\]|\{.*?\}|<.*?>",
    re.IGNORECASE,
)
_MULTI_SPACE = re.compile(r"\s{2,}")


def normalize_text(text: str) -> str:
    """발화 노이즈 태그·특수 마커 제거 후 공백 정리"""
    text = _NOISE_PATTERN.sub(" ", text)
    text = _MULTI_SPACE.sub(" ", text)
    return text.strip()


# ── JSON 파서 ─────────────────────────────────────────────────────────────────
def _parse_raw(raw: dict) -> Optional[dict]:
    """
    107번·94번 포맷을 키 존재 여부로 자동 감지 후 파싱
    반환: {file_name, text, duration, dataset, domain, region, gender, age}
    실패: None
    """
    # 107번 포맷: "발화정보" 키
    if "발화정보" in raw:
        utterance = raw["발화정보"]
        text    = utterance.get("stt", "").strip()
        file_nm = utterance.get("fileNm", "").strip()
        # recrdTime이 빈 문자열이거나 없을 때 0으로 처리
        try:
            duration = float(utterance.get("recrdTime") or 0)
        except (ValueError, TypeError):
            duration = 0.0

        if not text or not file_nm:
            return None

        return {
            "file_name": file_nm,
            "text":      normalize_text(text),
            "duration":  duration,
            "dataset":   "107",
            "domain":    raw.get("대화정보", {}).get("colctUnitCode", ""),
            "region":    raw.get("대화정보", {}).get("cityCode", ""),
            "gender":    raw.get("녹음자정보", {}).get("gender", ""),
            "age":       str(raw.get("녹음자정보", {}).get("age", "")),
        }

    # 94번 포맷: "전사정보" 키
    if "전사정보" in raw:
        text      = raw.get("전사정보", {}).get("LabelText", "").strip()
        file_info = raw.get("파일정보", {})
        file_nm   = file_info.get("FileName", "").strip()
        # FileLength가 빈 문자열이거나 없을 때 0으로 처리
        try:
            duration = float(file_info.get("FileLength") or 0)
        except (ValueError, TypeError):
            duration = 0.0

        speaker = raw.get("화자정보", {})

        if not text or not file_nm:
            return None

        return {
            "file_name": file_nm,
            "text":      normalize_text(text),
            "duration":  duration,
            "dataset":   "94",
            "domain":    raw.get("기본정보", {}).get("DataCategory", ""),
            "region":    speaker.get("Region", ""),
            "gender":    speaker.get("Gender", ""),
            "age":       str(speaker.get("Age", "")),
        }

    return None


# ── zip 쌍 처리 ───────────────────────────────────────────────────────────────
def iter_zip_pairs(
    zip_label: Path,
    zip_audio: Path,
    audio_ext: str = ".wav",
) -> Generator[dict, None, None]:
    """
    라벨링 zip에서 JSON 메타를 로드하고, 원천 zip의 오디오와 매칭하여 yield
    - 오디오는 BytesIO로 감싸서 librosa에 전달 (ZipExtFile 직접 전달 시 실패 방지)
    - Dataset.from_generator()와 함께 써서 메모리에 전체 배열을 올리지 않음
    """
    # ── 1단계: 라벨 zip → file_name 기준 메타 딕셔너리 구성
    meta_map: dict[str, dict] = {}
    with zipfile.ZipFile(zip_label, "r") as zl:
        for name in zl.namelist():
            if not name.lower().endswith(".json"):
                continue
            with zl.open(name) as jf:
                try:
                    raw  = json.load(jf)
                    meta = _parse_raw(raw)
                    if meta:
                        meta_map[meta["file_name"]] = meta
                except Exception:
                    pass  # 파싱 실패한 개별 파일은 무시하고 계속

    print(f"  라벨 로드 완료: {len(meta_map)}개 ({zip_label.name})")

    # ── 2단계: 원천 zip → 오디오 매칭 후 yield
    matched = skipped = 0
    with zipfile.ZipFile(zip_audio, "r") as za:
        for name in za.namelist():
            if not name.lower().endswith(audio_ext):
                continue

            base_name = Path(name).name
            meta = meta_map.get(base_name)
            if not meta:
                skipped += 1
                continue

            # BytesIO로 감싸서 librosa에 전달 — ZipExtFile은 seek 불가라 librosa가 실패할 수 있음
            with za.open(name) as af:
                try:
                    audio_bytes = io.BytesIO(af.read())
                    audio, _    = librosa.load(audio_bytes, sr=TARGET_SR, mono=True)
                except Exception as e:
                    print(f"  [WARN] 오디오 로드 실패: {base_name} — {e}")
                    skipped += 1
                    continue

            duration = len(audio) / TARGET_SR
            if not (MIN_DURATION <= duration <= MAX_DURATION):
                skipped += 1
                continue

            matched += 1
            yield {
                "audio":    {"array": audio, "sampling_rate": TARGET_SR},
                "text":     meta["text"],
                "duration": duration,
                "dataset":  meta["dataset"],
                "domain":   meta["domain"],
                "region":   meta["region"],
                "gender":   meta["gender"],
                "age":      meta["age"],
            }

    print(f"  매칭: {matched}개 / 스킵: {skipped}개 ({zip_audio.name})")


# ── 데이터셋 zip 쌍 목록 ──────────────────────────────────────────────────────
def get_pairs(split: str) -> list[tuple[Path, Path]]:
    """split에 따른 (라벨 zip, 원천 zip) 목록 반환"""
    if split == "train":
        return [
            # 107번 train
            (DIR_107_TRAIN / "[라벨]1.AI챗봇.zip",       DIR_107_TRAIN / "[원천]1.AI챗봇_1.zip"),
            (DIR_107_TRAIN / "[라벨]1.AI챗봇.zip",       DIR_107_TRAIN / "[원천]1.AI챗봇_2.zip"),
            (DIR_107_TRAIN / "[라벨]2.음성수집도구.zip",  DIR_107_TRAIN / "[원천]2.음성수집도구_1.zip"),
            # 94번 train
            (DIR_94_TRAIN / "[라벨]1.AI비서_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]1.AI비서_원천_1_명령어(노인)_training.zip"),
            (DIR_94_TRAIN / "[라벨]1.AI비서_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]1.AI비서_원천_8_명령어(노인)_training.zip"),
            (DIR_94_TRAIN / "[라벨]4.비정형_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]4.비정형_원천_10_명령어(노년)_training.zip"),
            (DIR_94_TRAIN / "[라벨]4.비정형_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]4.비정형_원천_11_명령어(노년)_training.zip"),
        ]
    else:  # valid
        return [
            # 107번 valid
            (DIR_107_VALID / "[라벨]1.AI챗봇.zip",      DIR_107_VALID / "[원천]1.AI챗봇.zip"),
            (DIR_107_VALID / "[라벨]2.음성수집도구.zip", DIR_107_VALID / "[원천]2.음성수집도구.zip"),
            # 94번 valid
            (DIR_94_VALID / "[라벨]1.AI비서_라벨링_명령어(노년)_validation.zip", DIR_94_VALID / "[원천]1.AI비서_원천_1_명령어(노인)_validation.zip"),
            (DIR_94_VALID / "[라벨]4.비정형_라벨링_명령어(노년)_validation.zip", DIR_94_VALID / "[원천]4.비정형_원천_1_명령어(노년)_validation.zip"),
        ]


# ── 메인 파이프라인 ───────────────────────────────────────────────────────────
def make_generator(split: str):
    """Dataset.from_generator()에 넘길 제너레이터 팩토리"""
    def _gen():
        for zip_label, zip_audio in get_pairs(split):
            if not zip_label.exists():
                print(f"[SKIP] 파일 없음: {zip_label}")
                continue
            if not zip_audio.exists():
                print(f"[SKIP] 파일 없음: {zip_audio}")
                continue
            print(f"\n처리 중: {zip_audio.name}")
            yield from iter_zip_pairs(zip_label, zip_audio)
    return _gen


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=== train 셋 구성 중 ===")
    train_ds = Dataset.from_generator(make_generator("train"))
    # Audio 컬럼을 16kHz로 캐스팅 — from_generator 후 별도 적용
    train_ds = train_ds.cast_column("audio", Audio(sampling_rate=TARGET_SR))

    print("\n=== valid 셋 구성 중 ===")
    valid_ds = Dataset.from_generator(make_generator("valid"))
    valid_ds = valid_ds.cast_column("audio", Audio(sampling_rate=TARGET_SR))

    ds_dict = DatasetDict({"train": train_ds, "validation": valid_ds})

    save_path = OUTPUT_DIR / "senior_speech"
    ds_dict.save_to_disk(str(save_path))
    print(f"\n저장 완료: {save_path}")
    print(ds_dict)


if __name__ == "__main__":
    main()
